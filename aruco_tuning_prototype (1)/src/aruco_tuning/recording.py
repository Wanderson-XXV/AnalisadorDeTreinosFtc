"""Video recording during tuning tests.

Wraps ``cv2.VideoWriter`` (mp4v codec) and keeps a parallel list of frame
timestamps so the recording can later be synced with the trajectory CSV.
"""

from __future__ import annotations

import os
import time
from typing import List, Optional, Tuple

import cv2
import numpy as np


class VideoRecorder:
    """Record frames to an .mp4 file with timestamp bookkeeping."""

    def __init__(self, fourcc: str = "mp4v"):
        self.fourcc = fourcc
        self._writer: Optional[cv2.VideoWriter] = None
        self.path: str = ""
        self.fps: float = 30.0
        self.frame_size: Tuple[int, int] = (0, 0)
        self.timestamps: List[float] = []
        self._start_time: float = 0.0
        self._recording = False

    @property
    def is_recording(self) -> bool:
        return self._recording

    @property
    def frame_count(self) -> int:
        return len(self.timestamps)

    def start(self, path: str, frame_size: Tuple[int, int],
              fps: float = 30.0) -> Tuple[bool, str]:
        """Open a writer. ``frame_size`` is (width, height)."""
        if self._recording:
            return False, "Já está gravando"
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        fourcc = cv2.VideoWriter_fourcc(*self.fourcc)
        writer = cv2.VideoWriter(path, fourcc, float(fps), frame_size)
        if not writer.isOpened():
            return False, f"Não foi possível abrir o gravador em {path}"
        self._writer = writer
        self.path = path
        self.fps = float(fps)
        self.frame_size = frame_size
        self.timestamps = []
        self._start_time = time.time()
        self._recording = True
        return True, f"Gravando em {path}"

    def write(self, frame: np.ndarray,
              timestamp: Optional[float] = None) -> bool:
        if not self._recording or self._writer is None:
            return False
        h, w = frame.shape[:2]
        if (w, h) != self.frame_size:
            frame = cv2.resize(frame, self.frame_size)
        self._writer.write(frame)
        ts = time.time() if timestamp is None else timestamp
        self.timestamps.append(ts - self._start_time)
        return True

    def stop(self) -> Tuple[str, int]:
        """Close the writer, returning (path, frame_count)."""
        if self._writer is not None:
            self._writer.release()
            self._writer = None
        self._recording = False
        return self.path, len(self.timestamps)

    def __del__(self):  # pragma: no cover - safety net
        try:
            if self._writer is not None:
                self._writer.release()
        except Exception:
            pass
