"""Robot pose estimation from a single square ArUco marker.

Pipeline
--------
1. ``solvePnP(SOLVEPNP_IPPE_SQUARE)`` on the 4 refined marker corners + the
   known marker side length + camera intrinsics gives the marker pose in the
   **camera** frame (rvec_m, tvec_m).
2. Using the arena extrinsics we produce two arena-space results:
   * **raw 3D pose** - the marker centre transformed camera -> arena (keeps
     the PnP Z, useful for diagnostics / Z deviation).
   * **XY-stabilised pose** - the marker centre image point back-projected
     onto the plane ``z = marker_height_mm``. This removes most of the PnP Z
     jitter and is what the tests / arena view use.
3. The marker-to-robot offset (planar XY + heading) is applied to obtain the
   robot centre.

Heading convention: the robot heading is the direction of the marker's local
+X axis projected onto the arena floor (degrees, arena convention: 0 = +X
right, +90 = +Y down), plus the configured angular offset.

Smoothing (:class:`PoseSmoother`) is **display only** - raw values are always
preserved and saved.
"""

from __future__ import annotations

import math
import time
from typing import Optional

import cv2
import numpy as np

from . import geometry
from .arena_registration import CameraExtrinsics
from .models import MarkerDetection, RobotConfig, RobotPose


def _marker_object_points(side_mm: float) -> np.ndarray:
    """Object points for IPPE_SQUARE, corner order TL, TR, BR, BL."""
    h = side_mm / 2.0
    return np.array([
        [-h, h, 0.0],
        [h, h, 0.0],
        [h, -h, 0.0],
        [-h, -h, 0.0],
    ], dtype=np.float32)


class RobotPoseEstimator:
    """Estimate arena-space robot pose from a marker detection."""

    def __init__(self, robot_config: Optional[RobotConfig] = None):
        self.robot_config = robot_config or RobotConfig()

    # ------------------------------------------------------------------
    def estimate(
        self,
        detection: Optional[MarkerDetection],
        camera_matrix: np.ndarray,
        dist_coeffs: np.ndarray,
        extrinsics: Optional[CameraExtrinsics],
        frame_index: int = 0,
        timestamp: Optional[float] = None,
        arena_reference_count: int = 0,
    ) -> RobotPose:
        ts = time.time() if timestamp is None else timestamp
        pose = RobotPose(
            timestamp=ts, frame_index=frame_index,
            marker_visible=detection is not None,
            arena_reference_count=arena_reference_count,
        )
        if detection is None or extrinsics is None:
            return pose

        cfg = self.robot_config
        obj = _marker_object_points(cfg.marker_length_mm)
        img = detection.corners.reshape(4, 2).astype(np.float32)

        ok, rvec, tvec = cv2.solvePnP(
            obj, img, camera_matrix, dist_coeffs,
            flags=cv2.SOLVEPNP_IPPE_SQUARE)
        if not ok:
            return pose

        # --- reprojection error -------------------------------------
        proj, _ = cv2.projectPoints(
            obj, rvec, tvec, camera_matrix, dist_coeffs)
        proj = proj.reshape(-1, 2)
        reproj_err = float(np.sqrt(np.mean(np.sum((proj - img) ** 2, axis=1))))
        pose.reprojection_error_px = reproj_err

        R_m, _ = cv2.Rodrigues(rvec)  # marker -> camera

        # --- raw 3D pose (camera -> arena) --------------------------
        marker_center_cam = tvec.reshape(3)
        raw_arena = extrinsics.camera_to_arena(marker_center_cam).reshape(3)
        pose.raw_x_mm = float(raw_arena[0])
        pose.raw_y_mm = float(raw_arena[1])
        pose.raw_z_mm = float(raw_arena[2])

        # --- heading / pitch / roll in arena ------------------------
        R_marker_in_arena = extrinsics.R.T @ R_m
        forward_arena = R_marker_in_arena @ np.array([1.0, 0.0, 0.0])
        heading = geometry.vector_to_heading(forward_arena[:2])
        yaw, pitch, roll = geometry.rotation_matrix_to_euler_deg(
            R_marker_in_arena)
        pose.pitch_deg = float(pitch)
        pose.roll_deg = float(roll)

        # --- XY stabilised pose (back-project centre to marker plane)
        center_img = detection.center.reshape(1, 2)
        stabilised = extrinsics.image_to_arena_plane(
            center_img, camera_matrix, dist_coeffs,
            plane_z=cfg.marker_height_mm)
        sx, sy = float(stabilised[0, 0]), float(stabilised[0, 1])

        # --- apply marker -> robot offset (planar) ------------------
        heading_with_offset = geometry.normalize_angle_deg(
            heading + cfg.offset_heading_deg)
        fwd = geometry.heading_to_vector(heading_with_offset)
        right = geometry.perpendicular_right(fwd)
        robot_x = sx + cfg.offset_x_mm * fwd[0] + cfg.offset_y_mm * right[0]
        robot_y = sy + cfg.offset_x_mm * fwd[1] + cfg.offset_y_mm * right[1]

        pose.x_mm = robot_x
        pose.y_mm = robot_y
        pose.heading_deg = heading_with_offset

        # --- confidence metrics -------------------------------------
        pose.z_deviation_mm = float(raw_arena[2] - cfg.marker_height_mm)
        pose.pose_confidence = self._confidence(
            reproj_err, pose.z_deviation_mm, detection)
        return pose

    @staticmethod
    def _confidence(reproj_err: float, z_dev_mm: float,
                    detection: MarkerDetection) -> float:
        """Heuristic 0..1 confidence from reprojection, Z deviation, blur."""
        # reprojection: 0 px -> 1.0, 4 px -> ~0
        c_reproj = math.exp(-reproj_err / 2.0)
        # z deviation: 0 mm -> 1.0, 50 mm -> ~0.37
        c_z = math.exp(-abs(z_dev_mm) / 50.0)
        c_blur = 0.5 if detection.is_blurred else 1.0
        conf = c_reproj * c_z * c_blur
        return float(max(0.0, min(1.0, conf)))


class PoseSmoother:
    """Exponential moving average smoother for *display only*.

    Never feed smoothed values back into stored/raw results.
    """

    def __init__(self, alpha: float = 0.35):
        self.alpha = float(alpha)
        self._x: Optional[float] = None
        self._y: Optional[float] = None
        self._heading_vec: Optional[np.ndarray] = None

    def reset(self) -> None:
        self._x = self._y = None
        self._heading_vec = None

    def update(self, pose: RobotPose) -> RobotPose:
        if not pose.marker_visible:
            return pose
        a = self.alpha
        if self._x is None:
            self._x, self._y = pose.x_mm, pose.y_mm
            self._heading_vec = geometry.heading_to_vector(pose.heading_deg)
        else:
            self._x = a * pose.x_mm + (1 - a) * self._x
            self._y = a * pose.y_mm + (1 - a) * self._y
            new_vec = geometry.heading_to_vector(pose.heading_deg)
            self._heading_vec = a * new_vec + (1 - a) * self._heading_vec

        smoothed = RobotPose(**{**pose.__dict__})
        smoothed.x_mm = float(self._x)
        smoothed.y_mm = float(self._y)
        smoothed.heading_deg = geometry.vector_to_heading(self._heading_vec)
        return smoothed


def apply_marker_offset(x_mm: float, y_mm: float, heading_deg: float,
                        cfg: RobotConfig) -> tuple:
    """Standalone helper (used by tests) mirroring the offset application."""
    fwd = geometry.heading_to_vector(heading_deg)
    right = geometry.perpendicular_right(fwd)
    rx = x_mm + cfg.offset_x_mm * fwd[0] + cfg.offset_y_mm * right[0]
    ry = y_mm + cfg.offset_x_mm * fwd[1] + cfg.offset_y_mm * right[1]
    rh = geometry.normalize_angle_deg(heading_deg + cfg.offset_heading_deg)
    return rx, ry, rh
