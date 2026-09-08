import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import {
  AlertCircle,
  ArrowLeft,
  BarChart2,
  Clock,
  Gauge,
  Play,
  RotateCcw,
  Save,
  Settings2,
  Target,
  TimerReset,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Sidebar } from '../components/Sidebar';
import { useSidebar } from '../hooks/useSidebar';
import { useMedia } from '../hooks/useMedia';
import { fetchApi, resolveMediaUrl } from '../lib/api';
import { cn } from '../lib/utils';
import type { Match, MatchMedia, ScoutingCycle, ScoutingRound } from '../lib/types';
import { findMatchTeam } from '../lib/matchTeams';
import {
  activeCycleIdAtVideoTime,
  buildMatchAnalysisStats,
  cycleEndTimestamp,
  cycleStartTimestamp,
  effectiveCycleDuration,
  formatVideoOffset,
  parseVideoOffsetInput,
  videoTimeForCycle,
} from '../lib/videoAnalysis';

function isYoutube(path: string) {
  return path.includes('youtube.com') || path.includes('youtu.be');
}

function getYoutubeId(url: string) {
  const match = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
  return match ? match[1] : '';
}

function teamNameForMatch(match: Match | null, teamNumber: number): string | undefined {
  if (!match) return undefined;
  return findMatchTeam(match, teamNumber)?.name ?? undefined;
}

function cycleLabel(cycle: ScoutingCycle) {
  return cycle.is_autonomous ? `A${cycle.cycle_number}` : `T${cycle.cycle_number}`;
}

function durationSeconds(value: number | null | undefined) {
  return (Math.max(0, value ?? 0) / 1000).toFixed(1);
}

function percentLabel(value: number | null | undefined) {
  return `${Math.round((value ?? 0) * 100)}%`;
}

function attemptsLabel(hits: number, misses: number) {
  const attempts = hits + misses;
  return `${attempts} tentativa${attempts === 1 ? '' : 's'}`;
}

function selectedVideo(media: MatchMedia[], videoId: string | null): MatchMedia | null {
  return media.find(m => m.id === videoId && m.file_type === 'video')
    ?? media.find(m => m.category === 'full_match' && m.file_type === 'video')
    ?? media.find(m => m.file_type === 'video')
    ?? null;
}

function OffsetControl({
  media,
  currentSeconds,
  getCurrentSeconds,
  onSave,
}: {
  media: MatchMedia;
  currentSeconds: number;
  getCurrentSeconds: () => Promise<number>;
  onSave: (value: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(formatVideoOffset(media.video_match_start_ms));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(formatVideoOffset(media.video_match_start_ms));
  }, [media.id, media.video_match_start_ms]);

  const saveParsed = async (raw: string) => {
    const parsed = parseVideoOffsetInput(raw);
    if (parsed === null) {
      setError('Tempo invalido. Use segundos ou mm:ss.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(parsed);
      setOpen(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const saveCurrent = async () => {
    setSaving(true);
    setError(null);
    try {
      const current = await getCurrentSeconds();
      const next = formatVideoOffset(Math.max(0, Math.round(current * 1000)));
      setValue(next);
    } catch (e: any) {
      setError(e.message || 'Nao foi possivel ler o tempo atual do video.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        data-testid="video-start-offset-toggle"
        className={cn(
          'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
          open
            ? 'border-orange-500/50 bg-orange-500/15 text-orange-300'
            : 'border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500 hover:text-white'
        )}
      >
        <Settings2 className="h-3.5 w-3.5" />
        Inicio: {formatVideoOffset(media.video_match_start_ms)}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-2xl">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
            <TimerReset className="h-3.5 w-3.5 text-orange-400" />
            Inicio do round no video
          </div>
          <button
            type="button"
            onClick={() => void saveCurrent()}
            data-testid="use-current-video-time"
            disabled={saving}
            className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-3 py-3 text-sm font-black text-white shadow-lg shadow-orange-950/30 transition-colors hover:bg-orange-700 disabled:opacity-50"
          >
            <Clock className="h-4 w-4" />
            {saving ? 'Lendo tempo atual...' : `Usar tempo atual (${formatVideoOffset(Math.round(currentSeconds * 1000))})`}
          </button>
              <input
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder="-3.5, 37.2 ou 00:37.2"
            className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-orange-500"
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setValue('00:00.0');
                void saveParsed('0');
              }}
              disabled={saving}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={saving}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-2 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
            >
              Fechar
            </button>
          </div>
          <button
            type="button"
            onClick={() => void saveParsed(value)}
            disabled={saving}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Salvando...' : 'Salvar ajuste'}
          </button>
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}

export default function MatchAnalysisPage() {
  const { matchId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isCollapsed } = useSidebar();
  const [match, setMatch] = useState<Match | null>(null);
  const [loadingMatch, setLoadingMatch] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [youtubeCurrentSeconds, setYoutubeCurrentSeconds] = useState(0);
  const [youtubePlayerReady, setYoutubePlayerReady] = useState(false);
  const [youtubeFrameLoaded, setYoutubeFrameLoaded] = useState(false);
  const [localCurrentSeconds, setLocalCurrentSeconds] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const youtubeRef = useRef<HTMLIFrameElement | null>(null);
  const youtubeCurrentSecondsRef = useRef(0);
  const youtubePendingTimeRef = useRef<{
    resolve: (seconds: number) => void;
    reject: (error: Error) => void;
    timeout: number;
  } | null>(null);
  const youtubePendingSeekRef = useRef<number | null>(null);

  const {
    media,
    loading: loadingMedia,
    error: mediaError,
    updateMediaStartOffset,
  } = useMedia(matchId ?? null);

  useEffect(() => {
    if (!matchId) return;
    setLoadingMatch(true);
    setError(null);
    fetchApi<Match>(`/matches.php?id=${matchId}`)
      .then(data => {
        setMatch(data);
        const firstRound = data.scouting_rounds?.find(r => (r.cycles ?? []).length > 0);
        setSelectedTeam(firstRound?.team_number ?? data.scouting_rounds?.[0]?.team_number ?? null);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoadingMatch(false));
  }, [matchId]);

  const video = useMemo(() => selectedVideo(media, searchParams.get('video')), [media, searchParams]);
  const isYt = !!video && isYoutube(video.file_path);
  const videoSrc = video ? resolveMediaUrl(video.file_path) : '';
  const youtubeId = video ? getYoutubeId(video.file_path) : '';
  const youtubeOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const currentSeconds = isYt ? youtubeCurrentSeconds : localCurrentSeconds;

  useEffect(() => {
    if (!isYt) return;
    setYoutubePlayerReady(false);
    setYoutubeFrameLoaded(false);
    setYoutubeCurrentSeconds(0);
    youtubeCurrentSecondsRef.current = 0;
    youtubePendingSeekRef.current = null;
  }, [isYt, youtubeId]);

  useEffect(() => {
    if (!isYt) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== youtubeRef.current?.contentWindow) return;
      if (event.origin !== 'https://www.youtube.com' && event.origin !== 'https://www.youtube-nocookie.com') return;

      let payload: any = event.data;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch {
          return;
        }
      }

      if (payload?.event === 'onReady') setYoutubePlayerReady(true);
      const currentTime = payload?.info?.currentTime;
      if (typeof currentTime !== 'number' || !Number.isFinite(currentTime)) return;

      setYoutubePlayerReady(true);
      youtubeCurrentSecondsRef.current = currentTime;
      setYoutubeCurrentSeconds(currentTime);

      const pendingTime = youtubePendingTimeRef.current;
      if (pendingTime) {
        window.clearTimeout(pendingTime.timeout);
        youtubePendingTimeRef.current = null;
        pendingTime.resolve(currentTime);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isYt]);

  useEffect(() => {
    if (!isYt || !youtubeFrameLoaded) return;
    const frameWindow = youtubeRef.current?.contentWindow;
    if (!frameWindow) return;

    const post = (payload: unknown) => frameWindow.postMessage(JSON.stringify(payload), 'https://www.youtube.com');
    const listenAndPoll = () => {
      post({ event: 'listening', id: 'ftc-analysis-player' });
      post({ event: 'command', func: 'getCurrentTime', args: [] });
    };

    listenAndPoll();
    const pollInterval = window.setInterval(listenAndPoll, 250);

    return () => {
      window.clearInterval(pollInterval);
    };
  }, [isYt, youtubeFrameLoaded, youtubeId]);

  useEffect(() => {
    if (!youtubePlayerReady || youtubePendingSeekRef.current === null) return;
    const frameWindow = youtubeRef.current?.contentWindow;
    if (!frameWindow) return;
    const seekSeconds = youtubePendingSeekRef.current;
    youtubePendingSeekRef.current = null;
    frameWindow.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [seekSeconds, true] }), 'https://www.youtube.com');
    frameWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), 'https://www.youtube.com');
  }, [youtubePlayerReady]);

  const rounds = useMemo(
    () => (match?.scouting_rounds ?? []).filter(r => (r.cycles ?? []).length > 0),
    [match]
  );
  const selectedRound = rounds.find(r => r.team_number === selectedTeam) ?? rounds[0] ?? null;
  const cycles = selectedRound?.cycles ?? [];
  const offsetMs = video?.video_match_start_ms ?? 0;
  const timelineOptions = { transitionDurationMs: selectedRound?.transition_duration_ms };
  const activeCycleId = selectedRound
    ? activeCycleIdAtVideoTime(cycles, offsetMs, currentSeconds, timelineOptions)
    : null;
  const analysisStats = useMemo(
    () => buildMatchAnalysisStats(cycles, { transitionDurationMs: selectedRound?.transition_duration_ms }),
    [cycles, selectedRound?.transition_duration_ms]
  );
  const fastestTeleopCycle = analysisStats.fastestTeleopCycle;
  const slowestTeleopCycle = analysisStats.slowestTeleopCycle;
  const totalHits = analysisStats.auto.hits + analysisStats.teleop.hits;
  const totalMisses = analysisStats.auto.misses + analysisStats.teleop.misses;
  const totalAttempts = totalHits + totalMisses;
  const totalHitRate = totalAttempts > 0 ? totalHits / totalAttempts : 0;

  const intervalMaxAttempts = Math.max(
    1,
    ...analysisStats.teleopIntervals.map(interval => interval.hits)
  );

  const chartData = cycles.map((c, index) => ({
    id: c.id,
    name: cycleLabel(c),
    duration: Number(durationSeconds(effectiveCycleDuration(cycles, index, timelineOptions))),
    hits: c.hits,
    misses: c.misses,
  }));
  const activeChartPoint = chartData.find(point => point.id === activeCycleId) ?? null;

  const jumpToCycle = (cycle: ScoutingCycle, index: number) => {
    const seconds = videoTimeForCycle(offsetMs, cycleStartTimestamp(cycles, index, timelineOptions));
    const seekSeconds = Math.max(0, seconds);
    if (isYt) {
      const frameWindow = youtubeRef.current?.contentWindow;
      if (youtubePlayerReady && frameWindow) {
        frameWindow.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [seekSeconds, true] }), 'https://www.youtube.com');
        frameWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), 'https://www.youtube.com');
      } else {
        youtubePendingSeekRef.current = seekSeconds;
      }
      return;
    }
    if (videoRef.current) {
      videoRef.current.currentTime = seekSeconds;
      setLocalCurrentSeconds(seekSeconds);
      void videoRef.current.play().catch(() => {});
    }
  };

  const saveOffset = async (startMs: number) => {
    if (!video) return;
    await updateMediaStartOffset(video.id, startMs);
  };

  const getCurrentVideoSeconds = async () => {
    if (!isYt) {
      return videoRef.current?.currentTime ?? localCurrentSeconds;
    }

    const frameWindow = youtubeRef.current?.contentWindow;
    if (!youtubePlayerReady || !frameWindow) {
      throw new Error('O player do YouTube ainda esta carregando. Tente novamente em instantes.');
    }

    return await new Promise<number>((resolve, reject) => {
      youtubePendingTimeRef.current?.reject(new Error('Leitura anterior cancelada.'));
      if (youtubePendingTimeRef.current) window.clearTimeout(youtubePendingTimeRef.current.timeout);

      const timeout = window.setTimeout(() => {
        youtubePendingTimeRef.current = null;
        resolve(youtubeCurrentSecondsRef.current);
      }, 1_500);
      youtubePendingTimeRef.current = { resolve, reject, timeout };
      frameWindow.postMessage(JSON.stringify({ event: 'command', func: 'getCurrentTime', args: [] }), 'https://www.youtube.com');
    });
  };

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className={cn('flex-1 p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8 transition-all duration-300 overflow-x-hidden', isCollapsed ? 'lg:ml-20' : 'lg:ml-64')}>
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Link to="/championships" className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white">
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar para partidas
              </Link>
              <h1 className="flex items-center gap-2 text-2xl font-black text-white">
                <BarChart2 className="h-6 w-6 text-orange-400" />
                Analise da Partida
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                {match ? `${match.display_name}${match.championship_short_name ? ` - ${match.championship_short_name}` : ''}` : 'Carregando partida...'}
              </p>
            </div>
            {video && (
              <OffsetControl
                media={video}
                currentSeconds={currentSeconds}
                getCurrentSeconds={getCurrentVideoSeconds}
                onSave={saveOffset}
              />
            )}
          </div>

          {(loadingMatch || loadingMedia) && (
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-8 text-center text-slate-400">
              Carregando analise...
            </div>
          )}

          {(error || mediaError) && (
            <div className="rounded-xl border border-red-800 bg-red-950/30 p-4 text-sm text-red-300">
              {error || mediaError}
            </div>
          )}

          {!loadingMatch && !loadingMedia && match && (
            <>
              <section className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
                <div className="space-y-5">
                  <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
                    <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-white">
                        <Play className="h-4 w-4 text-orange-400" />
                        Video sincronizado
                      </div>
                      {media.filter(item => item.file_type === 'video').length > 1 && (
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-400">
                          Video
                          <select
                            value={video?.id ?? ''}
                            onChange={event => setSearchParams({ video: event.target.value })}
                            className="max-w-44 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white outline-none focus:border-orange-500"
                          >
                            {media.filter(item => item.file_type === 'video').map((item, index) => (
                              <option key={item.id} value={item.id}>{item.title || `Video ${index + 1}`}</option>
                            ))}
                          </select>
                        </label>
                      )}
                      {video && video.video_match_start_ms == null && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/10 px-2.5 py-1 text-xs font-semibold text-yellow-300">
                          <AlertCircle className="h-3.5 w-3.5" />
                          Ajuste o inicio para sincronizar a timeline
                        </span>
                      )}
                    </div>

                    {!video ? (
                      <div className="flex aspect-video items-center justify-center text-sm text-slate-500">
                        Nenhum video de partida encontrado.
                      </div>
                    ) : isYt ? (
                      <iframe
                        ref={youtubeRef}
                        key={youtubeId}
                        src={`https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&playsinline=1${youtubeOrigin ? `&origin=${encodeURIComponent(youtubeOrigin)}` : ''}`}
                        className="aspect-video w-full"
                        allow="autoplay; fullscreen"
                        allowFullScreen
                        onLoad={() => {
                          setYoutubePlayerReady(true);
                          setYoutubeCurrentSeconds(0);
                          youtubeCurrentSecondsRef.current = 0;
                          setYoutubeFrameLoaded(true);
                        }}
                      />
                    ) : (
                      <video
                        ref={videoRef}
                        src={videoSrc}
                        controls
                        className="aspect-video w-full bg-black"
                        onLoadedMetadata={e => setLocalCurrentSeconds(e.currentTarget.currentTime)}
                        onSeeked={e => setLocalCurrentSeconds(e.currentTarget.currentTime)}
                        onTimeUpdate={e => setLocalCurrentSeconds(e.currentTarget.currentTime)}
                      />
                    )}
                  </div>

                  {selectedRound && (
                    <div className="rounded-xl border border-slate-700 bg-slate-800 p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-300">Timeline de ciclos</h2>
                        </div>
                        {slowestTeleopCycle && (
                          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-300">
                            Lento: {cycleLabel(slowestTeleopCycle)} ({durationSeconds(slowestTeleopCycle.duration)}s)
                          </span>
                        )}
                      </div>

                      <div className="flex items-start gap-2 overflow-x-auto pb-2">
                        {cycles.map((cycle, index) => {
                          const isFast = fastestTeleopCycle?.id === cycle.id;
                          const isSlow = slowestTeleopCycle?.id === cycle.id;
                          const isActive = activeCycleId === cycle.id;
                          const startTimestamp = cycleStartTimestamp(cycles, index, timelineOptions);
                          const endTimestamp = cycleEndTimestamp(cycles, index);
                          const startLabel = formatVideoOffset((video?.video_match_start_ms ?? 0) + startTimestamp);
                          const endLabel = formatVideoOffset((video?.video_match_start_ms ?? 0) + endTimestamp);
                          return (
                            <button
                              key={cycle.id}
                              type="button"
                              onClick={() => jumpToCycle(cycle, index)}
                              className={cn(
                                'min-w-24 rounded-lg border px-2 py-2 text-left transition-colors hover:border-orange-400',
                                isActive
                                  ? 'border-orange-400 bg-orange-500/20 shadow-lg shadow-orange-950/30 ring-2 ring-orange-400/50'
                                  : 'border-slate-700 bg-slate-900/70'
                              )}
                            >
                              <span className="mb-1 flex items-center justify-between gap-2">
                                <span className="text-sm font-black text-white">{cycleLabel(cycle)}</span>
                                <span className={cn('text-xs', isActive ? 'font-bold text-orange-200' : 'text-slate-500')}>
                                  {startLabel}
                                </span>
                              </span>
                              <span className="block text-xs text-slate-400">{startLabel} - {endLabel}</span>
                              <span className="flex items-center justify-between gap-1 text-xs text-slate-500">
                                {durationSeconds(effectiveCycleDuration(cycles, index, timelineOptions))}s
                                {!isActive && isFast && <span className="text-green-400">rapido</span>}
                                {!isActive && isSlow && <span className="text-red-400">lento</span>}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedRound && chartData.length > 0 && (
                    <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-300">Ritmo ao vivo</h2>
                          <p className="text-xs text-slate-500">O marcador acompanha o ciclo atual do video.</p>
                        </div>
                        <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-300">
                          {activeChartPoint ? `Assistindo: ${activeChartPoint.name}` : 'Fora dos ciclos'}
                        </span>
                      </div>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={chartData} margin={{ left: -15, right: 10, top: 10, bottom: 0 }}>
                          <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 8 }} />
                          {activeChartPoint && (
                            <ReferenceLine
                              x={activeChartPoint.name}
                              stroke="#f97316"
                              strokeWidth={2}
                              strokeDasharray="4 4"
                              label={{ value: 'agora', fill: '#fdba74', fontSize: 11, position: 'top' }}
                            />
                          )}
                          <Line
                            type="monotone"
                            dataKey="duration"
                            name="Duracao (s)"
                            stroke="#f97316"
                            strokeWidth={2}
                            dot={{ fill: '#f97316' }}
                            activeDot={{ r: 6, fill: '#fdba74', stroke: '#fff', strokeWidth: 2 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <aside className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="text-sm font-bold uppercase tracking-wide text-slate-300">Time analisado</h2>
                    <span className="text-xs text-slate-500">{rounds.length} com scout</span>
                  </div>

                  <div className="mb-4 grid grid-cols-2 gap-2">
                    {rounds.map(round => (
                      <button
                        key={round.id}
                        type="button"
                        onClick={() => setSelectedTeam(round.team_number)}
                        className={cn(
                          'rounded-lg border px-3 py-2 text-left transition-colors',
                          selectedRound?.id === round.id
                            ? 'border-orange-500/60 bg-orange-500/15 text-white'
                            : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-500'
                        )}
                      >
                        <span className="block text-sm font-black">#{round.team_number}</span>
                        <span className="block truncate text-xs text-slate-400">{teamNameForMatch(match, round.team_number) ?? 'Equipe'}</span>
                      </button>
                    ))}
                  </div>

                  {!selectedRound ? (
                    <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-5 text-center text-sm text-slate-500">
                      Nenhum scout com ciclos nesta partida.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-200">
                            <Target className="h-4 w-4 text-emerald-300" />
                            Producao total
                          </div>
                          <span className="rounded-full bg-slate-950/40 px-2 py-0.5 text-xs font-semibold text-slate-300">
                            {percentLabel(totalHitRate)}
                          </span>
                        </div>
                        <div className="flex items-end justify-between gap-3">
                          <div>
                            <p className="text-4xl font-black leading-none text-emerald-300">{totalHits}</p>
                            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-emerald-100">Acertos</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-black text-red-300">{totalMisses}</p>
                            <p className="text-xs text-slate-400">erros</p>
                            <p className="text-xs text-slate-500">{cycles.length} ciclos</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
                          <TimerReset className="mb-1 h-4 w-4 text-sky-400" />
                          <p className="text-2xl font-black text-emerald-300">{analysisStats.auto.hits}</p>
                          <p className="text-xs font-semibold text-slate-300">Acertos auto</p>
                          <p className="mt-1 text-sm font-bold text-red-300">{analysisStats.auto.misses} erros</p>
                          <p className="text-xs text-slate-500">
                            {analysisStats.auto.cycles} ciclos - {percentLabel(analysisStats.auto.hitRate)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
                          <Target className="mb-1 h-4 w-4 text-emerald-400" />
                          <p className="text-2xl font-black text-emerald-300">{analysisStats.teleop.hits}</p>
                          <p className="text-xs font-semibold text-slate-300">Acertos teleop</p>
                          <p className="mt-1 text-sm font-bold text-red-300">{analysisStats.teleop.misses} erros</p>
                          <p className="text-xs text-slate-500">
                            {analysisStats.teleop.cycles} ciclos - {percentLabel(analysisStats.teleop.hitRate)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
                          <Gauge className="mb-1 h-4 w-4 text-green-400" />
                          <p className="text-xl font-black text-white">{fastestTeleopCycle ? cycleLabel(fastestTeleopCycle) : '-'}</p>
                          <p className="text-xs text-slate-400">Mais rapido teleop</p>
                          <p className="mt-1 text-xs font-semibold text-slate-300">
                            {fastestTeleopCycle ? `${durationSeconds(fastestTeleopCycle.duration)}s` : 'Sem teleop'}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
                          <AlertCircle className="mb-1 h-4 w-4 text-red-400" />
                          <p className="text-xl font-black text-white">{slowestTeleopCycle ? cycleLabel(slowestTeleopCycle) : '-'}</p>
                          <p className="text-xs text-slate-400">Mais lento teleop</p>
                          <p className="mt-1 text-xs font-semibold text-slate-300">
                            {slowestTeleopCycle ? `${durationSeconds(slowestTeleopCycle.duration)}s` : 'Sem teleop'}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Teleop por 30s</p>
                          <span className="text-xs font-semibold text-emerald-300">{analysisStats.teleop.hits} acertos teleop</span>
                        </div>
                        <div className="space-y-2">
                          {analysisStats.teleopIntervals.map(interval => {
                            const attempts = interval.hits + interval.misses;
                            const width = `${Math.max(6, (interval.hits / intervalMaxAttempts) * 100)}%`;
                            return (
                              <div key={interval.interval}>
                                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                                  <span className="font-semibold text-slate-300">{interval.interval}</span>
                                  <span className="font-bold text-emerald-300">{interval.hits} acertos</span>
                                  <span className="hidden">
                                    {interval.cycles} ciclos · {durationSeconds(interval.avgDuration)}s med.
                                  </span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-orange-500"
                                    style={{ width }}
                                  />
                                </div>
                                <p className="mt-1 text-xs text-slate-500">
                                  <span className="font-semibold text-red-300">{interval.misses} erros</span>
                                  {' - '}
                                  {attemptsLabel(interval.hits, interval.misses)}
                                  {' - '}
                                  {interval.cycles} ciclos - {durationSeconds(interval.avgDuration)}s med. - {percentLabel(interval.hitRate)}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Movimentacoes</p>
                    <p className="mt-1 text-sm text-slate-500">Em breve: trajetoria, zonas e heatmap local conectados por contrato de dados.</p>
                  </div>
                </aside>
              </section>

              {selectedRound && chartData.length > 0 && (
                <section className="grid grid-cols-1 gap-5">
                  <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                    <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-300">Producao por ciclo</h2>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={chartData} margin={{ left: -15, right: 10, top: 10, bottom: 0 }}>
                        <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 8 }} />
                        <Bar dataKey="hits" name="Acertos" fill="#22c55e" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="misses" name="Erros" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
