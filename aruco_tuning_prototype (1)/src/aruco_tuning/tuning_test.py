"""Tuning test state machine and result calculation.

State machine
-------------
``READY -> NEW_TEST -> CAPTURING_START -> RECORDING -> CAPTURING_END
        -> RESULT -> SAVED | DISCARDED``

The class does not touch the camera or GUI directly - the controller feeds it
:class:`RobotPose` samples and calls the transition methods. This keeps the
whole state machine unit-testable.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np

from . import geometry
from .models import (CaptureStats, RobotPose, TestConfig, TestResult,
                     TestState)


# Allowed transitions.
_TRANSITIONS: Dict[TestState, List[TestState]] = {
    TestState.READY: [TestState.NEW_TEST],
    TestState.NEW_TEST: [TestState.CAPTURING_START, TestState.DISCARDED],
    TestState.CAPTURING_START: [TestState.RECORDING, TestState.DISCARDED],
    TestState.RECORDING: [TestState.CAPTURING_END, TestState.DISCARDED],
    TestState.CAPTURING_END: [TestState.RESULT, TestState.DISCARDED],
    TestState.RESULT: [TestState.SAVED, TestState.DISCARDED],
    TestState.SAVED: [TestState.READY],
    TestState.DISCARDED: [TestState.READY],
}


@dataclass
class StabilityThresholds:
    max_std_position_mm: float = 3.0
    max_std_heading_deg: float = 1.5
    min_samples: int = 10


def compute_capture_stats(
    poses: List[RobotPose],
    thresholds: Optional[StabilityThresholds] = None,
) -> CaptureStats:
    """Aggregate a set of stationary poses into robust mean/median/std."""
    thr = thresholds or StabilityThresholds()
    visible = [p for p in poses if p.marker_visible]
    stats = CaptureStats(num_samples=len(visible))
    if not visible:
        stats.warning = "Nenhuma amostra com marcador visível"
        return stats

    xy = np.array([[p.x_mm, p.y_mm] for p in visible], dtype=float)
    headings = np.array([p.heading_deg for p in visible], dtype=float)
    z = np.array([p.raw_z_mm for p in visible], dtype=float)

    inliers = geometry.remove_outliers(xy, n_sigma=2.0)
    if inliers.sum() < max(3, thr.min_samples // 2):
        inliers = np.ones(len(visible), dtype=bool)  # keep all if too few

    xy_in = xy[inliers]
    head_in = headings[inliers]
    z_in = z[inliers]

    stats.num_inliers = int(inliers.sum())
    stats.x_mm = float(np.median(xy_in[:, 0]))
    stats.y_mm = float(np.median(xy_in[:, 1]))
    stats.heading_deg = geometry.circular_mean_deg(head_in)
    stats.z_mm = float(np.median(z_in))
    stats.std_x_mm = float(np.std(xy_in[:, 0]))
    stats.std_y_mm = float(np.std(xy_in[:, 1]))
    stats.std_heading_deg = geometry.circular_std_deg(head_in)

    warnings = []
    if stats.num_samples < thr.min_samples:
        warnings.append(
            f"Poucas amostras ({stats.num_samples} < {thr.min_samples})")
    pos_std = max(stats.std_x_mm, stats.std_y_mm)
    stats.stable = (
        pos_std <= thr.max_std_position_mm
        and stats.std_heading_deg <= thr.max_std_heading_deg
        and stats.num_samples >= thr.min_samples
    )
    if pos_std > thr.max_std_position_mm:
        warnings.append(
            f"Posição instável (desvio {pos_std:.1f} mm > "
            f"{thr.max_std_position_mm} mm)")
    if stats.std_heading_deg > thr.max_std_heading_deg:
        warnings.append(
            f"Direção instável (desvio {stats.std_heading_deg:.1f}° > "
            f"{thr.max_std_heading_deg}°)")
    stats.warning = "; ".join(warnings)
    return stats


def compute_test_result(
    start: CaptureStats,
    end: CaptureStats,
    trajectory: List[RobotPose],
    config: TestConfig,
) -> TestResult:
    """Compute longitudinal / lateral / heading errors and path statistics."""
    result = TestResult()

    initial = np.array([start.x_mm, start.y_mm], dtype=float)
    final = np.array([end.x_mm, end.y_mm], dtype=float)

    forward = geometry.heading_to_vector(start.heading_deg)
    lateral = geometry.perpendicular_right(forward)  # +right

    displacement = final - initial
    longitudinal = float(np.dot(displacement, forward))
    lateral_dev = float(np.dot(displacement, lateral))

    result.longitudinal_distance_mm = longitudinal
    result.longitudinal_error_mm = longitudinal - config.requested_distance_mm
    result.lateral_deviation_mm = lateral_dev
    result.total_displacement_mm = float(np.linalg.norm(displacement))

    result.heading_error_deg = geometry.normalize_angle_deg(
        end.heading_deg - start.heading_deg - config.target_heading_change_deg)

    # duration / average speed from trajectory (fallback to captures)
    visible = [p for p in trajectory if p.marker_visible]
    if len(visible) >= 2:
        duration = visible[-1].timestamp - visible[0].timestamp
    else:
        duration = 0.0
    result.duration_s = float(max(0.0, duration))
    if result.duration_s > 1e-6:
        result.average_speed_mm_s = (
            result.total_displacement_mm / result.duration_s)

    # max lateral / heading error along the path (relative to ideal line)
    max_lat = 0.0
    max_head = 0.0
    for p in visible:
        d = np.array([p.x_mm, p.y_mm]) - initial
        lat = abs(float(np.dot(d, lateral)))
        max_lat = max(max_lat, lat)
        he = abs(geometry.angle_difference_deg(p.heading_deg, start.heading_deg))
        max_head = max(max_head, he)
    result.max_lateral_error_mm = max_lat
    result.max_heading_error_deg = max_head
    return result


class TuningTest:
    """Stateful controller for a single tuning test run."""

    def __init__(self, thresholds: Optional[StabilityThresholds] = None):
        self.state = TestState.READY
        self.config: Optional[TestConfig] = None
        self.thresholds = thresholds or StabilityThresholds()

        self.start_samples: List[RobotPose] = []
        self.end_samples: List[RobotPose] = []
        self.trajectory: List[RobotPose] = []

        self.start_stats: Optional[CaptureStats] = None
        self.end_stats: Optional[CaptureStats] = None
        self.result: Optional[TestResult] = None
        self.events: List[Tuple[float, str, str]] = []

    # ------------------------------------------------------------------
    def can_transition(self, target: TestState) -> bool:
        return target in _TRANSITIONS.get(self.state, [])

    def _transition(self, target: TestState, timestamp: float = 0.0) -> None:
        if not self.can_transition(target):
            raise ValueError(
                f"Transição inválida: {self.state.value} -> {target.value}")
        self.events.append((timestamp, self.state.value, target.value))
        self.state = target

    # ------------------------------------------------------------------
    def new_test(self, config: TestConfig, timestamp: float = 0.0) -> None:
        if self.state not in (TestState.READY,):
            # allow starting a new test from a terminal state
            if self.state in (TestState.SAVED, TestState.DISCARDED):
                self.state = TestState.READY
        self.reset(keep_state=True)
        self.config = config
        self._transition(TestState.NEW_TEST, timestamp)

    def begin_start_capture(self, timestamp: float = 0.0) -> None:
        self.start_samples.clear()
        self._transition(TestState.CAPTURING_START, timestamp)

    def add_start_sample(self, pose: RobotPose) -> None:
        if self.state == TestState.CAPTURING_START:
            self.start_samples.append(pose)

    def finalize_start_capture(self, timestamp: float = 0.0) -> CaptureStats:
        self.start_stats = compute_capture_stats(
            self.start_samples, self.thresholds)
        self._transition(TestState.RECORDING, timestamp)
        return self.start_stats

    def add_trajectory_sample(self, pose: RobotPose) -> None:
        if self.state == TestState.RECORDING:
            self.trajectory.append(pose)

    def begin_end_capture(self, timestamp: float = 0.0) -> None:
        self.end_samples.clear()
        self._transition(TestState.CAPTURING_END, timestamp)

    def add_end_sample(self, pose: RobotPose) -> None:
        if self.state == TestState.CAPTURING_END:
            self.end_samples.append(pose)

    def finalize_end_capture(self, timestamp: float = 0.0) -> TestResult:
        self.end_stats = compute_capture_stats(
            self.end_samples, self.thresholds)
        self.result = compute_test_result(
            self.start_stats, self.end_stats, self.trajectory, self.config)
        self._transition(TestState.RESULT, timestamp)
        return self.result

    def save(self, timestamp: float = 0.0) -> None:
        self._transition(TestState.SAVED, timestamp)

    def discard(self, timestamp: float = 0.0) -> None:
        self._transition(TestState.DISCARDED, timestamp)

    def to_ready(self, timestamp: float = 0.0) -> None:
        if self.state in (TestState.SAVED, TestState.DISCARDED):
            self._transition(TestState.READY, timestamp)

    # ------------------------------------------------------------------
    def reset(self, keep_state: bool = False) -> None:
        self.start_samples.clear()
        self.end_samples.clear()
        self.trajectory.clear()
        self.start_stats = None
        self.end_stats = None
        self.result = None
        if not keep_state:
            self.state = TestState.READY
            self.events.clear()
