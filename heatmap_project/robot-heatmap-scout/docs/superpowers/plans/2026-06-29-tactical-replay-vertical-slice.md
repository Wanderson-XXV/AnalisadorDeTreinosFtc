# Tactical Replay Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first offline Tactical Replay Visual slice: semantic zone loading, `analysis.json`, and a Coach Replay `review.html`.

**Architecture:** Keep the current `src/robot_heatmap` package and evolve the existing `build_tracker_review.py` flow. Add a pure-Python analysis module that converts local CSV/YAML/JSON artifacts into `analysis.json`, then make `tracker_review.py` render from that contract.

**Tech Stack:** Python standard library, PyYAML via existing `field_config.py`, pytest, local static HTML/CSS/JS, no API/client web integration.

---

## File Structure

- Modify: `src/robot_heatmap/zones.py`
  - Own semantic zone normalization, role/alliance validation, and point-in-polygon helpers.
- Create: `src/robot_heatmap/tactical_analysis.py`
  - Own `analysis.json` construction from `positions.csv`, `tracker_events.csv`, `tracker_metrics.json`, and `field.yaml`.
- Modify: `src/robot_heatmap/tracker_review.py`
  - Build or load analysis data and render Coach Replay HTML from it.
- Modify: `scripts/build_tracker_review.py`
  - Keep current CLI, add optional `--field` fallback.
- Modify: `configs/fields/decode.yaml`
  - Add manual semantic metadata to the current zones.
- Create: `tests/test_tactical_analysis.py`
  - Cover semantic zone loading, point-in-polygon, zone assignment, speeds, states, segments, stops, and analysis JSON shape.
- Modify: `tests/test_tracker_review.py`
  - Update smoke expectations for `analysis.json`, Coach Replay strings, timeline, debug toggle, and embedded analysis data.
- Create/Update generated during verification only: `outputs/analyses/teste_robo/analysis.json`, `outputs/analyses/teste_robo/review.html`
  - Do not commit generated output unless the user explicitly asks.

---

### Task 1: Semantic Zone Normalization

**Files:**
- Modify: `src/robot_heatmap/zones.py`
- Create: `tests/test_tactical_analysis.py`

- [ ] **Step 1: Write failing tests for old and new zone formats**

Add this initial content to `tests/test_tactical_analysis.py`:

```python
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from robot_heatmap.zones import (
    DEFAULT_ZONE_ANALYSIS,
    DEFAULT_ZONE_VISUAL,
    normalize_field_zones,
    point_in_polygon,
)


def test_normalize_field_zones_adds_defaults_to_old_yaml_shape():
    zones = {
        "close_zone": {
            "label": "close zone",
            "type": "polygon",
            "points": [[0, 0], [10, 0], [10, 10], [0, 10]],
        }
    }

    normalized = normalize_field_zones(zones)

    assert normalized == [
        {
            "id": "close_zone",
            "label": "close zone",
            "type": "polygon",
            "role": "unknown",
            "alliance": "neutral",
            "polygon": [[0.0, 0.0], [10.0, 0.0], [10.0, 10.0], [0.0, 10.0]],
            "visual": DEFAULT_ZONE_VISUAL,
            "analysis": DEFAULT_ZONE_ANALYSIS,
        }
    ]


def test_normalize_field_zones_preserves_semantic_zone_fields():
    zones = {
        "red_loading_zone": {
            "label": "Red Loading Zone",
            "type": "polygon",
            "role": "collect",
            "alliance": "red",
            "points": [[0, 0], [20, 0], [20, 20], [0, 20]],
            "visual": {"color": "collect", "opacity": 0.18, "border": True, "label": True},
            "analysis": {"count_time": True, "detect_stops": True, "important": True},
        }
    }

    normalized = normalize_field_zones(zones)

    assert normalized[0]["id"] == "red_loading_zone"
    assert normalized[0]["role"] == "collect"
    assert normalized[0]["alliance"] == "red"
    assert normalized[0]["visual"]["color"] == "collect"
    assert normalized[0]["analysis"]["important"] is True


def test_normalize_field_zones_falls_back_from_invalid_semantics():
    zones = {
        "bad_zone": {
            "label": "Bad Zone",
            "type": "polygon",
            "role": "launchpad",
            "alliance": "green",
            "points": [[0, 0], [10, 0], [10, 10]],
        }
    }

    normalized = normalize_field_zones(zones)

    assert normalized[0]["role"] == "unknown"
    assert normalized[0]["alliance"] == "neutral"


def test_point_in_polygon_handles_inside_outside_and_edges():
    polygon = [[0, 0], [10, 0], [10, 10], [0, 10]]

    assert point_in_polygon(5, 5, polygon) is True
    assert point_in_polygon(12, 5, polygon) is False
    assert point_in_polygon(0, 5, polygon) is True
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
python -m pytest tests/test_tactical_analysis.py -v
```

Expected: FAIL with import errors for `DEFAULT_ZONE_ANALYSIS`, `DEFAULT_ZONE_VISUAL`, `normalize_field_zones`, and `point_in_polygon`.

- [ ] **Step 3: Implement semantic zone helpers**

Replace `src/robot_heatmap/zones.py` with:

```python
ALLOWED_ZONE_ROLES = {
    "collect",
    "score",
    "transit",
    "base",
    "traffic",
    "risk",
    "neutral",
    "unknown",
}

ALLOWED_ALLIANCES = {"red", "blue", "neutral"}

DEFAULT_ZONE_VISUAL = {
    "color": "neutral",
    "opacity": 0.14,
    "border": True,
    "label": True,
}

DEFAULT_ZONE_ANALYSIS = {
    "count_time": True,
    "detect_stops": True,
    "important": False,
}


def is_valid_polygon(points: list) -> bool:
    if not isinstance(points, list):
        return False
    if len(points) < 3:
        return False
    for pt in points:
        if not (isinstance(pt, (list, tuple)) and len(pt) == 2):
            return False
    return True


def normalize_zone(zone_id: str, label: str, points: list) -> dict:
    return {
        zone_id: {
            "label": label,
            "type": "polygon",
            "points": [[int(p[0]), int(p[1])] for p in points],
        }
    }


def normalize_field_zones(zones: dict | list | None) -> list[dict]:
    if not zones:
        return []
    if isinstance(zones, list):
        items = [(str(zone.get("id", f"zone_{index + 1}")), zone) for index, zone in enumerate(zones)]
    else:
        items = list(zones.items())

    normalized = []
    for zone_id, zone in items:
        points = zone.get("points", zone.get("polygon", []))
        if not is_valid_polygon(points):
            continue
        role = zone.get("role", "unknown")
        alliance = zone.get("alliance", "neutral")
        visual = {**DEFAULT_ZONE_VISUAL, **(zone.get("visual") or {})}
        analysis = {**DEFAULT_ZONE_ANALYSIS, **(zone.get("analysis") or {})}
        if role not in ALLOWED_ZONE_ROLES:
            role = "unknown"
        if alliance not in ALLOWED_ALLIANCES:
            alliance = "neutral"
        if visual.get("color") not in ALLOWED_ZONE_ROLES and visual.get("color") not in {
            "red_alliance",
            "blue_alliance",
        }:
            visual["color"] = role if role != "unknown" else "neutral"

        normalized.append(
            {
                "id": str(zone_id),
                "label": str(zone.get("label", zone_id)),
                "type": "polygon",
                "role": role,
                "alliance": alliance,
                "polygon": [[float(point[0]), float(point[1])] for point in points],
                "visual": visual,
                "analysis": analysis,
            }
        )
    return normalized


def point_in_polygon(x: float, y: float, polygon: list[list[float]]) -> bool:
    inside = False
    point_count = len(polygon)
    if point_count < 3:
        return False

    j = point_count - 1
    for i in range(point_count):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if _point_on_segment(x, y, xi, yi, xj, yj):
            return True
        intersects = ((yi > y) != (yj > y)) and (
            x <= (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi
        )
        if intersects:
            inside = not inside
        j = i
    return inside


def _point_on_segment(
    px: float,
    py: float,
    ax: float,
    ay: float,
    bx: float,
    by: float,
    epsilon: float = 1e-9,
) -> bool:
    cross = (py - ay) * (bx - ax) - (px - ax) * (by - ay)
    if abs(cross) > epsilon:
        return False
    dot = (px - ax) * (bx - ax) + (py - ay) * (by - ay)
    if dot < -epsilon:
        return False
    squared_length = (bx - ax) ** 2 + (by - ay) ** 2
    return dot <= squared_length + epsilon


class Zones:
    @staticmethod
    def is_valid(points: list) -> bool:
        return is_valid_polygon(points)

    @staticmethod
    def normalize(zone_id: str, label: str, points: list) -> dict:
        return normalize_zone(zone_id, label, points)
```

- [ ] **Step 4: Run tests to verify Task 1 passes**

Run:

```powershell
python -m pytest tests/test_tactical_analysis.py -v
```

Expected: PASS for the four zone tests.

- [ ] **Step 5: Commit Task 1**

```powershell
git add heatmap_project/robot-heatmap-scout/src/robot_heatmap/zones.py heatmap_project/robot-heatmap-scout/tests/test_tactical_analysis.py
git commit -m "feat: normalize semantic heatmap zones"
```

---

### Task 2: Tactical Analysis Core

**Files:**
- Modify: `tests/test_tactical_analysis.py`
- Create: `src/robot_heatmap/tactical_analysis.py`

- [ ] **Step 1: Add failing tests for zone assignment, motion, segments, and stops**

Append to `tests/test_tactical_analysis.py`:

```python
from robot_heatmap.tactical_analysis import (
    assign_zone,
    build_position_analysis,
    build_segments,
    build_stops,
)


def test_assign_zone_returns_first_matching_zone_and_unknown_fallback():
    zones = normalize_field_zones(
        {
            "collect_zone": {
                "label": "Collect",
                "role": "collect",
                "points": [[0, 0], [20, 0], [20, 20], [0, 20]],
            },
            "score_zone": {
                "label": "Score",
                "role": "score",
                "points": [[10, 10], [30, 10], [30, 30], [10, 30]],
            },
        }
    )

    assert assign_zone(12, 12, zones)["id"] == "collect_zone"
    assert assign_zone(25, 25, zones)["id"] == "score_zone"
    assert assign_zone(50, 50, zones) is None


def test_build_position_analysis_adds_zone_speed_and_state():
    zones = normalize_field_zones(
        {
            "collect_zone": {
                "label": "Collect",
                "role": "collect",
                "points": [[0, 0], [20, 0], [20, 20], [0, 20]],
            }
        }
    )
    raw_positions = [
        {"frame": "0", "time_seconds": "0.0", "video_x": "1", "video_y": "1", "field_x": "0", "field_y": "0", "bbox_x": "0", "bbox_y": "0", "bbox_w": "2", "bbox_h": "2", "tracking_ok": "true"},
        {"frame": "10", "time_seconds": "1.0", "video_x": "2", "video_y": "1", "field_x": "2", "field_y": "0", "bbox_x": "1", "bbox_y": "0", "bbox_w": "2", "bbox_h": "2", "tracking_ok": "true"},
        {"frame": "20", "time_seconds": "2.0", "video_x": "30", "video_y": "1", "field_x": "30", "field_y": "0", "bbox_x": "29", "bbox_y": "0", "bbox_w": "2", "bbox_h": "2", "tracking_ok": "true"},
        {"frame": "30", "time_seconds": "3.0", "video_x": "", "video_y": "", "field_x": "", "field_y": "", "bbox_x": "", "bbox_y": "", "bbox_w": "", "bbox_h": "", "tracking_ok": "false"},
    ]

    analyzed = build_position_analysis(raw_positions, zones)

    assert analyzed[0]["zone_id"] == "collect_zone"
    assert analyzed[0]["zone_role"] == "collect"
    assert analyzed[0]["speed_cm_s"] == 0.0
    assert analyzed[0]["state"] == "stopped"
    assert analyzed[2]["zone_id"] is None
    assert analyzed[2]["zone_role"] == "unknown"
    assert analyzed[2]["state"] == "moving"
    assert analyzed[3]["state"] == "unknown"


def test_build_segments_groups_consecutive_zone_role_and_state():
    positions = [
        {"t": 0.0, "zone_id": "collect", "zone_role": "collect", "state": "moving", "speed_cm_s": 10.0, "tracking_ok": True},
        {"t": 1.0, "zone_id": "collect", "zone_role": "collect", "state": "moving", "speed_cm_s": 12.0, "tracking_ok": True},
        {"t": 2.0, "zone_id": "score", "zone_role": "score", "state": "stopped", "speed_cm_s": 2.0, "tracking_ok": True},
        {"t": 3.5, "zone_id": "score", "zone_role": "score", "state": "stopped", "speed_cm_s": 1.0, "tracking_ok": True},
    ]

    segments = build_segments(positions)

    assert len(segments) == 2
    assert segments[0]["start"] == 0.0
    assert segments[0]["end"] == 2.0
    assert segments[0]["zone_role"] == "collect"
    assert segments[1]["state"] == "stopped"
    assert segments[1]["duration"] == 1.5


def test_build_stops_extracts_relevant_stopped_segments():
    segments = [
        {"id": "seg_001", "start": 0.0, "end": 0.5, "duration": 0.5, "zone_id": "collect", "zone_role": "collect", "state": "stopped"},
        {"id": "seg_002", "start": 1.0, "end": 2.5, "duration": 1.5, "zone_id": "score", "zone_role": "score", "state": "stopped"},
    ]
    positions = [
        {"t": 1.0, "field_x": 10.0, "field_y": 20.0, "tracking_ok": True},
        {"t": 2.0, "field_x": 14.0, "field_y": 22.0, "tracking_ok": True},
    ]

    stops = build_stops(segments, positions)

    assert len(stops) == 1
    assert stops[0]["id"] == "P1"
    assert stops[0]["duration"] == 1.5
    assert stops[0]["zone_id"] == "score"
    assert stops[0]["field_x"] == 12.0
    assert stops[0]["field_y"] == 21.0
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
python -m pytest tests/test_tactical_analysis.py -v
```

Expected: FAIL with import error for `robot_heatmap.tactical_analysis`.

- [ ] **Step 3: Implement tactical analysis core**

Create `src/robot_heatmap/tactical_analysis.py`:

```python
import json
import math
import os

from robot_heatmap.field_config import FieldConfig
from robot_heatmap.tracking import read_position_records_csv, read_tracker_events_csv
from robot_heatmap.zones import normalize_field_zones, point_in_polygon


STOP_SPEED_THRESHOLD = 8.0
STOP_MIN_DURATION = 1.0
MIN_SEGMENT_DURATION = 0.35
SPEED_SMOOTHING_WINDOW = 5


def assign_zone(field_x: float, field_y: float, zones: list[dict]) -> dict | None:
    for zone in zones:
        if point_in_polygon(field_x, field_y, zone["polygon"]):
            return zone
    return None


def build_position_analysis(raw_positions: list[dict], zones: list[dict]) -> list[dict]:
    positions = []
    previous_valid = None
    raw_speeds = []

    for row in raw_positions:
        tracking_ok = _csv_bool(row.get("tracking_ok"))
        t = _csv_float(row.get("time_seconds"), 0.0)
        field_x = _csv_float(row.get("field_x"))
        field_y = _csv_float(row.get("field_y"))
        video_x = _csv_float(row.get("video_x"))
        video_y = _csv_float(row.get("video_y"))
        bbox = _bbox_from_row(row)
        zone = assign_zone(field_x, field_y, zones) if tracking_ok and field_x is not None and field_y is not None else None
        speed = 0.0

        if tracking_ok and field_x is not None and field_y is not None:
            if previous_valid is not None:
                dt = max(0.0, t - previous_valid["t"])
                if dt > 0:
                    distance = math.dist([field_x, field_y], [previous_valid["field_x"], previous_valid["field_y"]])
                    speed = distance / dt
            previous_valid = {"t": t, "field_x": field_x, "field_y": field_y}
        else:
            previous_valid = None

        raw_speeds.append(speed if tracking_ok else None)
        positions.append(
            {
                "frame": int(float(row.get("frame") or 0)),
                "t": round(t, 3),
                "video_x": video_x,
                "video_y": video_y,
                "field_x": field_x,
                "field_y": field_y,
                "bbox": bbox,
                "tracking_ok": tracking_ok,
                "zone_id": zone["id"] if zone else None,
                "zone_role": zone["role"] if zone else "unknown",
                "speed_cm_s": 0.0,
                "state": "unknown",
            }
        )

    smoothed_speeds = _smooth_speeds(raw_speeds)
    for index, position in enumerate(positions):
        speed_value = smoothed_speeds[index]
        if not position["tracking_ok"] or speed_value is None:
            position["speed_cm_s"] = None
            position["state"] = "unknown"
        else:
            position["speed_cm_s"] = round(speed_value, 3)
            position["state"] = "stopped" if speed_value < STOP_SPEED_THRESHOLD else "moving"

    _promote_short_stops_to_moving(positions)
    return positions


def build_segments(positions: list[dict]) -> list[dict]:
    valid_positions = [position for position in positions if position.get("t") is not None]
    if not valid_positions:
        return []

    segments = []
    start = valid_positions[0]
    previous = valid_positions[0]

    for current in valid_positions[1:]:
        if _segment_key(current) != _segment_key(previous):
            segments.append(_make_segment(len(segments) + 1, start, current, previous))
            start = current
        previous = current

    final_end = previous["t"]
    if len(valid_positions) > 1:
        last_delta = max(0.0, valid_positions[-1]["t"] - valid_positions[-2]["t"])
        final_end = previous["t"] + last_delta
    segments.append(_make_segment(len(segments) + 1, start, {"t": final_end}, previous))
    return _merge_short_segments(segments)


def build_stops(segments: list[dict], positions: list[dict]) -> list[dict]:
    stops = []
    for segment in segments:
        if segment.get("state") != "stopped" or segment.get("duration", 0) < STOP_MIN_DURATION:
            continue
        samples = [
            position
            for position in positions
            if position.get("tracking_ok")
            and position.get("field_x") is not None
            and position.get("field_y") is not None
            and segment["start"] <= position.get("t", -1) <= segment["end"]
        ]
        field_x = round(sum(position["field_x"] for position in samples) / len(samples), 3) if samples else None
        field_y = round(sum(position["field_y"] for position in samples) / len(samples), 3) if samples else None
        stops.append(
            {
                "id": f"P{len(stops) + 1}",
                "start": segment["start"],
                "end": segment["end"],
                "duration": segment["duration"],
                "zone_id": segment.get("zone_id"),
                "zone_role": segment.get("zone_role", "unknown"),
                "field_x": field_x,
                "field_y": field_y,
            }
        )
    return stops


def _csv_bool(value: object) -> bool:
    return str(value).strip().lower() == "true"


def _csv_float(value: object, default: float | None = None) -> float | None:
    if value in (None, ""):
        return default
    return float(value)


def _bbox_from_row(row: dict) -> list[float] | None:
    values = [row.get("bbox_x"), row.get("bbox_y"), row.get("bbox_w"), row.get("bbox_h")]
    if any(value in (None, "") for value in values):
        return None
    return [float(value) for value in values]


def _smooth_speeds(raw_speeds: list[float | None]) -> list[float | None]:
    smoothed = []
    for index, speed in enumerate(raw_speeds):
        if speed is None:
            smoothed.append(None)
            continue
        start = max(0, index - SPEED_SMOOTHING_WINDOW + 1)
        window = [value for value in raw_speeds[start : index + 1] if value is not None]
        smoothed.append(sum(window) / len(window) if window else speed)
    return smoothed


def _promote_short_stops_to_moving(positions: list[dict]) -> None:
    index = 0
    while index < len(positions):
        if positions[index]["state"] != "stopped":
            index += 1
            continue
        start = index
        while index < len(positions) and positions[index]["state"] == "stopped":
            index += 1
        end = index - 1
        duration = max(0.0, positions[end]["t"] - positions[start]["t"])
        if duration < STOP_MIN_DURATION:
            for stopped_index in range(start, end + 1):
                positions[stopped_index]["state"] = "moving"


def _segment_key(position: dict) -> tuple:
    return (position.get("zone_id"), position.get("zone_role", "unknown"), position.get("state", "unknown"))


def _make_segment(segment_number: int, start: dict, end_marker: dict, previous: dict) -> dict:
    start_t = round(float(start["t"]), 3)
    end_t = round(float(end_marker["t"]), 3)
    return {
        "id": f"seg_{segment_number:03d}",
        "start": start_t,
        "end": end_t,
        "duration": round(max(0.0, end_t - start_t), 3),
        "type": "zone" if start.get("zone_id") else "transit",
        "zone_id": start.get("zone_id"),
        "zone_role": start.get("zone_role", "unknown"),
        "state": start.get("state", "unknown"),
        "avg_speed_cm_s": round((float(start.get("speed_cm_s") or 0) + float(previous.get("speed_cm_s") or 0)) / 2, 3),
    }


def _merge_short_segments(segments: list[dict]) -> list[dict]:
    if len(segments) < 2:
        return segments
    merged = []
    for segment in segments:
        if merged and segment["duration"] < MIN_SEGMENT_DURATION:
            merged[-1]["end"] = segment["end"]
            merged[-1]["duration"] = round(merged[-1]["end"] - merged[-1]["start"], 3)
        else:
            merged.append(segment)
    for index, segment in enumerate(merged, start=1):
        segment["id"] = f"seg_{index:03d}"
    return merged
```

- [ ] **Step 4: Run tests and fix only Task 2 failures**

Run:

```powershell
python -m pytest tests/test_tactical_analysis.py -v
```

Expected: PASS for zone and tactical analysis core tests.

- [ ] **Step 5: Commit Task 2**

```powershell
git add heatmap_project/robot-heatmap-scout/src/robot_heatmap/tactical_analysis.py heatmap_project/robot-heatmap-scout/tests/test_tactical_analysis.py
git commit -m "feat: analyze tactical replay motion"
```

---

### Task 3: Analysis JSON Builder

**Files:**
- Modify: `src/robot_heatmap/tactical_analysis.py`
- Modify: `tests/test_tactical_analysis.py`

- [ ] **Step 1: Add failing test for writing `analysis.json`**

Append to `tests/test_tactical_analysis.py`:

```python
import csv
import json
import tempfile

from robot_heatmap.field_config import save_yaml
from robot_heatmap.tactical_analysis import build_analysis, build_analysis_from_dir


def test_build_analysis_from_dir_writes_expected_contract():
    with tempfile.TemporaryDirectory() as tmpdir:
        field_path = os.path.join(tmpdir, "field.yaml")
        analysis_dir = os.path.join(tmpdir, "analysis")
        os.makedirs(analysis_dir)
        save_yaml(
            {
                "field": {
                    "id": "test",
                    "name": "Test",
                    "image": "arena.png",
                    "unit": "cm",
                    "width": 100,
                    "height": 100,
                },
                "reference_points": {},
                "zones": {
                    "collect": {
                        "label": "Collect",
                        "role": "collect",
                        "points": [[0, 0], [30, 0], [30, 30], [0, 30]],
                    }
                },
            },
            field_path,
        )
        with open(os.path.join(analysis_dir, "positions.csv"), "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=["frame", "time_seconds", "video_x", "video_y", "field_x", "field_y", "bbox_x", "bbox_y", "bbox_w", "bbox_h", "tracking_ok"],
            )
            writer.writeheader()
            writer.writerow({"frame": "0", "time_seconds": "0", "video_x": "1", "video_y": "1", "field_x": "5", "field_y": "5", "bbox_x": "0", "bbox_y": "0", "bbox_w": "2", "bbox_h": "2", "tracking_ok": "true"})
            writer.writerow({"frame": "10", "time_seconds": "1", "video_x": "2", "video_y": "1", "field_x": "6", "field_y": "5", "bbox_x": "1", "bbox_y": "0", "bbox_w": "2", "bbox_h": "2", "tracking_ok": "true"})
        with open(os.path.join(analysis_dir, "tracker_events.csv"), "w", encoding="utf-8", newline="") as f:
            f.write("event,frame,time_seconds,detail\nroi_selected,0,0,initial\n")
        with open(os.path.join(analysis_dir, "tracker_metrics.json"), "w", encoding="utf-8") as f:
            json.dump(
                {
                    "analysis_name": "analysis",
                    "video_path": "video.mp4",
                    "arena_image": "arena.png",
                    "field_path": field_path,
                    "duration_seconds": 1.0,
                    "tracking_ok_percent": 100.0,
                    "field_width": 100,
                    "field_height": 100,
                },
                f,
            )

        output_path = build_analysis_from_dir(analysis_dir)
        analysis = json.load(open(output_path, "r", encoding="utf-8"))

    assert output_path.endswith("analysis.json")
    assert analysis["metadata"]["analysis_name"] == "analysis"
    assert analysis["field"]["width"] == 100.0
    assert analysis["field"]["units"] == "cm"
    assert analysis["zones"][0]["id"] == "collect"
    assert analysis["positions"][0]["zone_id"] == "collect"
    assert analysis["events"][0]["category"] == "tracker"
    assert "total_distance_cm" in analysis["summary"]
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
python -m pytest tests/test_tactical_analysis.py::test_build_analysis_from_dir_writes_expected_contract -v
```

Expected: FAIL because `build_analysis_from_dir` and `build_analysis` do not exist.

- [ ] **Step 3: Implement analysis builder functions**

Append these functions to `src/robot_heatmap/tactical_analysis.py`:

```python
def build_analysis_from_dir(
    analysis_dir: str,
    output_path: str | None = None,
    field_path: str | None = None,
) -> str:
    positions_path = os.path.join(analysis_dir, "positions.csv")
    events_path = os.path.join(analysis_dir, "tracker_events.csv")
    metrics_path = os.path.join(analysis_dir, "tracker_metrics.json")

    raw_positions = read_position_records_csv(positions_path)
    raw_events = read_tracker_events_csv(events_path)
    with open(metrics_path, "r", encoding="utf-8") as f:
        metrics = json.load(f)

    resolved_field_path = field_path or metrics.get("field_path")
    if not resolved_field_path:
        raise ValueError("field_path ausente em tracker_metrics.json; passe --field.")
    if not os.path.isabs(resolved_field_path):
        resolved_field_path = os.path.normpath(os.path.join(analysis_dir, resolved_field_path))

    field_config = FieldConfig.from_file(resolved_field_path)
    analysis = build_analysis(
        analysis_dir=analysis_dir,
        raw_positions=raw_positions,
        raw_events=raw_events,
        metrics=metrics,
        field_config=field_config,
        field_path=resolved_field_path,
    )
    output_path = output_path or os.path.join(analysis_dir, "analysis.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(analysis, f, ensure_ascii=False, indent=2)
    return output_path


def build_analysis(
    analysis_dir: str,
    raw_positions: list[dict],
    raw_events: list[dict],
    metrics: dict,
    field_config: FieldConfig,
    field_path: str,
) -> dict:
    zones = normalize_field_zones(field_config.zones)
    positions = build_position_analysis(raw_positions, zones)
    segments = build_segments(positions)
    stops = build_stops(segments, positions)
    events = build_events(raw_events, stops)
    summary = build_summary(positions, stops)
    field = field_config.field
    return {
        "metadata": {
            "analysis_name": metrics.get("analysis_name", os.path.basename(os.path.normpath(analysis_dir))),
            "video_path": metrics.get("video_path", ""),
            "field_path": metrics.get("field_path", field_path),
            "arena_image": metrics.get("arena_image", field.get("image", "")),
            "duration_seconds": float(metrics.get("duration_seconds", 0.0)),
            "tracking_ok_percent": float(metrics.get("tracking_ok_percent", 0.0)),
            "roi_reselections": int(metrics.get("roi_reselections", 0)),
            "tracking_lost_count": int(metrics.get("tracking_lost_count", 0)),
            "longest_segment_without_reselect_seconds": float(metrics.get("longest_segment_without_reselect_seconds", 0.0)),
        },
        "field": {
            "width": float(field.get("width", metrics.get("field_width", 1000))),
            "height": float(field.get("height", metrics.get("field_height", 1000))),
            "units": field.get("unit", field.get("units", "normalized")),
            "image": metrics.get("arena_image", field.get("image", "")),
        },
        "zones": zones,
        "positions": positions,
        "segments": segments,
        "stops": stops,
        "events": events,
        "summary": summary,
    }


def build_events(raw_events: list[dict], stops: list[dict]) -> list[dict]:
    events = [
        {
            "time": _csv_float(event.get("time_seconds"), 0.0),
            "type": event.get("event", ""),
            "category": "tracker",
            "label": event.get("event", "").replace("_", " "),
            "detail": event.get("detail", ""),
        }
        for event in raw_events
    ]
    for stop in stops:
        events.append(
            {
                "time": stop["start"],
                "type": "stop_started",
                "category": "analysis",
                "label": f"Stop started near {stop.get('zone_id') or 'unmarked zone'}",
                "stop_id": stop["id"],
            }
        )
    return sorted(events, key=lambda event: event["time"])


def build_summary(positions: list[dict], stops: list[dict]) -> dict:
    total_distance = 0.0
    previous = None
    time_by_zone_role = {}
    for position in positions:
        role = position.get("zone_role", "unknown")
        time_by_zone_role.setdefault(role, 0.0)
        if previous and position.get("tracking_ok") and previous.get("tracking_ok"):
            if position.get("field_x") is not None and previous.get("field_x") is not None:
                total_distance += math.dist(
                    [position["field_x"], position["field_y"]],
                    [previous["field_x"], previous["field_y"]],
                )
                dt = max(0.0, position["t"] - previous["t"])
                time_by_zone_role[role] += dt
        previous = position
    return {
        "total_distance_cm": round(total_distance, 3),
        "total_stopped_time": round(sum(stop["duration"] for stop in stops), 3),
        "time_by_zone_role": {role: round(value, 3) for role, value in time_by_zone_role.items()},
    }
```

- [ ] **Step 4: Run all tactical analysis tests**

Run:

```powershell
python -m pytest tests/test_tactical_analysis.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```powershell
git add heatmap_project/robot-heatmap-scout/src/robot_heatmap/tactical_analysis.py heatmap_project/robot-heatmap-scout/tests/test_tactical_analysis.py
git commit -m "feat: build tactical analysis json"
```

---

### Task 4: Review Builder Uses `analysis.json`

**Files:**
- Modify: `src/robot_heatmap/tracker_review.py`
- Modify: `scripts/build_tracker_review.py`
- Modify: `tests/test_tracker_review.py`

- [ ] **Step 1: Replace tracker review tests with failing Coach Replay expectations**

Update `tests/test_tracker_review.py` so `test_build_tracker_review_writes_html_with_metrics_and_events` creates a minimal field file and expects `analysis.json`:

```python
import json
import os
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from robot_heatmap.field_config import save_yaml
from robot_heatmap.tracker_review import build_tracker_review


def test_build_tracker_review_writes_analysis_and_coach_replay_html():
    with tempfile.TemporaryDirectory() as tmpdir:
        field_path = os.path.join(tmpdir, "field.yaml")
        save_yaml(
            {
                "field": {
                    "id": "field",
                    "name": "Field",
                    "image": "arena.png",
                    "unit": "cm",
                    "width": 100,
                    "height": 100,
                },
                "reference_points": {},
                "zones": {
                    "score": {
                        "label": "Score",
                        "role": "score",
                        "points": [[0, 0], [50, 0], [50, 50], [0, 50]],
                    }
                },
            },
            field_path,
        )
        with open(os.path.join(tmpdir, "positions.csv"), "w", encoding="utf-8", newline="") as f:
            f.write(
                "frame,time_seconds,video_x,video_y,field_x,field_y,bbox_x,bbox_y,bbox_w,bbox_h,tracking_ok\n"
                "1,0.1,10,20,30,40,5,15,10,10,true\n"
                "2,0.2,,,,,,,,false\n"
            )
        with open(os.path.join(tmpdir, "tracker_events.csv"), "w", encoding="utf-8", newline="") as f:
            f.write("event,frame,time_seconds,detail\nroi_reselected,2,0.2,manual\n")
        with open(os.path.join(tmpdir, "tracker_metrics.json"), "w", encoding="utf-8") as f:
            json.dump(
                {
                    "analysis_name": "lab",
                    "video_path": "video.mp4",
                    "arena_image": "arena.png",
                    "field_path": field_path,
                    "field_width": 100,
                    "field_height": 100,
                    "tracking_ok_percent": 50.0,
                    "corrections_per_minute": 12.0,
                },
                f,
            )

        output_path = os.path.join(tmpdir, "review.html")
        build_tracker_review(tmpdir, output_path)
        html = open(output_path, "r", encoding="utf-8").read()
        analysis = json.load(open(os.path.join(tmpdir, "analysis.json"), "r", encoding="utf-8"))

    assert "Tactical Replay" in html
    assert "Coach Replay" in html
    assert "timeline" in html
    assert "debugToggle" in html
    assert "analysis-data" in html
    assert "video.mp4" in html
    assert "arena.png" in html
    assert analysis["positions"][0]["zone_id"] == "score"


def test_build_tracker_review_script_help_loads_without_ui():
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    script = os.path.join(root, "scripts", "build_tracker_review.py")

    result = subprocess.run(
        [sys.executable, script, "--help"],
        cwd=root,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0
    assert "Gera review HTML do Tracker Lab" in result.stdout
    assert "--analysis-dir" in result.stdout
    assert "--field" in result.stdout
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
python -m pytest tests/test_tracker_review.py -v
```

Expected: FAIL because current review does not create `analysis.json`, does not render Coach Replay, and CLI lacks `--field`.

- [ ] **Step 3: Update CLI field argument**

Modify `scripts/build_tracker_review.py`:

```python
import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from robot_heatmap.tracker_review import build_tracker_review


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Gera review HTML do Tracker Lab")
    parser.add_argument(
        "--analysis-dir",
        required=True,
        help="Pasta da analise contendo positions.csv, tracker_events.csv e tracker_metrics.json",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Caminho do review.html; por padrao salva dentro da pasta de analise",
    )
    parser.add_argument(
        "--field",
        default=None,
        help="Caminho opcional do field.yaml quando tracker_metrics.json nao tiver field_path",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output = args.output or os.path.join(args.analysis_dir, "review.html")
    result = build_tracker_review(args.analysis_dir, output, field_path=args.field)
    print(f"Review salvo em: {result}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Update tracker review generation**

Replace `src/robot_heatmap/tracker_review.py` with a Coach Replay renderer. Keep it self-contained and avoid framework dependencies:

```python
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
      --robot: #FFFFFF;
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
    body {{ margin: 0; font-family: Segoe UI, Arial, sans-serif; background: var(--bg); color: var(--text); }}
    header {{ display: flex; justify-content: space-between; gap: 20px; align-items: end; padding: 16px 20px; background: #070A0E; border-bottom: 1px solid var(--grid); }}
    h1 {{ margin: 0; font-size: 22px; }}
    .subtitle {{ color: var(--muted); font-size: 13px; margin-top: 4px; }}
    .metrics {{ display: flex; gap: 12px; flex-wrap: wrap; justify-content: end; }}
    .metric {{ min-width: 92px; }}
    .metric b {{ display: block; font-size: 18px; }}
    .metric span {{ color: var(--muted); font-size: 12px; }}
    main {{ display: grid; grid-template-columns: minmax(420px, 1fr) minmax(420px, 1fr); gap: 14px; padding: 14px; }}
    video {{ width: 100%; background: #000; border: 1px solid var(--grid); display: block; }}
    .arena {{ position: relative; min-height: 430px; background: #000; border: 1px solid var(--grid); overflow: hidden; }}
    .arena img {{ width: 100%; height: 100%; object-fit: contain; display: block; }}
    canvas {{ position: absolute; inset: 0; width: 100%; height: 100%; }}
    .toolbar {{ display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 10px; }}
    button {{ background: var(--panel2); color: var(--text); border: 1px solid var(--grid); padding: 8px 10px; cursor: pointer; }}
    button.active {{ border-color: var(--robotTrail); color: var(--robotTrail); }}
    .timeline {{ margin: 0 14px 14px; display: flex; min-height: 42px; border: 1px solid var(--grid); background: var(--panel); overflow: hidden; }}
    .segment {{ min-width: 4px; border: 0; border-right: 1px solid rgba(0,0,0,.35); padding: 0; position: relative; }}
    .segment.stopped {{ background-image: repeating-linear-gradient(45deg, rgba(255,77,94,.95), rgba(255,77,94,.95) 6px, rgba(17,24,32,.8) 6px, rgba(17,24,32,.8) 12px) !important; }}
    .readout {{ margin: 0 14px 14px; display: grid; grid-template-columns: repeat(6, minmax(120px, 1fr)); gap: 10px; }}
    .readout div {{ background: var(--panel); border: 1px solid var(--grid); padding: 10px; }}
    .readout span {{ display: block; color: var(--muted); font-size: 12px; }}
    .debug {{ display: none; margin: 0 14px 14px; background: var(--panel); border: 1px solid var(--grid); padding: 10px; color: var(--muted); white-space: pre-wrap; }}
    .debug.visible {{ display: block; }}
    @media (max-width: 960px) {{ header {{ align-items: start; flex-direction: column; }} main {{ grid-template-columns: 1fr; }} .readout {{ grid-template-columns: repeat(2, 1fr); }} }}
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
```

- [ ] **Step 5: Run tracker review tests**

Run:

```powershell
python -m pytest tests/test_tracker_review.py -v
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```powershell
git add heatmap_project/robot-heatmap-scout/src/robot_heatmap/tracker_review.py heatmap_project/robot-heatmap-scout/scripts/build_tracker_review.py heatmap_project/robot-heatmap-scout/tests/test_tracker_review.py
git commit -m "feat: render tactical replay review"
```

---

### Task 5: Add Semantics to `decode.yaml`

**Files:**
- Modify: `configs/fields/decode.yaml`
- Modify: `tests/test_tactical_analysis.py`

- [ ] **Step 1: Add failing test that real decode field has semantic roles**

Append to `tests/test_tactical_analysis.py`:

```python
from robot_heatmap.field_config import FieldConfig


def test_decode_field_has_manual_semantic_zone_roles():
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    field = FieldConfig.from_file(os.path.join(root, "configs", "fields", "decode.yaml"))

    zones = {zone["id"]: zone for zone in normalize_field_zones(field.zones)}

    assert zones["close_zone"]["role"] == "score"
    assert zones["far_zone"]["role"] == "score"
    assert zones["red_loading_zone"]["role"] == "collect"
    assert zones["blue_loading_zone"]["role"] == "collect"
    assert zones["red_base"]["role"] == "base"
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
python -m pytest tests/test_tactical_analysis.py::test_decode_field_has_manual_semantic_zone_roles -v
```

Expected: FAIL because current `decode.yaml` zones normalize to `unknown`.

- [ ] **Step 3: Manually update `configs/fields/decode.yaml` zones**

For each current zone, add semantic fields without changing existing points:

```yaml
  close_zone:
    label: close zone
    type: polygon
    role: score
    alliance: neutral
    visual:
      color: score
      opacity: 0.18
      border: true
      label: true
    analysis:
      count_time: true
      detect_stops: true
      important: true
    points:
      ...
  far_zone:
    label: far zone
    type: polygon
    role: score
    alliance: neutral
    visual:
      color: score
      opacity: 0.18
      border: true
      label: true
    analysis:
      count_time: true
      detect_stops: true
      important: true
    points:
      ...
  red_loading_zone:
    label: red loading zone
    type: polygon
    role: collect
    alliance: red
    visual:
      color: collect
      opacity: 0.18
      border: true
      label: true
    analysis:
      count_time: true
      detect_stops: true
      important: true
    points:
      ...
  blue_loading_zone:
    label: blue loading zone
    type: polygon
    role: collect
    alliance: blue
    visual:
      color: collect
      opacity: 0.18
      border: true
      label: true
    analysis:
      count_time: true
      detect_stops: true
      important: true
    points:
      ...
  red_base:
    label: red base
    type: polygon
    role: base
    alliance: red
    visual:
      color: base
      opacity: 0.18
      border: true
      label: true
    analysis:
      count_time: true
      detect_stops: true
      important: true
    points:
      ...
```

- [ ] **Step 4: Run tactical analysis tests**

Run:

```powershell
python -m pytest tests/test_tactical_analysis.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

```powershell
git add heatmap_project/robot-heatmap-scout/configs/fields/decode.yaml heatmap_project/robot-heatmap-scout/tests/test_tactical_analysis.py
git commit -m "feat: add decode field tactical roles"
```

---

### Task 6: End-to-End Verification

**Files:**
- Generated only: `outputs/analyses/teste_robo/analysis.json`
- Generated only: `outputs/analyses/teste_robo/review.html`

- [ ] **Step 1: Run the full automated test suite**

Run from `heatmap_project/robot-heatmap-scout`:

```powershell
python -m pytest
```

Expected: all tests pass with zero failures.

- [ ] **Step 2: Rebuild the real test review**

Run:

```powershell
python scripts/build_tracker_review.py --analysis-dir outputs/analyses/teste_robo
```

Expected:

```text
Review salvo em: outputs/analyses/teste_robo/review.html
```

Also confirm `outputs/analyses/teste_robo/analysis.json` exists.

- [ ] **Step 3: Inspect generated `analysis.json` shape**

Run:

```powershell
python - <<'PY'
import json
from pathlib import Path

path = Path("outputs/analyses/teste_robo/analysis.json")
data = json.loads(path.read_text(encoding="utf-8"))
print(data["metadata"]["analysis_name"])
print(len(data["zones"]), len(data["positions"]), len(data["segments"]), len(data["stops"]))
print(data["summary"])
PY
```

Expected:

- analysis name prints `teste_robo`;
- zones count is greater than `0`;
- positions count is greater than `0`;
- summary includes `total_distance_cm`, `total_stopped_time`, and `time_by_zone_role`.

- [ ] **Step 4: Browser smoke test**

Open `outputs/analyses/teste_robo/review.html` in a browser.

Check manually:

- video element loads;
- arena image loads;
- zones render on the arena;
- robot marker appears;
- timeline segments appear;
- clicking a timeline segment changes video time;
- `5s`, `15s`, and `Completa` buttons change the trail mode;
- `Modo Debug` toggles a debug panel;
- readout updates while scrubbing or playing.

- [ ] **Step 5: Final status check**

Run:

```powershell
git status --short
```

Expected: source/test/config changes from committed tasks are clean. Generated output may be modified; do not commit generated `outputs/` files unless the user asks.

---

## Self-Review Checklist

- [x] Spec coverage: YAML semantics, old YAML defaults, `analysis.json`, Coach Replay layout, timeline, trail modes, debug toggle, and offline-first are represented by tasks.
- [x] Red-flag scan: no vague filler language or vague error-handling instructions remain.
- [x] Type consistency: `zone_role`, `speed_cm_s`, `analysis-data`, `build_analysis_from_dir`, and `build_tracker_review(..., field_path=...)` names are consistent across tests and implementation steps.
- [x] Scope control: no API PHP, client web, login, upload, or Arena Configurator UI work is included.
