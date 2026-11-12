"""Pure geometric / math helpers.

Everything here is framework independent (only numpy + a little OpenCV for
Rodrigues) so it can be unit tested without a camera or GUI.

Conventions
-----------
* Arena coordinate system: origin top-left, X to the right, Y downwards,
  units in millimetres.
* Angles are stored/returned in **degrees** unless the function name says
  otherwise, and headings are measured from the arena +X axis, increasing
  towards +Y (i.e. clockwise on screen).
"""

from __future__ import annotations

import math
from typing import Sequence, Tuple

import numpy as np

try:  # OpenCV is optional for the pure-python helpers below
    import cv2
except Exception:  # pragma: no cover - cv2 always present in this project
    cv2 = None


# ---------------------------------------------------------------------------
# Angle helpers
# ---------------------------------------------------------------------------
def normalize_angle_deg(angle: float) -> float:
    """Normalise an angle in degrees to the half-open range (-180, 180]."""
    a = (float(angle) + 180.0) % 360.0 - 180.0
    # ``% 360`` maps -180 to -180; we want the range (-180, 180]
    if a == -180.0:
        a = 180.0
    return a


def normalize_angle_360(angle: float) -> float:
    """Normalise an angle in degrees to the range [0, 360)."""
    return float(angle) % 360.0


def angle_difference_deg(a: float, b: float) -> float:
    """Smallest signed difference ``a - b`` in degrees, in (-180, 180]."""
    return normalize_angle_deg(a - b)


def deg2rad(deg: float) -> float:
    return math.radians(deg)


def rad2deg(rad: float) -> float:
    return math.degrees(rad)


# ---------------------------------------------------------------------------
# 2D vector helpers
# ---------------------------------------------------------------------------
def unit_vector(vec: Sequence[float]) -> np.ndarray:
    v = np.asarray(vec, dtype=float)
    n = np.linalg.norm(v)
    if n < 1e-12:
        return np.zeros_like(v)
    return v / n


def heading_to_vector(heading_deg: float) -> np.ndarray:
    """Return the unit forward vector for a heading (deg) in arena space.

    Heading 0 points along +X (right); +90 points along +Y (down).
    """
    r = math.radians(heading_deg)
    return np.array([math.cos(r), math.sin(r)], dtype=float)


def vector_to_heading(vec: Sequence[float]) -> float:
    """Return the heading in degrees for a 2D vector (arena convention)."""
    v = np.asarray(vec, dtype=float)
    return math.degrees(math.atan2(v[1], v[0]))


def perpendicular_right(vec: Sequence[float]) -> np.ndarray:
    """Return the unit vector 90 deg clockwise (to the "right") of ``vec``.

    In arena coordinates (+X right, +Y down) rotating a vector by +90 deg
    (clockwise on screen) maps (x, y) -> (-y, x).
    """
    u = unit_vector(vec)
    return np.array([-u[1], u[0]], dtype=float)


# ---------------------------------------------------------------------------
# Homography helpers
# ---------------------------------------------------------------------------
def apply_homography(H: np.ndarray, points: np.ndarray) -> np.ndarray:
    """Apply a 3x3 homography to Nx2 points, returning Nx2 points."""
    pts = np.asarray(points, dtype=float).reshape(-1, 2)
    ones = np.ones((pts.shape[0], 1), dtype=float)
    hom = np.hstack([pts, ones])  # Nx3
    proj = (H @ hom.T).T  # Nx3
    w = proj[:, 2:3]
    w[np.abs(w) < 1e-12] = 1e-12
    out = proj[:, :2] / w
    return out


def homography_residuals(
    H: np.ndarray, src: np.ndarray, dst: np.ndarray
) -> np.ndarray:
    """Per-point reprojection error (pixels/mm) after applying ``H`` to src."""
    projected = apply_homography(H, src)
    dst = np.asarray(dst, dtype=float).reshape(-1, 2)
    return np.linalg.norm(projected - dst, axis=1)


# ---------------------------------------------------------------------------
# Rotation helpers
# ---------------------------------------------------------------------------
def rvec_to_euler_deg(rvec: np.ndarray) -> Tuple[float, float, float]:
    """Convert an OpenCV rotation vector to (yaw, pitch, roll) in degrees.

    The returned yaw is the rotation about the camera Z axis, pitch about X,
    roll about Y - this is only a convenience Euler decomposition used for
    display / diagnostics. For arena heading use :func:`marker_heading_in_arena`.
    """
    if cv2 is None:  # pragma: no cover
        raise RuntimeError("OpenCV required for rvec_to_euler_deg")
    R, _ = cv2.Rodrigues(np.asarray(rvec, dtype=float).reshape(3, 1))
    return rotation_matrix_to_euler_deg(R)


def rotation_matrix_to_euler_deg(R: np.ndarray) -> Tuple[float, float, float]:
    """Decompose a rotation matrix into (yaw, pitch, roll) degrees (ZYX)."""
    R = np.asarray(R, dtype=float)
    sy = math.sqrt(R[0, 0] ** 2 + R[1, 0] ** 2)
    singular = sy < 1e-6
    if not singular:
        roll = math.atan2(R[2, 1], R[2, 2])
        pitch = math.atan2(-R[2, 0], sy)
        yaw = math.atan2(R[1, 0], R[0, 0])
    else:  # gimbal lock
        roll = math.atan2(-R[1, 2], R[1, 1])
        pitch = math.atan2(-R[2, 0], sy)
        yaw = 0.0
    return (math.degrees(yaw), math.degrees(pitch), math.degrees(roll))


# ---------------------------------------------------------------------------
# Statistics helpers used by capture / stability checks
# ---------------------------------------------------------------------------
def remove_outliers(values: np.ndarray, n_sigma: float = 2.0) -> np.ndarray:
    """Return a boolean mask of inliers (within ``n_sigma`` of the median).

    Uses a robust median-absolute-deviation style filter on the row norms of
    2D/3D point sets, or on scalar arrays.
    """
    arr = np.asarray(values, dtype=float)
    if arr.ndim == 1:
        centre = np.median(arr)
        dev = np.abs(arr - centre)
    else:
        centre = np.median(arr, axis=0)
        dev = np.linalg.norm(arr - centre, axis=1)
    # Robust scale estimate via the median absolute deviation (MAD). Unlike a
    # plain standard deviation, the MAD is not inflated by the very outliers we
    # are trying to reject (breakdown point ~50%). The 1.4826 factor makes the
    # MAD a consistent estimator of sigma for normally distributed data.
    mad = np.median(dev)
    if mad > 1e-9:
        sigma = 1.4826 * mad
        return dev <= (n_sigma * sigma)
    # Fall back to the classic mean/std filter when the MAD collapses (e.g. more
    # than half the samples are identical).
    std = np.std(dev)
    if std < 1e-9:
        return np.ones(arr.shape[0], dtype=bool)
    return dev <= (np.mean(dev) + n_sigma * std)


def circular_mean_deg(angles_deg: Sequence[float]) -> float:
    """Circular (angular) mean of angles in degrees."""
    a = np.radians(np.asarray(angles_deg, dtype=float))
    s = np.mean(np.sin(a))
    c = np.mean(np.cos(a))
    return math.degrees(math.atan2(s, c))


def circular_std_deg(angles_deg: Sequence[float]) -> float:
    """Circular standard deviation of angles in degrees."""
    a = np.radians(np.asarray(angles_deg, dtype=float))
    s = np.mean(np.sin(a))
    c = np.mean(np.cos(a))
    r = math.hypot(s, c)
    r = min(1.0, max(1e-12, r))
    return math.degrees(math.sqrt(-2.0 * math.log(r)))
