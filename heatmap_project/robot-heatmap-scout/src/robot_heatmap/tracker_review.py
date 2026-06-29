import json
import os
from html import escape

from robot_heatmap.tactical_analysis import build_analysis_from_dir


def build_tracker_review(
    analysis_dir: str,
    output_path: str | None = None,
    field_path: str | None = None,
) -> str:
    output_path = output_path or os.path.join(analysis_dir, "review.html")
    analysis_path = build_analysis_from_dir(analysis_dir, field_path=field_path)
    with open(analysis_path, "r", encoding="utf-8") as f:
        analysis = json.load(f)

    html = render_tracker_review_html(analysis_dir, analysis)
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)
    return output_path


def render_tracker_review_html(analysis_dir: str, analysis: dict) -> str:
    metadata = analysis.get("metadata", {})
    field = analysis.get("field", {})
    video_path = _html_path(metadata.get("video_path", ""), analysis_dir)
    arena_image = _html_path(field.get("image") or metadata.get("arena_image", ""), analysis_dir)
    payload = dict(analysis)
    payload.setdefault("metadata", {})["video_path"] = video_path
    payload.setdefault("field", {})["image"] = arena_image
    data_json = json.dumps(payload, ensure_ascii=False).replace("</", "<\\/")
    title = escape(str(metadata.get("analysis_name", "Tactical Replay")))
    return f"""<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tactical Replay - {title}</title>
  <style>
    :root {{
      color-scheme: dark;
      --bg: #0B0F14;
      --panel: #111820;
      --panel2: #16202A;
      --text: #E8F0F8;
      --muted: #8A98A8;
      --grid: #2A3440;
      --robotTrail: #2EE88B;
      --collect: #2EE88B;
      --score: #FFD23F;
      --transit: #4DA3FF;
      --base: #B56CFF;
      --traffic: #FF8A3D;
      --risk: #FF4D5E;
      --neutral: #A8B3C1;
      --unknown: #7A8699;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: Segoe UI, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
    }}
    header {{
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: end;
      padding: 16px 20px;
      background: #070A0E;
      border-bottom: 1px solid var(--grid);
    }}
    h1 {{ margin: 0; font-size: 22px; }}
    .subtitle {{ color: var(--muted); font-size: 13px; margin-top: 4px; }}
    .metrics {{ display: flex; gap: 12px; flex-wrap: wrap; justify-content: end; }}
    .metric {{ min-width: 92px; }}
    .metric b {{ display: block; font-size: 18px; }}
    .metric span {{ color: var(--muted); font-size: 12px; }}
    main {{
      display: grid;
      grid-template-columns: minmax(420px, 1fr) minmax(420px, 1fr);
      gap: 14px;
      padding: 14px;
    }}
    video {{
      width: 100%;
      background: #000;
      border: 1px solid var(--grid);
      display: block;
    }}
    .arena {{
      position: relative;
      min-height: 430px;
      background: #000;
      border: 1px solid var(--grid);
      overflow: hidden;
    }}
    .arena img {{
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }}
    canvas {{ position: absolute; inset: 0; width: 100%; height: 100%; }}
    .toolbar {{ display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 10px; }}
    button {{
      background: var(--panel2);
      color: var(--text);
      border: 1px solid var(--grid);
      padding: 8px 10px;
      cursor: pointer;
    }}
    button.active {{ border-color: var(--robotTrail); color: var(--robotTrail); }}
    .timeline {{
      margin: 0 14px 14px;
      display: flex;
      min-height: 42px;
      border: 1px solid var(--grid);
      background: var(--panel);
      overflow: hidden;
    }}
    .segment {{
      min-width: 4px;
      border: 0;
      border-right: 1px solid rgba(0,0,0,.35);
      padding: 0;
      position: relative;
    }}
    .segment.stopped {{
      background-image: repeating-linear-gradient(45deg, rgba(255,77,94,.95), rgba(255,77,94,.95) 6px, rgba(17,24,32,.8) 6px, rgba(17,24,32,.8) 12px) !important;
    }}
    .readout {{
      margin: 0 14px 14px;
      display: grid;
      grid-template-columns: repeat(6, minmax(120px, 1fr));
      gap: 10px;
    }}
    .readout div {{ background: var(--panel); border: 1px solid var(--grid); padding: 10px; }}
    .readout span {{ display: block; color: var(--muted); font-size: 12px; }}
    .debug {{
      display: none;
      margin: 0 14px 14px;
      background: var(--panel);
      border: 1px solid var(--grid);
      padding: 10px;
      color: var(--muted);
      white-space: pre-wrap;
    }}
    .debug.visible {{ display: block; }}
    @media (max-width: 960px) {{
      header {{ align-items: start; flex-direction: column; }}
      main {{ grid-template-columns: 1fr; }}
      .readout {{ grid-template-columns: repeat(2, 1fr); }}
    }}
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Tactical Replay</h1>
      <div class="subtitle">Coach Replay - {title}</div>
    </div>
    <div class="metrics">
      <div class="metric"><b id="trackingOk">-</b><span>tracking ok</span></div>
      <div class="metric"><b id="distance">-</b><span>distancia</span></div>
      <div class="metric"><b id="stopped">-</b><span>tempo parado</span></div>
      <div class="metric"><b id="duration">-</b><span>duracao</span></div>
    </div>
  </header>
  <main>
    <section>
      <video id="video" controls src="{escape(video_path)}"></video>
      <div class="toolbar">
        <button class="trail active" data-trail="5">5s</button>
        <button class="trail" data-trail="15">15s</button>
        <button class="trail" data-trail="full">Completa</button>
        <button id="debugToggle">Modo Debug</button>
      </div>
    </section>
    <section>
      <div class="arena">
        <img id="arenaImg" alt="Arena" src="{escape(arena_image)}">
        <canvas id="arenaCanvas"></canvas>
      </div>
    </section>
  </main>
  <div class="timeline" id="timeline"></div>
  <section class="readout">
    <div><span>Tempo</span><b id="timeNow">00:00.0</b></div>
    <div><span>Zona atual</span><b id="zoneNow">-</b></div>
    <div><span>Role</span><b id="roleNow">unknown</b></div>
    <div><span>Estado</span><b id="stateNow">unknown</b></div>
    <div><span>Velocidade</span><b id="speedNow">-</b></div>
    <div><span>Parada atual</span><b id="stopNow">-</b></div>
  </section>
  <pre class="debug" id="debugPanel"></pre>
  <script id="analysis-data" type="application/json">{data_json}</script>
  <script>
    const analysis = JSON.parse(document.getElementById('analysis-data').textContent);
    const video = document.getElementById('video');
    const canvas = document.getElementById('arenaCanvas');
    const arenaImg = document.getElementById('arenaImg');
    const timeline = document.getElementById('timeline');
    const roleColors = {{ collect: '#2EE88B', score: '#FFD23F', transit: '#4DA3FF', base: '#B56CFF', traffic: '#FF8A3D', risk: '#FF4D5E', neutral: '#A8B3C1', unknown: '#7A8699' }};
    let trailMode = 5;
    document.getElementById('trackingOk').textContent = `${{analysis.metadata.tracking_ok_percent || 0}}%`;
    document.getElementById('distance').textContent = `${{Math.round(analysis.summary.total_distance_cm || 0)}} ${{analysis.field.units || 'u'}}`;
    document.getElementById('stopped').textContent = `${{(analysis.summary.total_stopped_time || 0).toFixed(1)}}s`;
    document.getElementById('duration').textContent = `${{(analysis.metadata.duration_seconds || 0).toFixed(1)}}s`;
    document.querySelectorAll('.trail').forEach((button) => button.addEventListener('click', () => {{
      document.querySelectorAll('.trail').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      trailMode = button.dataset.trail === 'full' ? 'full' : Number(button.dataset.trail);
      draw();
    }}));
    document.getElementById('debugToggle').addEventListener('click', () => document.getElementById('debugPanel').classList.toggle('visible'));
    function resizeCanvas() {{
      const rect = arenaImg.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width));
      canvas.height = Math.max(1, Math.round(rect.height));
      draw();
    }}
    function scalePoint(point) {{
      return {{
        x: Number(point[0]) / Number(analysis.field.width || 1000) * canvas.width,
        y: Number(point[1]) / Number(analysis.field.height || 1000) * canvas.height,
      }};
    }}
    function currentPosition() {{
      const t = video.currentTime || 0;
      return analysis.positions.reduce((best, item) => Math.abs(item.t - t) < Math.abs(best.t - t) ? item : best, analysis.positions[0] || {{ t: 0 }});
    }}
    function draw() {{
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const current = currentPosition();
      drawZones(ctx, current);
      drawTrail(ctx, current);
      drawStops(ctx);
      drawRobot(ctx, current);
      updateReadout(current);
    }}
    function drawZones(ctx, current) {{
      analysis.zones.forEach((zone) => {{
        const points = zone.polygon.map(scalePoint);
        if (!points.length) return;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
        ctx.closePath();
        ctx.fillStyle = hexToRgba(roleColors[zone.visual.color] || roleColors[zone.role] || roleColors.unknown, current.zone_id === zone.id ? 0.34 : Number(zone.visual.opacity || 0.14));
        ctx.strokeStyle = roleColors[zone.role] || roleColors.unknown;
        ctx.lineWidth = current.zone_id === zone.id ? 3 : 1;
        ctx.fill();
        if (zone.visual.border !== false) ctx.stroke();
      }});
    }}
    function drawTrail(ctx, current) {{
      const now = current.t || video.currentTime || 0;
      const minTime = trailMode === 'full' ? -Infinity : now - trailMode;
      const points = analysis.positions.filter((p) => p.tracking_ok && p.field_x !== null && p.field_y !== null && p.t <= now && p.t >= minTime);
      if (points.length < 2) return;
      ctx.strokeStyle = '#2EE88B';
      ctx.lineWidth = 3;
      ctx.beginPath();
      points.forEach((point, index) => {{
        const scaled = scalePoint([point.field_x, point.field_y]);
        if (index === 0) ctx.moveTo(scaled.x, scaled.y);
        else ctx.lineTo(scaled.x, scaled.y);
      }});
      ctx.stroke();
    }}
    function drawStops(ctx) {{
      analysis.stops.forEach((stop, index) => {{
        if (stop.field_x === null || stop.field_y === null) return;
        const point = scalePoint([stop.field_x, stop.field_y]);
        ctx.fillStyle = '#FF4D5E';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px Segoe UI';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`P${{index + 1}}`, point.x, point.y);
      }});
    }}
    function drawRobot(ctx, current) {{
      if (!current || !current.tracking_ok || current.field_x === null || current.field_y === null) return;
      const point = scalePoint([current.field_x, current.field_y]);
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#2EE88B';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0B0F14';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }}
    function updateReadout(current) {{
      document.getElementById('timeNow').textContent = formatTime(current.t || video.currentTime || 0);
      document.getElementById('zoneNow').textContent = current.zone_id || 'Fora de zona';
      document.getElementById('roleNow').textContent = current.zone_role || 'unknown';
      document.getElementById('stateNow').textContent = current.state || 'unknown';
      document.getElementById('speedNow').textContent = current.speed_cm_s === null ? '-' : `${{Number(current.speed_cm_s || 0).toFixed(1)}} ${{analysis.field.units || 'u'}}/s`;
      const stop = analysis.stops.find((item) => current.t >= item.start && current.t <= item.end);
      document.getElementById('stopNow').textContent = stop ? `${{stop.id}} (${{stop.duration.toFixed(1)}}s)` : '-';
      document.getElementById('debugPanel').textContent = JSON.stringify(current, null, 2);
    }}
    function renderTimeline() {{
      const duration = Math.max(analysis.metadata.duration_seconds || 0, ...analysis.segments.map((item) => item.end || 0));
      timeline.innerHTML = analysis.segments.map((segment) => {{
        const width = duration > 0 ? Math.max(0.5, (segment.duration / duration) * 100) : 1;
        const color = roleColors[segment.zone_role] || roleColors.unknown;
        return `<button class="segment ${{segment.state}}" style="width:${{width}}%; background:${{color}}" title="${{formatTime(segment.start)}} - ${{formatTime(segment.end)}} | ${{segment.zone_role}} | ${{segment.state}} | ${{segment.duration}}s" data-time="${{segment.start}}"></button>`;
      }}).join('');
      timeline.querySelectorAll('.segment').forEach((button) => button.addEventListener('click', () => {{
        video.currentTime = Number(button.dataset.time || 0);
        video.pause();
        draw();
      }}));
    }}
    function formatTime(value) {{
      const minutes = Math.floor(value / 60);
      const seconds = (value % 60).toFixed(1).padStart(4, '0');
      return `${{minutes.toString().padStart(2, '0')}}:${{seconds}}`;
    }}
    function hexToRgba(hex, alpha) {{
      const value = hex.replace('#', '');
      const r = parseInt(value.slice(0, 2), 16);
      const g = parseInt(value.slice(2, 4), 16);
      const b = parseInt(value.slice(4, 6), 16);
      return `rgba(${{r}}, ${{g}}, ${{b}}, ${{alpha}})`;
    }}
    arenaImg.addEventListener('load', resizeCanvas);
    window.addEventListener('resize', resizeCanvas);
    video.addEventListener('timeupdate', draw);
    renderTimeline();
    resizeCanvas();
  </script>
</body>
</html>
"""


def _html_path(path: str, analysis_dir: str) -> str:
    if not path:
        return ""
    if path.startswith(("http://", "https://", "file:")):
        return path
    if not os.path.isabs(path):
        return path.replace(os.sep, "/").replace("\\", "/")
    base = analysis_dir if os.path.isdir(analysis_dir) else os.getcwd()
    try:
        return os.path.relpath(path, base).replace(os.sep, "/")
    except ValueError:
        return path.replace(os.sep, "/")
