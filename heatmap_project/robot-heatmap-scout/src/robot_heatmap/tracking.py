import csv
import json
import os
from dataclasses import dataclass

import cv2

from robot_heatmap.calibration import Calibration


class TrackingError(Exception):
    pass


@dataclass(frozen=True)
class PositionRecord:
    frame_index: int
    time_seconds: float
    video_x: float | None
    video_y: float | None
    field_x: float | None
    field_y: float | None
    bbox_x: float | None
    bbox_y: float | None
    bbox_w: float | None
    bbox_h: float | None
    tracking_ok: bool


@dataclass(frozen=True)
class TrackerEvent:
    event: str
    frame_index: int
    time_seconds: float
    detail: str = ""


POSITION_CSV_COLUMNS = [
    "frame",
    "time_seconds",
    "video_x",
    "video_y",
    "field_x",
    "field_y",
    "bbox_x",
    "bbox_y",
    "bbox_w",
    "bbox_h",
    "tracking_ok",
]

TRACKER_EVENT_COLUMNS = ["event", "frame", "time_seconds", "detail"]

TRACKER_FACTORY_NAMES = {
    "CSRT": "TrackerCSRT_create",
    "KCF": "TrackerKCF_create",
}


def default_analysis_dir(video_path: str = "", calibration_path: str = "") -> str:
    source = video_path or calibration_path or "analysis"
    analysis_name = os.path.splitext(os.path.basename(source))[0] or "analysis"
    return os.path.join("outputs", "analyses", analysis_name)


def default_positions_csv_path(calibration_path: str) -> str:
    return os.path.join(default_analysis_dir("", calibration_path), "positions.csv")


def speed_to_delay_ms(speed: str, fps: float) -> int:
    normalized = str(speed).strip().lower()
    if normalized == "max":
        return 1
    if normalized not in {"1", "2", "4", "8"}:
        raise TrackingError("Velocidade invalida. Use 1, 2, 4, 8 ou max.")
    if fps <= 0:
        return 30
    factor = int(normalized)
    return max(1, int(round((1000 / fps) / factor)))


def create_opencv_tracker(tracker_name: str = "CSRT"):
    normalized_name = tracker_name.strip().upper()
    factory_name = TRACKER_FACTORY_NAMES.get(normalized_name)
    if factory_name is None:
        raise TrackingError("Tracker invalido. Use CSRT ou KCF.")

    for namespace in (cv2, getattr(cv2, "legacy", None)):
        if namespace is None:
            continue
        factory = getattr(namespace, factory_name, None)
        if factory is not None:
            return factory()

    raise TrackingError(
        f"OpenCV nao possui {normalized_name}. Instale opencv-contrib-python."
    )


def bbox_center(bbox: tuple[float, float, float, float]) -> tuple[float, float]:
    x, y, w, h = bbox
    return (float(x) + float(w) / 2.0, float(y) + float(h) / 2.0)


def make_position_record(
    frame_index: int,
    fps: float,
    bbox: tuple[float, float, float, float] | None,
    calibration: Calibration,
    tracking_ok: bool = True,
) -> PositionRecord:
    time_seconds = round(frame_index / fps, 3) if fps > 0 else 0.0

    if not tracking_ok or bbox is None:
        return PositionRecord(
            frame_index=int(frame_index),
            time_seconds=time_seconds,
            video_x=None,
            video_y=None,
            field_x=None,
            field_y=None,
            bbox_x=None,
            bbox_y=None,
            bbox_w=None,
            bbox_h=None,
            tracking_ok=False,
        )

    video_x, video_y = bbox_center(bbox)
    field_point = calibration.project_video_to_field(video_x, video_y)
    if field_point is None:
        raise TrackingError("Calibracao sem homografia calculada.")

    return PositionRecord(
        frame_index=int(frame_index),
        time_seconds=time_seconds,
        video_x=video_x,
        video_y=video_y,
        field_x=field_point[0],
        field_y=field_point[1],
        bbox_x=float(bbox[0]),
        bbox_y=float(bbox[1]),
        bbox_w=float(bbox[2]),
        bbox_h=float(bbox[3]),
        tracking_ok=True,
    )


def save_positions_csv(records: list[PositionRecord], output_path: str) -> None:
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    with open(output_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=POSITION_CSV_COLUMNS)
        writer.writeheader()
        for record in records:
            writer.writerow(_record_to_csv_row(record))


def save_tracker_events_csv(events: list[TrackerEvent], output_path: str) -> None:
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    with open(output_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=TRACKER_EVENT_COLUMNS)
        writer.writeheader()
        for event in events:
            writer.writerow(
                {
                    "event": event.event,
                    "frame": str(event.frame_index),
                    "time_seconds": _format_csv_value(event.time_seconds),
                    "detail": event.detail,
                }
            )


def read_position_records_csv(path: str) -> list[dict]:
    with open(path, "r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def read_tracker_events_csv(path: str) -> list[dict]:
    with open(path, "r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def save_tracking_metrics(metrics: dict, output_path: str) -> None:
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, ensure_ascii=False, indent=2)


def compute_tracking_metrics(
    records: list[PositionRecord],
    events: list[TrackerEvent],
    processing_seconds: float,
    metadata: dict | None = None,
) -> dict:
    total_frames = len(records)
    ok_frames = sum(1 for record in records if record.tracking_ok)
    failed_frames = total_frames - ok_frames
    duration_seconds = _tracking_duration_seconds(records, events)
    reselections = [event for event in events if event.event == "roi_reselected"]
    lost_events = [event for event in events if event.event == "tracking_lost"]

    metrics = {
        "total_frames": total_frames,
        "tracking_ok_frames": ok_frames,
        "tracking_failed_frames": failed_frames,
        "tracking_ok_percent": round((ok_frames / total_frames) * 100, 2) if total_frames else 0.0,
        "roi_reselections": len(reselections),
        "tracking_lost_count": len(lost_events),
        "duration_seconds": round(duration_seconds, 3),
        "corrections_per_minute": round((len(reselections) / (duration_seconds / 60)), 3)
        if duration_seconds > 0
        else 0.0,
        "longest_segment_without_reselect_seconds": round(
            _longest_segment_without_reselect(events, duration_seconds),
            3,
        ),
        "processing_seconds": round(float(processing_seconds), 3),
    }
    if metadata:
        metrics.update(metadata)
    return metrics


def _record_to_csv_row(record: PositionRecord) -> dict:
    return {
        "frame": str(record.frame_index),
        "time_seconds": _format_csv_value(record.time_seconds),
        "video_x": _format_csv_value(record.video_x),
        "video_y": _format_csv_value(record.video_y),
        "field_x": _format_csv_value(record.field_x),
        "field_y": _format_csv_value(record.field_y),
        "bbox_x": _format_csv_value(record.bbox_x),
        "bbox_y": _format_csv_value(record.bbox_y),
        "bbox_w": _format_csv_value(record.bbox_w),
        "bbox_h": _format_csv_value(record.bbox_h),
        "tracking_ok": "true" if record.tracking_ok else "false",
    }


def _format_csv_value(value: float | None) -> str:
    if value is None:
        return ""
    return str(round(float(value), 3))


def _tracking_duration_seconds(records: list[PositionRecord], events: list[TrackerEvent]) -> float:
    if events:
        finished = [event.time_seconds for event in events if event.event == "finished"]
        if finished:
            return max(0.0, float(finished[-1]))
    valid_times = [record.time_seconds for record in records]
    return max(valid_times) if valid_times else 0.0


def _longest_segment_without_reselect(events: list[TrackerEvent], duration_seconds: float) -> float:
    if duration_seconds <= 0:
        return 0.0
    selection_times = [
        float(event.time_seconds)
        for event in events
        if event.event in {"roi_selected", "roi_reselected"}
    ]
    if not selection_times:
        return duration_seconds
    boundaries = sorted(t for t in selection_times if 0 <= t <= duration_seconds)
    if not boundaries or boundaries[0] > 0:
        boundaries.insert(0, 0.0)
    boundaries.append(duration_seconds)
    return max(max(0.0, boundaries[i + 1] - boundaries[i]) for i in range(len(boundaries) - 1))
