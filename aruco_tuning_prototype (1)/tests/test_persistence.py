"""Round-trip tests for YAML / JSON / CSV persistence."""

import os

import numpy as np
import pytest

from aruco_tuning import persistence
from aruco_tuning.arena import ArenaConfig
from aruco_tuning.arena_registration import LearnedReference, RegistrationData
from aruco_tuning.camera_calibration import CharucoBoardSpec
from aruco_tuning.models import (CalibrationData, CameraConfig, CaptureStats,
                                 RobotConfig, RobotPose, TestConfig, TestResult,
                                 Zone)


def test_camera_config_roundtrip(tmp_path):
    cfg = CameraConfig(name="C920", width=1920, height=1080, autofocus=False,
                       focus=25)
    path = os.path.join(tmp_path, "camera.yaml")
    persistence.save_camera_config(cfg, path)
    loaded = persistence.load_camera_config(path)
    assert loaded.name == cfg.name
    assert loaded.width == 1920 and loaded.height == 1080
    assert loaded.autofocus is False and loaded.focus == 25


def test_robot_config_roundtrip(tmp_path):
    cfg = RobotConfig(marker_id=7, marker_length_mm=82.5, marker_height_mm=55,
                      offset_x_mm=10, offset_heading_deg=15)
    path = os.path.join(tmp_path, "robot.yaml")
    persistence.save_robot_config(cfg, path)
    loaded = persistence.load_robot_config(path)
    assert loaded.marker_id == 7
    assert loaded.marker_length_mm == pytest.approx(82.5)
    assert loaded.offset_heading_deg == pytest.approx(15)


def test_arena_config_roundtrip_with_zones(tmp_path):
    arena = ArenaConfig(width_mm=2400, height_mm=1200, zones=[
        Zone(id="start", name="Início", type="start", color="#2ecc71",
             polygon=[(0, 0), (300, 0), (300, 300), (0, 300)]),
    ])
    path = os.path.join(tmp_path, "arena.yaml")
    persistence.save_arena_config(arena, path)
    loaded = persistence.load_arena_config(path)
    assert loaded.width_mm == pytest.approx(2400)
    assert len(loaded.zones) == 1
    assert loaded.zones[0].id == "start"
    assert len(loaded.zones[0].polygon) == 4


def test_calibration_roundtrip(tmp_path):
    calib = CalibrationData(
        camera_matrix=np.array([[1000, 0, 640], [0, 1000, 360], [0, 0, 1]],
                               dtype=float),
        dist_coeffs=np.array([[0.1, -0.05, 0.001, 0.002, 0.0]]),
        image_width=1280, image_height=720, rms_error=0.42,
        per_view_errors=[0.3, 0.5], num_views=2)
    path = os.path.join(tmp_path, "calib.yaml")
    persistence.save_calibration(calib, path)
    loaded = persistence.load_calibration(path)
    assert loaded.is_valid
    assert np.allclose(loaded.camera_matrix, calib.camera_matrix)
    assert loaded.dist_coeffs.shape[1] == 5
    assert loaded.rms_error == pytest.approx(0.42)


def test_registration_roundtrip(tmp_path):
    data = RegistrationData(
        rvec=np.array([[0.1], [0.2], [0.3]]),
        tvec=np.array([[10.0], [20.0], [30.0]]),
        image_size=(1280, 720),
        correspondences_image=[[1, 2], [3, 4]],
        correspondences_arena=[[10, 20], [30, 40]],
        residuals=[0.1, 0.2],
        learned_references={
            5: LearnedReference(
                marker_id=5,
                corners_arena=np.array([[0, 0, 0], [10, 0, 0],
                                        [10, 10, 0], [0, 10, 0]], dtype=float)),
        })
    path = os.path.join(tmp_path, "reg.yaml")
    persistence.save_registration(data, path)
    loaded = persistence.load_registration(path)
    assert np.allclose(loaded.rvec.reshape(3), [0.1, 0.2, 0.3])
    assert 5 in loaded.learned_references
    assert loaded.learned_references[5].corners_arena.shape == (4, 3)


def test_board_spec_roundtrip(tmp_path):
    spec = CharucoBoardSpec(squares_x=8, squares_y=6, square_length_mm=25,
                            marker_length_mm=18, dictionary="DICT_5X5_1000")
    path = os.path.join(tmp_path, "board.yaml")
    persistence.save_board_spec(spec, path)
    loaded = persistence.load_board_spec(path)
    assert loaded.squares_x == 8 and loaded.squares_y == 6
    assert loaded.square_length_mm == pytest.approx(25)


def _poses():
    return [
        RobotPose(timestamp=0.0, frame_index=0, marker_visible=True,
                  raw_x_mm=1, raw_y_mm=2, raw_z_mm=60, x_mm=1, y_mm=2,
                  heading_deg=10, reprojection_error_px=0.3,
                  pose_confidence=0.9, arena_reference_count=4),
        RobotPose(timestamp=0.1, frame_index=1, marker_visible=False),
    ]


def test_positions_csv_header_and_roundtrip(tmp_path):
    path = os.path.join(tmp_path, "positions.csv")
    persistence.save_positions_csv(_poses(), path)
    with open(path) as fh:
        header = fh.readline().strip().split(",")
    assert header == persistence.POSITIONS_HEADER
    rows = persistence.load_positions_csv(path)
    assert len(rows) == 2
    assert rows[0]["marker_visible"] == "1"
    assert rows[1]["marker_visible"] == "0"


def test_events_csv_roundtrip(tmp_path):
    events = [(0.0, "READY", "NEW_TEST"), (1.0, "NEW_TEST", "CAPTURING_START")]
    path = os.path.join(tmp_path, "events.csv")
    persistence.save_events_csv(events, path)
    rows = persistence.load_events_csv(path)
    assert rows[0]["from_state"] == "READY"
    assert rows[1]["to_state"] == "CAPTURING_START"


def test_result_document_schema_and_manual_field(tmp_path):
    cfg = TestConfig(name="t", session="s", requested_distance_mm=500)
    start = CaptureStats(x_mm=0, y_mm=0, num_samples=15)
    end = CaptureStats(x_mm=500, y_mm=0, num_samples=15)
    result = TestResult(longitudinal_distance_mm=500)
    doc = persistence.build_result_document(cfg, start, end, result,
                                            video_path="recording.mp4")
    assert doc["schema_version"] == persistence.RESULT_SCHEMA_VERSION
    # future analyzer integration placeholder
    assert doc["manual"] == {"longitudinal": None, "lateral": None}
    path = os.path.join(tmp_path, "result.json")
    persistence.save_result_json(doc, path)
    loaded = persistence.load_result_json(path)
    assert loaded["config"]["name"] == "t"
    assert loaded["files"]["video"] == "recording.mp4"


def test_session_manager_layout(tmp_path):
    mgr = persistence.SessionManager(os.path.join(tmp_path, "outputs"))
    tdir = mgr.test_dir("sessão 1", "teste/01", unique=False)
    assert os.path.isdir(tdir)
    assert "sess" in os.path.basename(os.path.dirname(tdir)).lower()
    assert "sessão 1" in mgr.list_sessions() or len(mgr.list_sessions()) == 1
