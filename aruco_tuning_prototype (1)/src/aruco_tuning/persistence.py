"""Load & save all configuration, calibration and result artefacts.

Formats
-------
* YAML for human editable configs (camera, arena, robot, registration) and
  calibration (numpy arrays stored as nested lists).
* JSON (versioned schema) for test results.
* CSV for the per-frame ``positions.csv`` and ``events.csv``.

A light session manager lays out an ``outputs/<session>/<test>/`` tree.
"""

from __future__ import annotations

import csv
import json
import os
import time
from typing import Dict, List, Optional

import numpy as np
import yaml

from .arena import ArenaConfig
from .arena_registration import LearnedReference, RegistrationData
from .camera_calibration import CharucoBoardSpec
from .models import (CalibrationData, CameraConfig, CaptureStats, RobotConfig,
                     RobotPose, TestConfig, TestResult)


RESULT_SCHEMA_VERSION = "1.0"


# ---------------------------------------------------------------------------
# low level helpers
# ---------------------------------------------------------------------------
def _ensure_dir(path: str) -> None:
    d = os.path.dirname(os.path.abspath(path))
    if d:
        os.makedirs(d, exist_ok=True)


def _write_yaml(path: str, data: Dict) -> None:
    _ensure_dir(path)
    with open(path, "w", encoding="utf-8") as fh:
        yaml.safe_dump(data, fh, sort_keys=False, allow_unicode=True)


def _read_yaml(path: str) -> Dict:
    with open(path, "r", encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


# ---------------------------------------------------------------------------
# Camera config
# ---------------------------------------------------------------------------
def save_camera_config(config: CameraConfig, path: str) -> None:
    _write_yaml(path, {"camera": config.to_dict()})


def load_camera_config(path: str) -> CameraConfig:
    d = _read_yaml(path)
    return CameraConfig.from_dict(d.get("camera", d))


# ---------------------------------------------------------------------------
# Robot config
# ---------------------------------------------------------------------------
def save_robot_config(config: RobotConfig, path: str) -> None:
    _write_yaml(path, {"robot": config.to_dict()})


def load_robot_config(path: str) -> RobotConfig:
    d = _read_yaml(path)
    return RobotConfig.from_dict(d.get("robot", d))


# ---------------------------------------------------------------------------
# Arena config
# ---------------------------------------------------------------------------
def save_arena_config(config: ArenaConfig, path: str) -> None:
    _write_yaml(path, {"arena": config.to_dict()})


def load_arena_config(path: str) -> ArenaConfig:
    d = _read_yaml(path)
    return ArenaConfig.from_dict(d.get("arena", d))


# ---------------------------------------------------------------------------
# Calibration
# ---------------------------------------------------------------------------
def save_calibration(calib: CalibrationData, path: str) -> None:
    data = {
        "calibration": {
            "camera_matrix": np.asarray(calib.camera_matrix).tolist(),
            "dist_coeffs": np.asarray(calib.dist_coeffs).reshape(-1).tolist(),
            "image_width": int(calib.image_width),
            "image_height": int(calib.image_height),
            "rms_error": float(calib.rms_error),
            "per_view_errors": [float(e) for e in calib.per_view_errors],
            "num_views": int(calib.num_views),
            "board_spec": calib.board_spec,
            "created": calib.created,
        }
    }
    _write_yaml(path, data)


def load_calibration(path: str) -> CalibrationData:
    d = _read_yaml(path).get("calibration", {})
    cam = d.get("camera_matrix")
    dist = d.get("dist_coeffs")
    return CalibrationData(
        camera_matrix=np.asarray(cam, dtype=float) if cam is not None else None,
        dist_coeffs=(np.asarray(dist, dtype=float).reshape(1, -1)
                     if dist is not None else None),
        image_width=int(d.get("image_width", 0)),
        image_height=int(d.get("image_height", 0)),
        rms_error=float(d.get("rms_error", 0.0)),
        per_view_errors=[float(e) for e in d.get("per_view_errors", [])],
        num_views=int(d.get("num_views", 0)),
        board_spec=d.get("board_spec", {}),
        created=d.get("created", time.time()),
    )


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------
def save_registration(reg: RegistrationData, path: str) -> None:
    data = {
        "registration": {
            "homography": (np.asarray(reg.homography).tolist()
                           if reg.homography is not None else None),
            "rvec": (np.asarray(reg.rvec).reshape(-1).tolist()
                     if reg.rvec is not None else None),
            "tvec": (np.asarray(reg.tvec).reshape(-1).tolist()
                     if reg.tvec is not None else None),
            "image_size": list(reg.image_size),
            "correspondences_image": [list(map(float, p))
                                      for p in reg.correspondences_image],
            "correspondences_arena": [list(map(float, p))
                                      for p in reg.correspondences_arena],
            "residuals": [float(r) for r in reg.residuals],
            "learned_references": [ref.to_dict()
                                   for ref in reg.learned_references.values()],
        }
    }
    _write_yaml(path, data)


def load_registration(path: str) -> RegistrationData:
    d = _read_yaml(path).get("registration", {})
    H = d.get("homography")
    rvec = d.get("rvec")
    tvec = d.get("tvec")
    refs = {}
    for r in d.get("learned_references", []):
        ref = LearnedReference.from_dict(r)
        refs[ref.marker_id] = ref
    return RegistrationData(
        homography=np.asarray(H, dtype=float) if H is not None else None,
        rvec=(np.asarray(rvec, dtype=float).reshape(3, 1)
              if rvec is not None else None),
        tvec=(np.asarray(tvec, dtype=float).reshape(3, 1)
              if tvec is not None else None),
        image_size=tuple(d.get("image_size", (0, 0))),
        correspondences_image=[list(map(float, p))
                               for p in d.get("correspondences_image", [])],
        correspondences_arena=[list(map(float, p))
                               for p in d.get("correspondences_arena", [])],
        residuals=[float(r) for r in d.get("residuals", [])],
        learned_references=refs,
    )


# ---------------------------------------------------------------------------
# ChArUco board spec (standalone helper)
# ---------------------------------------------------------------------------
def save_board_spec(spec: CharucoBoardSpec, path: str) -> None:
    _write_yaml(path, {"charuco_board": spec.to_dict()})


def load_board_spec(path: str) -> CharucoBoardSpec:
    d = _read_yaml(path)
    return CharucoBoardSpec.from_dict(d.get("charuco_board", d))


# ---------------------------------------------------------------------------
# Session management
# ---------------------------------------------------------------------------
class SessionManager:
    """Manage the outputs/<session>/<test> directory tree."""

    def __init__(self, base_dir: str = "outputs"):
        self.base_dir = base_dir
        os.makedirs(base_dir, exist_ok=True)

    def session_dir(self, session: str) -> str:
        d = os.path.join(self.base_dir, _safe_name(session))
        os.makedirs(d, exist_ok=True)
        return d

    def test_dir(self, session: str, test_name: str,
                 unique: bool = True) -> str:
        base = os.path.join(self.session_dir(session), _safe_name(test_name))
        path = base
        if unique:
            path = f"{base}_{time.strftime('%Y%m%d_%H%M%S')}"
        os.makedirs(path, exist_ok=True)
        return path

    def list_sessions(self) -> List[str]:
        if not os.path.isdir(self.base_dir):
            return []
        return sorted(d for d in os.listdir(self.base_dir)
                      if os.path.isdir(os.path.join(self.base_dir, d)))

    def list_tests(self, session: str) -> List[str]:
        sdir = os.path.join(self.base_dir, _safe_name(session))
        if not os.path.isdir(sdir):
            return []
        return sorted(d for d in os.listdir(sdir)
                      if os.path.isdir(os.path.join(sdir, d)))


def _safe_name(name: str) -> str:
    keep = "-_.() "
    cleaned = "".join(c if c.isalnum() or c in keep else "_"
                      for c in str(name)).strip()
    return cleaned or "unnamed"


# ---------------------------------------------------------------------------
# Test result (JSON)
# ---------------------------------------------------------------------------
def build_result_document(
    config: TestConfig,
    start_stats: CaptureStats,
    end_stats: CaptureStats,
    result: TestResult,
    video_path: str = "",
    positions_csv: str = "positions.csv",
    events_csv: str = "events.csv",
    metadata: Optional[Dict] = None,
) -> Dict:
    """Assemble the versioned result document (dict) for JSON export."""
    doc = {
        "schema_version": RESULT_SCHEMA_VERSION,
        "created": time.time(),
        "created_iso": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "config": config.to_dict(),
        "start_capture": start_stats.to_dict() if start_stats else {},
        "end_capture": end_stats.to_dict() if end_stats else {},
        "result": result.to_dict() if result else {},
        # manual measurements placeholder for future analyzer integration
        "manual": {"longitudinal": None, "lateral": None},
        "files": {
            "video": video_path,
            "positions_csv": positions_csv,
            "events_csv": events_csv,
        },
        "metadata": metadata or {},
    }
    return doc


def save_result_json(doc: Dict, path: str) -> None:
    _ensure_dir(path)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=2, ensure_ascii=False)


def load_result_json(path: str) -> Dict:
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


# ---------------------------------------------------------------------------
# positions.csv / events.csv
# ---------------------------------------------------------------------------
POSITIONS_HEADER = [
    "frame", "timestamp_seconds", "raw_x_mm", "raw_y_mm", "raw_z_mm",
    "x_mm", "y_mm", "heading_deg", "pitch_deg", "roll_deg",
    "reprojection_error_px", "pose_confidence", "marker_visible",
    "arena_reference_count",
]


def save_positions_csv(poses: List[RobotPose], path: str) -> None:
    _ensure_dir(path)
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=POSITIONS_HEADER)
        writer.writeheader()
        for p in poses:
            writer.writerow(p.to_csv_row())


def load_positions_csv(path: str) -> List[Dict]:
    with open(path, "r", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def save_events_csv(events: List, path: str) -> None:
    """events: list of (timestamp, from_state, to_state)."""
    _ensure_dir(path)
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["timestamp_seconds", "from_state", "to_state"])
        for ev in events:
            writer.writerow([round(float(ev[0]), 6), ev[1], ev[2]])


def load_events_csv(path: str) -> List[Dict]:
    with open(path, "r", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))
