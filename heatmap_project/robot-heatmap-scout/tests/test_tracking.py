import os
import sys
import tempfile
import csv
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from robot_heatmap.calibration import Calibration
from robot_heatmap.field_config import FieldConfig
from robot_heatmap.tracking import (
    TrackerEvent,
    TrackingError,
    compute_tracking_metrics,
    create_opencv_tracker,
    default_analysis_dir,
    default_positions_csv_path,
    make_position_record,
    save_tracker_events_csv,
    save_positions_csv,
    speed_to_delay_ms,
)


def _identity_calibration() -> Calibration:
    field = FieldConfig("test", "Test Field", "", "cm", 100, 100)
    field.add_reference_point("top_left", "Top left", [0, 0])
    field.add_reference_point("top_right", "Top right", [100, 0])
    field.add_reference_point("bottom_right", "Bottom right", [100, 100])
    field.add_reference_point("bottom_left", "Bottom left", [0, 100])
    calibration = Calibration(field, "video.mp4", 0, "field.yaml", 50.0)
    for point in [(0, 0), (100, 0), (100, 100), (0, 100)]:
        calibration.add_point(*point)
    assert calibration.compute_homography()
    return calibration


def test_position_record_projects_bbox_center_to_field_coordinates():
    calibration = _identity_calibration()

    record = make_position_record(
        frame_index=75,
        fps=50.0,
        bbox=(10, 20, 30, 40),
        calibration=calibration,
    )

    assert record.frame_index == 75
    assert record.time_seconds == 1.5
    assert record.video_x == 25
    assert record.video_y == 40
    assert record.field_x == 25
    assert record.field_y == 40
    assert record.tracking_ok is True


def test_save_positions_csv_writes_tracking_rows_and_blank_failed_values():
    calibration = _identity_calibration()
    ok_record = make_position_record(
        frame_index=10,
        fps=50.0,
        bbox=(10, 20, 30, 40),
        calibration=calibration,
    )
    failed_record = make_position_record(
        frame_index=11,
        fps=50.0,
        bbox=None,
        calibration=calibration,
        tracking_ok=False,
    )

    with tempfile.TemporaryDirectory() as tmpdir:
        output_path = os.path.join(tmpdir, "positions.csv")
        save_positions_csv([ok_record, failed_record], output_path)

        with open(output_path, "r", encoding="utf-8", newline="") as f:
            rows = list(csv.DictReader(f))

    assert list(rows[0].keys()) == [
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
    assert rows[0]["frame"] == "10"
    assert rows[0]["time_seconds"] == "0.2"
    assert rows[0]["video_x"] == "25.0"
    assert rows[0]["field_y"] == "40.0"
    assert rows[0]["tracking_ok"] == "true"
    assert rows[1]["frame"] == "11"
    assert rows[1]["video_x"] == ""
    assert rows[1]["field_x"] == ""
    assert rows[1]["tracking_ok"] == "false"


def test_default_positions_csv_path_uses_calibration_name():
    output_path = default_positions_csv_path("calibrations/decode_v1.yaml")

    assert output_path == os.path.join(
        "outputs",
        "analyses",
        "decode_v1",
        "positions.csv",
    )


def test_create_opencv_tracker_rejects_unknown_tracker_name():
    try:
        create_opencv_tracker("MOSSE")
        assert False, "Deveria rejeitar tracker fora do MVP"
    except TrackingError as e:
        assert "CSRT" in str(e)
        assert "KCF" in str(e)


def test_default_analysis_dir_uses_video_or_calibration_name():
    assert default_analysis_dir("videos/franklin_q9.mp4") == os.path.join(
        "outputs",
        "analyses",
        "franklin_q9",
    )
    assert default_analysis_dir("", "calibrations/decode_v1.yaml") == os.path.join(
        "outputs",
        "analyses",
        "decode_v1",
    )


def test_speed_to_delay_ms_supports_fixed_factors_and_max():
    assert speed_to_delay_ms("1", fps=50.0) == 20
    assert speed_to_delay_ms("4", fps=50.0) == 5
    assert speed_to_delay_ms("8", fps=50.0) == 2
    assert speed_to_delay_ms("max", fps=50.0) == 1


def test_save_tracker_events_csv_writes_event_rows():
    events = [
        TrackerEvent("roi_selected", frame_index=38, time_seconds=0.639, detail="initial"),
        TrackerEvent("roi_reselected", frame_index=120, time_seconds=2.0, detail="manual"),
    ]

    with tempfile.TemporaryDirectory() as tmpdir:
        output_path = os.path.join(tmpdir, "tracker_events.csv")
        save_tracker_events_csv(events, output_path)

        with open(output_path, "r", encoding="utf-8", newline="") as f:
            rows = list(csv.DictReader(f))

    assert list(rows[0].keys()) == ["event", "frame", "time_seconds", "detail"]
    assert rows[0]["event"] == "roi_selected"
    assert rows[1]["event"] == "roi_reselected"
    assert rows[1]["time_seconds"] == "2.0"


def test_compute_tracking_metrics_counts_reselections_and_ok_percent():
    calibration = _identity_calibration()
    records = [
        make_position_record(0, 10.0, (0, 0, 10, 10), calibration),
        make_position_record(10, 10.0, (10, 0, 10, 10), calibration),
        make_position_record(20, 10.0, None, calibration, tracking_ok=False),
        make_position_record(30, 10.0, (20, 0, 10, 10), calibration),
    ]
    events = [
        TrackerEvent("roi_selected", 0, 0.0, "initial"),
        TrackerEvent("tracking_lost", 20, 2.0, "lost"),
        TrackerEvent("roi_reselected", 30, 3.0, "manual"),
        TrackerEvent("finished", 40, 4.0, "done"),
    ]

    metrics = compute_tracking_metrics(records, events, processing_seconds=1.25)

    assert metrics["total_frames"] == 4
    assert metrics["tracking_ok_frames"] == 3
    assert metrics["tracking_ok_percent"] == 75.0
    assert metrics["roi_reselections"] == 1
    assert metrics["corrections_per_minute"] == 15.0
    assert metrics["longest_segment_without_reselect_seconds"] == 3.0
    assert metrics["processing_seconds"] == 1.25
