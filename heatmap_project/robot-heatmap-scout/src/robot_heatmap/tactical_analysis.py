import json
import math
import os

from robot_heatmap.field_config import FieldConfig
from robot_heatmap.tracking import read_position_records_csv, read_tracker_events_csv
from robot_heatmap.zones import normalize_field_zones
from robot_heatmap.zones import point_in_polygon


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
        zone = (
            assign_zone(field_x, field_y, zones)
            if tracking_ok and field_x is not None and field_y is not None
            else None
        )
        speed = 0.0

        if tracking_ok and field_x is not None and field_y is not None:
            if previous_valid is not None:
                dt = max(0.0, t - previous_valid["t"])
                if dt > 0:
                    distance = math.dist(
                        [field_x, field_y],
                        [previous_valid["field_x"], previous_valid["field_y"]],
                    )
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

    segments.append(_make_segment(len(segments) + 1, start, {"t": previous["t"]}, previous))
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
        field_x = (
            round(sum(position["field_x"] for position in samples) / len(samples), 3)
            if samples
            else None
        )
        field_y = (
            round(sum(position["field_y"] for position in samples) / len(samples), 3)
            if samples
            else None
        )
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
            "longest_segment_without_reselect_seconds": float(
                metrics.get("longest_segment_without_reselect_seconds", 0.0)
            ),
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
        "time_by_zone_role": {
            role: round(value, 3) for role, value in time_by_zone_role.items()
        },
    }


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
    return (
        position.get("zone_id"),
        position.get("zone_role", "unknown"),
        position.get("state", "unknown"),
    )


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
        "avg_speed_cm_s": round(
            (float(start.get("speed_cm_s") or 0) + float(previous.get("speed_cm_s") or 0))
            / 2,
            3,
        ),
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
