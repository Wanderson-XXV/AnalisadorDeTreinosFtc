"""ArUco marker detection with corner refinement and blur estimation.

Uses the OpenCV 4.7+ object oriented API (``cv2.aruco.ArucoDetector``) which
ships with the standard ``opencv-python`` wheel (the aruco module was merged
into the main distribution).
"""

from __future__ import annotations

from typing import Dict, List, Optional

import cv2
import numpy as np

from .models import MarkerDetection


# Map friendly names -> cv2.aruco predefined dictionary constants.
def _build_dictionary_map() -> Dict[str, int]:
    names = [
        "DICT_4X4_50", "DICT_4X4_100", "DICT_4X4_250", "DICT_4X4_1000",
        "DICT_5X5_50", "DICT_5X5_100", "DICT_5X5_250", "DICT_5X5_1000",
        "DICT_6X6_50", "DICT_6X6_100", "DICT_6X6_250", "DICT_6X6_1000",
        "DICT_7X7_50", "DICT_7X7_100", "DICT_7X7_250", "DICT_7X7_1000",
        "DICT_ARUCO_ORIGINAL",
        "DICT_APRILTAG_16h5", "DICT_APRILTAG_25h9",
        "DICT_APRILTAG_36h10", "DICT_APRILTAG_36h11",
    ]
    out = {}
    for n in names:
        if hasattr(cv2.aruco, n):
            out[n] = getattr(cv2.aruco, n)
    return out


ARUCO_DICTIONARIES = _build_dictionary_map()
DEFAULT_DICTIONARY = "DICT_4X4_50"


def get_dictionary(name: str) -> cv2.aruco.Dictionary:
    """Return an ``cv2.aruco.Dictionary`` for a friendly name."""
    if name not in ARUCO_DICTIONARIES:
        raise ValueError(
            f"Unknown ArUco dictionary '{name}'. "
            f"Available: {sorted(ARUCO_DICTIONARIES)}"
        )
    return cv2.aruco.getPredefinedDictionary(ARUCO_DICTIONARIES[name])


def list_dictionaries() -> List[str]:
    return sorted(ARUCO_DICTIONARIES)


def variance_of_laplacian(image: np.ndarray) -> float:
    """Focus/blur metric: variance of the Laplacian. Higher = sharper."""
    if image.ndim == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


class ArucoDetector:
    """Thin wrapper around ``cv2.aruco.ArucoDetector`` with refinement."""

    def __init__(
        self,
        dictionary_name: str = DEFAULT_DICTIONARY,
        refine_corners: bool = True,
        blur_threshold: float = 60.0,
    ):
        self.dictionary_name = dictionary_name
        self.blur_threshold = blur_threshold
        self._dictionary = get_dictionary(dictionary_name)
        self._params = cv2.aruco.DetectorParameters()
        if refine_corners:
            # Sub-pixel corner refinement gives much better pose stability.
            self._params.cornerRefinementMethod = cv2.aruco.CORNER_REFINE_SUBPIX
            self._params.cornerRefinementWinSize = 5
            self._params.cornerRefinementMaxIterations = 30
            self._params.cornerRefinementMinAccuracy = 0.01
        self._detector = cv2.aruco.ArucoDetector(self._dictionary, self._params)

    def set_dictionary(self, dictionary_name: str) -> None:
        self.dictionary_name = dictionary_name
        self._dictionary = get_dictionary(dictionary_name)
        self._detector = cv2.aruco.ArucoDetector(self._dictionary, self._params)

    def detect(self, frame: np.ndarray) -> List[MarkerDetection]:
        """Detect markers, returning a list of :class:`MarkerDetection`."""
        if frame is None or frame.size == 0:
            return []
        if frame.ndim == 3:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        else:
            gray = frame

        corners, ids, _ = self._detector.detectMarkers(gray)
        detections: List[MarkerDetection] = []
        if ids is None or len(ids) == 0:
            return detections

        for marker_corners, marker_id in zip(corners, ids.flatten()):
            pts = marker_corners.reshape(4, 2).astype(np.float32)
            sharpness = self._corner_sharpness(gray, pts)
            detections.append(
                MarkerDetection(
                    marker_id=int(marker_id),
                    corners=pts,
                    sharpness=sharpness,
                    is_blurred=sharpness < self.blur_threshold,
                )
            )
        return detections

    def detect_dict(self, frame: np.ndarray) -> Dict[int, MarkerDetection]:
        """Return detections keyed by marker id (last wins on duplicates)."""
        return {d.marker_id: d for d in self.detect(frame)}

    @staticmethod
    def _corner_sharpness(gray: np.ndarray, corners: np.ndarray) -> float:
        """Estimate sharpness inside the marker bounding box (blur metric)."""
        x_min = int(max(0, np.floor(corners[:, 0].min())))
        y_min = int(max(0, np.floor(corners[:, 1].min())))
        x_max = int(min(gray.shape[1], np.ceil(corners[:, 0].max())))
        y_max = int(min(gray.shape[0], np.ceil(corners[:, 1].max())))
        if x_max - x_min < 4 or y_max - y_min < 4:
            return 0.0
        roi = gray[y_min:y_max, x_min:x_max]
        return variance_of_laplacian(roi)


def draw_detections(
    frame: np.ndarray,
    detections: List[MarkerDetection],
    highlight_id: Optional[int] = None,
) -> np.ndarray:
    """Draw marker outlines + ids on a copy of ``frame`` (for the UI/demo)."""
    out = frame.copy()
    for d in detections:
        pts = d.corners.astype(int)
        color = (0, 0, 255) if d.is_blurred else (0, 255, 0)
        if highlight_id is not None and d.marker_id == highlight_id:
            color = (255, 128, 0)
        cv2.polylines(out, [pts], True, color, 2)
        c = d.center.astype(int)
        cv2.circle(out, tuple(c), 3, (0, 255, 255), -1)
        cv2.putText(
            out, str(d.marker_id), (pts[0][0], pts[0][1] - 8),
            cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2,
        )
    return out
