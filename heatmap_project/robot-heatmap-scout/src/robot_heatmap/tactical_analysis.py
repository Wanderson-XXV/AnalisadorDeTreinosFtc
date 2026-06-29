import math

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
