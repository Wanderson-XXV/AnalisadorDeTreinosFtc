"""ChArUco based intrinsic camera calibration.

Workflow
--------
1. Create a :class:`CharucoBoardSpec` and generate a printable board image.
2. Capture several frames of the printed board at different positions/angles
   (``add_capture``). Each accepted capture stores the detected ChArUco
   corners and contributes to image-region coverage tracking.
3. Call :meth:`calibrate` to compute the camera matrix + distortion, the
   overall RMS error and per-view errors.
4. Bad captures can be removed (:meth:`remove_capture`) and calibration re-run.
5. Persist with the helpers in :mod:`persistence`.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional, Tuple

import cv2
import numpy as np

from .aruco_detection import get_dictionary
from .models import CalibrationData


@dataclass
class CharucoBoardSpec:
    """Definition of a ChArUco calibration board."""

    squares_x: int = 7
    squares_y: int = 5
    square_length_mm: float = 30.0
    marker_length_mm: float = 22.0
    dictionary: str = "DICT_5X5_1000"

    def to_dict(self) -> dict:
        return {
            "squares_x": self.squares_x,
            "squares_y": self.squares_y,
            "square_length_mm": self.square_length_mm,
            "marker_length_mm": self.marker_length_mm,
            "dictionary": self.dictionary,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "CharucoBoardSpec":
        known = {k: v for k, v in (d or {}).items() if k in cls.__annotations__}
        return cls(**known)


def _make_board(spec: CharucoBoardSpec):
    dictionary = get_dictionary(spec.dictionary)
    # OpenCV expects lengths in a consistent unit; we use metres (mm/1000)
    board = cv2.aruco.CharucoBoard(
        (spec.squares_x, spec.squares_y),
        spec.square_length_mm / 1000.0,
        spec.marker_length_mm / 1000.0,
        dictionary,
    )
    return board, dictionary


@dataclass
class Capture:
    """A single accepted calibration capture."""

    charuco_corners: np.ndarray  # Nx1x2
    charuco_ids: np.ndarray  # Nx1
    image_size: Tuple[int, int]  # (w, h)
    num_corners: int = 0
    view_error: float = 0.0
    coverage_bbox: Tuple[float, float, float, float] = (0, 0, 0, 0)


class CameraCalibrator:
    """Collect ChArUco captures and compute intrinsics."""

    def __init__(self, spec: Optional[CharucoBoardSpec] = None):
        self.spec = spec or CharucoBoardSpec()
        self.board, self.dictionary = _make_board(self.spec)
        self._detector_params = cv2.aruco.DetectorParameters()
        self._charuco_detector = cv2.aruco.CharucoDetector(self.board)
        self.captures: List[Capture] = []
        self.result: Optional[CalibrationData] = None
        self._image_size: Optional[Tuple[int, int]] = None

    # ------------------------------------------------------------------
    def generate_board_image(self, pixels_per_mm: float = 10.0,
                             margin_mm: float = 10.0) -> np.ndarray:
        """Render a printable board image."""
        w = int(self.spec.squares_x * self.spec.square_length_mm * pixels_per_mm)
        h = int(self.spec.squares_y * self.spec.square_length_mm * pixels_per_mm)
        margin = int(margin_mm * pixels_per_mm)
        img = self.board.generateImage((w, h), marginSize=margin)
        return img

    # ------------------------------------------------------------------
    def detect(self, frame: np.ndarray):
        """Return (charuco_corners, charuco_ids) or (None, None)."""
        gray = frame
        if frame.ndim == 3:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        charuco_corners, charuco_ids, _, _ = \
            self._charuco_detector.detectBoard(gray)
        return charuco_corners, charuco_ids

    def add_capture(self, frame: np.ndarray, min_corners: int = 6
                    ) -> Tuple[bool, str]:
        """Detect the board in ``frame`` and store a capture if good enough."""
        h, w = frame.shape[:2]
        if self._image_size is None:
            self._image_size = (w, h)
        elif self._image_size != (w, h):
            return False, "Tamanho da imagem inconsistente entre capturas"

        corners, ids = self.detect(frame)
        if ids is None or len(ids) < min_corners:
            n = 0 if ids is None else len(ids)
            return False, f"Cantos insuficientes detectados ({n} < {min_corners})"

        pts = corners.reshape(-1, 2)
        bbox = (float(pts[:, 0].min()), float(pts[:, 1].min()),
                float(pts[:, 0].max()), float(pts[:, 1].max()))
        self.captures.append(Capture(
            charuco_corners=corners, charuco_ids=ids,
            image_size=(w, h), num_corners=len(ids), coverage_bbox=bbox,
        ))
        return True, f"Captura adicionada ({len(ids)} cantos)"

    def remove_capture(self, index: int) -> bool:
        if 0 <= index < len(self.captures):
            self.captures.pop(index)
            return True
        return False

    def clear(self) -> None:
        self.captures.clear()
        self.result = None

    # ------------------------------------------------------------------
    def coverage_ratio(self, grid: int = 6) -> float:
        """Fraction of a coarse image grid touched by any capture bbox."""
        if not self.captures or self._image_size is None:
            return 0.0
        w, h = self._image_size
        touched = np.zeros((grid, grid), dtype=bool)
        for cap in self.captures:
            x0, y0, x1, y1 = cap.coverage_bbox
            gx0 = int(np.clip(x0 / w * grid, 0, grid - 1))
            gx1 = int(np.clip(x1 / w * grid, 0, grid - 1))
            gy0 = int(np.clip(y0 / h * grid, 0, grid - 1))
            gy1 = int(np.clip(y1 / h * grid, 0, grid - 1))
            touched[gy0:gy1 + 1, gx0:gx1 + 1] = True
        return float(touched.mean())

    # ------------------------------------------------------------------
    def calibrate(self, min_captures: int = 5) -> Tuple[bool, str]:
        """Run ``calibrateCameraCharuco`` over the collected captures."""
        if len(self.captures) < min_captures:
            return False, (
                f"Capturas insuficientes ({len(self.captures)} < {min_captures})")

        image_size = self.captures[0].image_size  # (w, h)

        # OpenCV >= 4.7 removed calibrateCameraCharuco; use matchImagePoints
        # to convert ChArUco corners into object/image point correspondences
        # and feed them to the generic cv2.calibrateCamera.
        object_points: List[np.ndarray] = []
        image_points: List[np.ndarray] = []
        valid_captures: List[Capture] = []
        for cap in self.captures:
            obj_pts, img_pts = self.board.matchImagePoints(
                cap.charuco_corners, cap.charuco_ids)
            if obj_pts is None or len(obj_pts) < 4:
                continue
            object_points.append(obj_pts)
            image_points.append(img_pts)
            valid_captures.append(cap)

        if len(valid_captures) < min_captures:
            return False, (
                f"Capturas válidas insuficientes ({len(valid_captures)} "
                f"< {min_captures})")

        try:
            (rms, camera_matrix, dist_coeffs, rvecs, tvecs) = \
                cv2.calibrateCamera(
                    object_points, image_points, image_size, None, None)
        except cv2.error as exc:  # pragma: no cover - depends on input quality
            return False, f"Falha na calibração: {exc}"

        per_view = self._per_view_errors(
            object_points, image_points, rvecs, tvecs,
            camera_matrix, dist_coeffs)
        for cap, err in zip(valid_captures, per_view):
            cap.view_error = err

        self.result = CalibrationData(
            camera_matrix=camera_matrix,
            dist_coeffs=dist_coeffs,
            image_width=image_size[0],
            image_height=image_size[1],
            rms_error=float(rms),
            per_view_errors=[float(e) for e in per_view],
            num_views=len(self.captures),
            board_spec=self.spec.to_dict(),
        )
        return True, f"Calibração concluída. RMS = {rms:.4f} px"

    def _per_view_errors(self, object_points, image_points, rvecs, tvecs,
                         camera_matrix, dist_coeffs) -> List[float]:
        errors = []
        for obj, obs, rvec, tvec in zip(
                object_points, image_points, rvecs, tvecs):
            proj, _ = cv2.projectPoints(
                obj, rvec, tvec, camera_matrix, dist_coeffs)
            proj = proj.reshape(-1, 2)
            obs = obs.reshape(-1, 2)
            err = np.sqrt(np.mean(np.sum((proj - obs) ** 2, axis=1)))
            errors.append(float(err))
        return errors

    def worst_capture_index(self) -> Optional[int]:
        if not self.captures:
            return None
        errs = [c.view_error for c in self.captures]
        if all(e == 0 for e in errs):
            return None
        return int(np.argmax(errs))
