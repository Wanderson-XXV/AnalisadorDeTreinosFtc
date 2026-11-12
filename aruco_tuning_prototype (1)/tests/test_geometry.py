"""Unit tests for the pure geometry helpers."""

import math

import numpy as np
import pytest

from aruco_tuning import geometry as g


# ---------------------------------------------------------------------------
# angle normalisation
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("angle,expected", [
    (0, 0), (180, 180), (-180, 180), (190, -170), (360, 0), (540, 180),
    (-370, -10),
])
def test_normalize_angle_deg(angle, expected):
    assert g.normalize_angle_deg(angle) == pytest.approx(expected)


def test_normalize_angle_360():
    assert g.normalize_angle_360(-10) == pytest.approx(350)
    assert g.normalize_angle_360(370) == pytest.approx(10)


def test_angle_difference_wraps():
    assert g.angle_difference_deg(170, -170) == pytest.approx(-20)
    assert g.angle_difference_deg(-170, 170) == pytest.approx(20)


# ---------------------------------------------------------------------------
# heading <-> vector
# ---------------------------------------------------------------------------
def test_heading_to_vector_conventions():
    # heading 0 -> +X ; heading 90 -> +Y (down)
    assert np.allclose(g.heading_to_vector(0), [1, 0], atol=1e-9)
    assert np.allclose(g.heading_to_vector(90), [0, 1], atol=1e-9)
    assert np.allclose(g.heading_to_vector(180), [-1, 0], atol=1e-9)


def test_vector_to_heading_roundtrip():
    for h in (-135, -90, 0, 45, 90, 179):
        v = g.heading_to_vector(h)
        assert g.normalize_angle_deg(g.vector_to_heading(v)) == pytest.approx(
            g.normalize_angle_deg(h), abs=1e-6)


def test_perpendicular_right():
    # forward +X (right) -> right is +Y (down): (x,y)->(-y,x)
    assert np.allclose(g.perpendicular_right([1, 0]), [0, 1], atol=1e-9)
    assert np.allclose(g.perpendicular_right([0, 1]), [-1, 0], atol=1e-9)


# ---------------------------------------------------------------------------
# homography
# ---------------------------------------------------------------------------
def test_apply_homography_identity():
    H = np.eye(3)
    pts = np.array([[1.0, 2.0], [3.0, 4.0]])
    assert np.allclose(g.apply_homography(H, pts), pts)


def test_homography_translation_and_residuals():
    H = np.array([[1, 0, 10], [0, 1, -5], [0, 0, 1]], dtype=float)
    src = np.array([[0.0, 0.0], [2.0, 2.0]])
    dst = np.array([[10.0, -5.0], [12.0, -3.0]])
    assert np.allclose(g.apply_homography(H, src), dst)
    assert np.allclose(g.homography_residuals(H, src, dst), [0, 0], atol=1e-9)


# ---------------------------------------------------------------------------
# rotation decomposition
# ---------------------------------------------------------------------------
def test_rotation_matrix_to_euler_zero():
    yaw, pitch, roll = g.rotation_matrix_to_euler_deg(np.eye(3))
    assert (yaw, pitch, roll) == pytest.approx((0, 0, 0))


def test_rvec_to_euler_yaw():
    # rotation of 30 deg about Z should give yaw 30
    rvec = np.array([0, 0, math.radians(30)])
    yaw, pitch, roll = g.rvec_to_euler_deg(rvec)
    assert yaw == pytest.approx(30, abs=1e-6)


# ---------------------------------------------------------------------------
# statistics
# ---------------------------------------------------------------------------
def test_remove_outliers_scalar():
    vals = np.array([10, 10.1, 9.9, 10.2, 50.0])  # last is outlier
    mask = g.remove_outliers(vals, n_sigma=2.0)
    assert mask[:4].all()
    assert not mask[4]


def test_circular_mean_and_std_wrap():
    # angles around +/-180 should average to 180, not 0
    ang = [170, -170, 175, -175]
    m = g.normalize_angle_deg(g.circular_mean_deg(ang))
    assert abs(m) > 170
    assert g.circular_std_deg([10, 10, 10]) == pytest.approx(0, abs=1e-6)
