"""Shared dataclasses and enums used across the package.

Centralising the cross-cutting data models here avoids circular imports
between the camera / arena / pose / test / persistence layers.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Dict, List, Optional, Tuple

import numpy as np


# ---------------------------------------------------------------------------
# Camera
# ---------------------------------------------------------------------------
@dataclass
class CameraConfig:
    """User configurable camera parameters."""

    name: str = "Logitech C920"
    source_type: str = "camera"  # camera | file | demo
    index: int = 0
    file_path: str = ""
    backend: str = "auto"  # auto | dshow | msmf | v4l2
    width: int = 1920
    height: int = 1080
    fps: int = 30

    autofocus: bool = True
    focus: int = 0  # 0..255 (C920), used when autofocus is False
    autoexposure: bool = True
    exposure: int = -6  # log2 seconds on many UVC drivers (only used when autoexposure is False)
    gain: int = 0
    brightness: int = 128

    def to_dict(self) -> Dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: Dict) -> "CameraConfig":
        known = {k: v for k, v in (d or {}).items() if k in cls.__annotations__}
        return cls(**known)


@dataclass
class CameraState:
    """Actual (obtained) camera values reported after opening."""

    connected: bool = False
    actual_width: int = 0
    actual_height: int = 0
    actual_fps: float = 0.0
    measured_fps: float = 0.0
    backend_name: str = ""
    supported_controls: Dict[str, bool] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Calibration
# ---------------------------------------------------------------------------
@dataclass
class CalibrationData:
    """Intrinsic calibration results."""

    camera_matrix: Optional[np.ndarray] = None  # 3x3
    dist_coeffs: Optional[np.ndarray] = None  # 1xN
    image_width: int = 0
    image_height: int = 0
    rms_error: float = 0.0
    per_view_errors: List[float] = field(default_factory=list)
    num_views: int = 0
    board_spec: Dict = field(default_factory=dict)
    created: float = field(default_factory=time.time)

    @property
    def is_valid(self) -> bool:
        return (
            self.camera_matrix is not None
            and self.dist_coeffs is not None
            and self.image_width > 0
            and self.image_height > 0
        )


# ---------------------------------------------------------------------------
# Arena / zones
# ---------------------------------------------------------------------------
@dataclass
class Zone:
    """A polygonal region inside the arena (read-only from YAML)."""

    id: str
    name: str = ""
    type: str = "generic"  # start | target | obstacle | generic ...
    color: str = "#3498db"
    polygon: List[Tuple[float, float]] = field(default_factory=list)  # mm

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "color": self.color,
            "polygon": [[float(x), float(y)] for x, y in self.polygon],
        }

    @classmethod
    def from_dict(cls, d: Dict) -> "Zone":
        poly = [tuple(map(float, p)) for p in d.get("polygon", [])]
        return cls(
            id=str(d.get("id", "")),
            name=d.get("name", ""),
            type=d.get("type", "generic"),
            color=d.get("color", "#3498db"),
            polygon=poly,
        )


# ---------------------------------------------------------------------------
# Robot / marker
# ---------------------------------------------------------------------------
@dataclass
class RobotConfig:
    """Robot + marker geometry."""

    name: str = "Robot 1"
    marker_dictionary: str = "DICT_4X4_50"
    marker_id: int = 0
    marker_length_mm: float = 80.0  # outer black border to outer black border
    white_margin_mm: float = 10.0  # for printing only
    marker_height_mm: float = 60.0  # marker plane height above arena floor

    # marker -> robot-centre offset expressed in the marker frame (mm)
    offset_x_mm: float = 0.0
    offset_y_mm: float = 0.0
    offset_heading_deg: float = 0.0

    # physical robot footprint for drawing (mm)
    robot_width_mm: float = 150.0
    robot_length_mm: float = 200.0

    def to_dict(self) -> Dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: Dict) -> "RobotConfig":
        known = {k: v for k, v in (d or {}).items() if k in cls.__annotations__}
        return cls(**known)


# ---------------------------------------------------------------------------
# Detection / pose
# ---------------------------------------------------------------------------
@dataclass
class MarkerDetection:
    """Single ArUco marker detection in an image."""

    marker_id: int
    corners: np.ndarray  # 4x2 float32, image pixels (refined)
    sharpness: float = 0.0  # higher = sharper (blur metric)
    is_blurred: bool = False

    @property
    def center(self) -> np.ndarray:
        return np.mean(self.corners, axis=0)

    @property
    def apparent_size_px(self) -> float:
        c = self.corners
        d1 = np.linalg.norm(c[0] - c[1])
        d2 = np.linalg.norm(c[1] - c[2])
        d3 = np.linalg.norm(c[2] - c[3])
        d4 = np.linalg.norm(c[3] - c[0])
        return float((d1 + d2 + d3 + d4) / 4.0)


@dataclass
class RobotPose:
    """Full 6DOF robot pose plus arena-space projection."""

    timestamp: float = 0.0
    frame_index: int = 0
    marker_visible: bool = False

    # raw camera-frame pose
    raw_x_mm: float = 0.0
    raw_y_mm: float = 0.0
    raw_z_mm: float = 0.0

    # arena-space pose (robot centre after offset)
    x_mm: float = 0.0
    y_mm: float = 0.0
    heading_deg: float = 0.0
    pitch_deg: float = 0.0
    roll_deg: float = 0.0

    reprojection_error_px: float = 0.0
    pose_confidence: float = 0.0
    z_deviation_mm: float = 0.0
    arena_reference_count: int = 0

    def to_csv_row(self) -> Dict:
        return {
            "frame": self.frame_index,
            "timestamp_seconds": round(self.timestamp, 6),
            "raw_x_mm": round(self.raw_x_mm, 3),
            "raw_y_mm": round(self.raw_y_mm, 3),
            "raw_z_mm": round(self.raw_z_mm, 3),
            "x_mm": round(self.x_mm, 3),
            "y_mm": round(self.y_mm, 3),
            "heading_deg": round(self.heading_deg, 4),
            "pitch_deg": round(self.pitch_deg, 4),
            "roll_deg": round(self.roll_deg, 4),
            "reprojection_error_px": round(self.reprojection_error_px, 4),
            "pose_confidence": round(self.pose_confidence, 4),
            "marker_visible": int(self.marker_visible),
            "arena_reference_count": self.arena_reference_count,
        }


# ---------------------------------------------------------------------------
# Test state machine
# ---------------------------------------------------------------------------
class TestState(Enum):
    READY = "READY"
    NEW_TEST = "NEW_TEST"
    CAPTURING_START = "CAPTURING_START"
    RECORDING = "RECORDING"
    CAPTURING_END = "CAPTURING_END"
    RESULT = "RESULT"
    SAVED = "SAVED"
    DISCARDED = "DISCARDED"


@dataclass
class TestConfig:
    """Configuration for a single tuning test."""

    name: str = "test"
    session: str = "default_session"
    requested_distance_mm: float = 1000.0
    target_heading_change_deg: float = 0.0
    max_velocity: float = 0.0  # mm/s or robot units - free form
    acceleration: float = 0.0
    deceleration: float = 0.0
    p_factor: Optional[float] = None
    battery: str = ""
    notes: str = ""
    record_video: bool = True

    def to_dict(self) -> Dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: Dict) -> "TestConfig":
        known = {k: v for k, v in (d or {}).items() if k in cls.__annotations__}
        return cls(**known)


@dataclass
class CaptureStats:
    """Result of a start/end stationary capture."""

    x_mm: float = 0.0
    y_mm: float = 0.0
    heading_deg: float = 0.0
    z_mm: float = 0.0
    std_x_mm: float = 0.0
    std_y_mm: float = 0.0
    std_heading_deg: float = 0.0
    num_samples: int = 0
    num_inliers: int = 0
    stable: bool = False
    warning: str = ""

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class TestResult:
    """Computed result of a tuning test."""

    longitudinal_distance_mm: float = 0.0
    longitudinal_error_mm: float = 0.0
    lateral_deviation_mm: float = 0.0
    heading_error_deg: float = 0.0
    total_displacement_mm: float = 0.0
    duration_s: float = 0.0
    average_speed_mm_s: float = 0.0
    max_lateral_error_mm: float = 0.0
    max_heading_error_deg: float = 0.0

    def to_dict(self) -> Dict:
        return asdict(self)
