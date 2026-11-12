"""Synthetic ArUco detection + pose estimation tests (no hardware)."""

import cv2
import numpy as np
import pytest

from aruco_tuning import aruco_detection
from aruco_tuning.arena_registration import ArenaRegistration
from aruco_tuning.camera import DemoSource
from aruco_tuning.models import CameraConfig, RobotConfig
from aruco_tuning.robot_pose import RobotPoseEstimator, apply_marker_offset


# ---------------------------------------------------------------------------
# basic detection on a rendered marker
# ---------------------------------------------------------------------------
def test_detects_generated_marker():
    d = aruco_detection.get_dictionary("DICT_4X4_50")
    img = cv2.aruco.generateImageMarker(d, 23, 400)
    img = cv2.copyMakeBorder(img, 80, 80, 80, 80, cv2.BORDER_CONSTANT,
                             value=255)
    img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    det = aruco_detection.ArucoDetector("DICT_4X4_50")
    results = det.detect(img)
    assert [r.marker_id for r in results] == [23]
    assert results[0].corners.shape == (4, 2)
    assert results[0].apparent_size_px > 100


def test_blur_flagged():
    d = aruco_detection.get_dictionary("DICT_4X4_50")
    img = cv2.aruco.generateImageMarker(d, 5, 400)
    img = cv2.copyMakeBorder(img, 80, 80, 80, 80, cv2.BORDER_CONSTANT,
                             value=255)
    img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    blurred = cv2.GaussianBlur(img, (21, 21), 8)
    det = aruco_detection.ArucoDetector("DICT_4X4_50", blur_threshold=200.0)
    res = det.detect(blurred)
    # with a high threshold the blurred marker should be flagged
    if res:  # detection may still succeed; blur flag is what we assert
        assert res[0].is_blurred


# ---------------------------------------------------------------------------
# end-to-end synthetic pose pipeline via the demo renderer
# ---------------------------------------------------------------------------
def _setup_demo_pipeline():
    cfg = CameraConfig(source_type="demo", width=1280, height=720)
    demo = DemoSource(cfg)
    det = aruco_detection.ArucoDetector("DICT_4X4_50")
    calib = demo.get_calibration()
    frame = demo.render()
    dets = det.detect(frame)
    det_by_id = {m.marker_id: m for m in dets}
    reg = ArenaRegistration()
    for mid, arena_corners in demo.get_reference_corners().items():
        if mid in det_by_id:
            img_c = det_by_id[mid].corners.reshape(4, 2)
            reg.add_correspondence(img_c.mean(axis=0),
                                   arena_corners[:, :2].mean(axis=0))
    reg.compute_extrinsics(calib.camera_matrix, calib.dist_coeffs)
    reg.learn_references(dets, calib.camera_matrix, calib.dist_coeffs,
                         exclude_ids=[demo.ROBOT_ID])
    reg.recover_extrinsics(dets, calib.camera_matrix, calib.dist_coeffs)
    return demo, det, calib, reg, det_by_id


def test_demo_detects_all_markers():
    demo, det, *_ = _setup_demo_pipeline()
    frame = demo.render()
    ids = sorted(m.marker_id for m in det.detect(frame))
    assert ids == [0, 10, 11, 12, 13]


def test_demo_camera_pose_recovered():
    demo, det, calib, reg, _ = _setup_demo_pipeline()
    ext = reg.data.extrinsics()
    assert ext is not None
    cam = ext.camera_position_arena().ravel()
    # ground truth virtual camera: (1000, -1200, 2400) mm
    assert cam[0] == pytest.approx(1000, abs=60)
    assert cam[1] == pytest.approx(-1200, abs=80)
    assert cam[2] == pytest.approx(2400, abs=80)


def test_demo_robot_pose_within_arena():
    demo, det, calib, reg, det_by_id = _setup_demo_pipeline()
    est = RobotPoseEstimator(RobotConfig(
        marker_id=demo.ROBOT_ID, marker_length_mm=demo.MARKER_LEN,
        marker_height_mm=demo.ROBOT_HEIGHT))
    pose = est.estimate(det_by_id[demo.ROBOT_ID], calib.camera_matrix,
                        calib.dist_coeffs, reg.data.extrinsics())
    assert pose.marker_visible
    assert 0 <= pose.x_mm <= demo.ARENA_W
    assert 0 <= pose.y_mm <= demo.ARENA_H
    # robot marker sits at ROBOT_HEIGHT above the floor
    assert pose.raw_z_mm == pytest.approx(demo.ROBOT_HEIGHT, abs=25)
    assert pose.reprojection_error_px < 2.0
    assert pose.pose_confidence > 0.5


# ---------------------------------------------------------------------------
# marker -> robot centre offset
# ---------------------------------------------------------------------------
def test_apply_marker_offset_forward():
    cfg = RobotConfig(offset_x_mm=100, offset_y_mm=0, offset_heading_deg=0)
    # heading 0 -> forward +X ; offset 100 forward moves +X
    x, y, h = apply_marker_offset(0, 0, 0, cfg)
    assert x == pytest.approx(100, abs=1e-6)
    assert y == pytest.approx(0, abs=1e-6)
    assert h == pytest.approx(0)


def test_apply_marker_offset_lateral_and_heading():
    cfg = RobotConfig(offset_x_mm=0, offset_y_mm=50, offset_heading_deg=90)
    # right of +X forward is +Y
    x, y, h = apply_marker_offset(0, 0, 0, cfg)
    assert x == pytest.approx(0, abs=1e-6)
    assert y == pytest.approx(50, abs=1e-6)
    assert h == pytest.approx(90)
