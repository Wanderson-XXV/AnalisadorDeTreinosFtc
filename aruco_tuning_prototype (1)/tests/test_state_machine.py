"""Tests for the tuning-test state machine transitions."""

import pytest

from aruco_tuning.models import RobotPose, TestConfig, TestState
from aruco_tuning.tuning_test import TuningTest


def _pose(x=0.0, y=0.0, h=0.0, visible=True, t=0.0):
    return RobotPose(timestamp=t, marker_visible=visible, x_mm=x, y_mm=y,
                     raw_z_mm=60.0, heading_deg=h)


def test_happy_path_transitions():
    tt = TuningTest()
    assert tt.state == TestState.READY
    tt.new_test(TestConfig(requested_distance_mm=500), timestamp=1)
    assert tt.state == TestState.NEW_TEST
    tt.begin_start_capture(timestamp=2)
    assert tt.state == TestState.CAPTURING_START
    for _ in range(12):
        tt.add_start_sample(_pose(0, 0, 0))
    tt.finalize_start_capture(timestamp=3)
    assert tt.state == TestState.RECORDING
    for i in range(5):
        tt.add_trajectory_sample(_pose(i * 100, 0, 0, t=i))
    tt.begin_end_capture(timestamp=4)
    assert tt.state == TestState.CAPTURING_END
    for _ in range(12):
        tt.add_end_sample(_pose(500, 0, 0))
    result = tt.finalize_end_capture(timestamp=5)
    assert tt.state == TestState.RESULT
    assert result is not None
    tt.save(timestamp=6)
    assert tt.state == TestState.SAVED
    tt.to_ready(timestamp=7)
    assert tt.state == TestState.READY


def test_invalid_transition_raises():
    tt = TuningTest()
    # cannot record before capturing start
    with pytest.raises(ValueError):
        tt.finalize_start_capture()


def test_discard_from_any_active_state():
    tt = TuningTest()
    tt.new_test(TestConfig(), timestamp=1)
    tt.begin_start_capture(timestamp=2)
    tt.discard(timestamp=3)
    assert tt.state == TestState.DISCARDED
    tt.to_ready()
    assert tt.state == TestState.READY


def test_events_are_recorded():
    tt = TuningTest()
    tt.new_test(TestConfig(), timestamp=1)
    tt.begin_start_capture(timestamp=2)
    assert tt.events[0][1:] == ("READY", "NEW_TEST")
    assert tt.events[1][1:] == ("NEW_TEST", "CAPTURING_START")


def test_samples_only_collected_in_correct_state():
    tt = TuningTest()
    tt.new_test(TestConfig(), timestamp=1)
    # not in CAPTURING_START yet -> ignored
    tt.add_start_sample(_pose())
    assert len(tt.start_samples) == 0
    tt.begin_start_capture()
    tt.add_start_sample(_pose())
    assert len(tt.start_samples) == 1


def test_can_transition_helper():
    tt = TuningTest()
    assert tt.can_transition(TestState.NEW_TEST)
    assert not tt.can_transition(TestState.RECORDING)
