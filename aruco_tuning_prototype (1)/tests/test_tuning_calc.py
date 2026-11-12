"""Tests for capture statistics and test-result calculation."""

import numpy as np
import pytest

from aruco_tuning.models import RobotPose, TestConfig
from aruco_tuning.tuning_test import (StabilityThresholds, compute_capture_stats,
                                      compute_test_result)


def _pose(x, y, h=0.0, z=60.0, t=0.0, visible=True):
    return RobotPose(timestamp=t, marker_visible=visible, x_mm=x, y_mm=y,
                     raw_z_mm=z, heading_deg=h)


def test_capture_stats_stable_cluster():
    poses = [_pose(100 + np.random.uniform(-0.5, 0.5),
                   200 + np.random.uniform(-0.5, 0.5), 45.0)
             for _ in range(20)]
    stats = compute_capture_stats(poses, StabilityThresholds())
    assert stats.num_samples == 20
    assert stats.x_mm == pytest.approx(100, abs=2)
    assert stats.y_mm == pytest.approx(200, abs=2)
    assert stats.heading_deg == pytest.approx(45, abs=2)
    assert stats.stable is True
    assert stats.warning == ""


def test_capture_stats_flags_instability():
    poses = [_pose(100 + i * 5, 200, 0.0) for i in range(12)]  # big spread
    stats = compute_capture_stats(poses, StabilityThresholds())
    assert stats.stable is False
    assert "instável" in stats.warning.lower()


def test_capture_stats_no_visible():
    poses = [_pose(0, 0, visible=False) for _ in range(5)]
    stats = compute_capture_stats(poses)
    assert stats.num_samples == 0
    assert stats.warning


def test_capture_stats_outlier_rejected():
    poses = [_pose(100, 100, 0.0) for _ in range(15)]
    poses.append(_pose(9999, 9999, 0.0))  # gross outlier
    stats = compute_capture_stats(poses)
    assert stats.x_mm == pytest.approx(100, abs=1)
    assert stats.y_mm == pytest.approx(100, abs=1)


def test_result_pure_longitudinal():
    start = compute_capture_stats([_pose(0, 0, 0.0) for _ in range(12)])
    end = compute_capture_stats([_pose(1000, 0, 0.0) for _ in range(12)])
    traj = [_pose(i * 100, 0, 0.0, t=i * 0.1) for i in range(11)]
    cfg = TestConfig(requested_distance_mm=1000)
    res = compute_test_result(start, end, traj, cfg)
    assert res.longitudinal_distance_mm == pytest.approx(1000, abs=1)
    assert res.longitudinal_error_mm == pytest.approx(0, abs=1)
    assert res.lateral_deviation_mm == pytest.approx(0, abs=1)


def test_result_longitudinal_error_and_lateral():
    # heading 0 -> forward is +X, right is +Y
    start = compute_capture_stats([_pose(0, 0, 0.0) for _ in range(12)])
    end = compute_capture_stats([_pose(950, 30, 0.0) for _ in range(12)])
    traj = [_pose(0, 0, 0.0, t=0), _pose(950, 30, 0.0, t=1)]
    cfg = TestConfig(requested_distance_mm=1000)
    res = compute_test_result(start, end, traj, cfg)
    assert res.longitudinal_distance_mm == pytest.approx(950, abs=1)
    assert res.longitudinal_error_mm == pytest.approx(-50, abs=1)
    assert res.lateral_deviation_mm == pytest.approx(30, abs=1)


def test_result_heading_error():
    start = compute_capture_stats([_pose(0, 0, 0.0) for _ in range(12)])
    end = compute_capture_stats([_pose(0, 0, 88.0) for _ in range(12)])
    traj = [_pose(0, 0, 0.0, t=0), _pose(0, 0, 88.0, t=1)]
    cfg = TestConfig(requested_distance_mm=0, target_heading_change_deg=90)
    res = compute_test_result(start, end, traj, cfg)
    assert res.heading_error_deg == pytest.approx(-2, abs=1)


def test_result_duration_and_speed():
    start = compute_capture_stats([_pose(0, 0, 0.0) for _ in range(12)])
    end = compute_capture_stats([_pose(200, 0, 0.0) for _ in range(12)])
    traj = [_pose(0, 0, 0.0, t=0.0), _pose(200, 0, 0.0, t=2.0)]
    res = compute_test_result(start, end, traj, TestConfig())
    assert res.duration_s == pytest.approx(2.0, abs=1e-6)
    assert res.average_speed_mm_s == pytest.approx(100.0, abs=1)
