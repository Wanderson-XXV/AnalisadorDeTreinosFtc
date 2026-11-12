import os
from pathlib import Path

import cv2
import numpy as np


class VideoNavigationError(Exception):
    pass


class VideoNavigator:
    def __init__(self, video_path: str):
        self._original_path = video_path
        self._video_path = self._resolve_video_path(video_path)
        if not os.path.isfile(self._video_path):
            raise VideoNavigationError(
                f"Arquivo de video nao encontrado: {video_path}"
            )
        self._cap = cv2.VideoCapture(self._video_path)
        if not self._cap.isOpened():
            raise VideoNavigationError(
                f"Nao foi possivel abrir o video: {video_path}\n"
                "Verifique se o arquivo existe, nao esta corrompido ou e um formato valido."
            )
        self._fps = float(self._cap.get(cv2.CAP_PROP_FPS))
        self._total_frames = int(self._cap.get(cv2.CAP_PROP_FRAME_COUNT))
        self._current_frame = 0
        self._playing = False

    @staticmethod
    def _resolve_video_path(video_path: str) -> str:
        if os.path.exists(video_path):
            return os.path.normpath(os.path.abspath(video_path))
        candidate = Path(video_path).resolve()
        if candidate.is_file():
            return str(candidate)
        raise VideoNavigationError(
            f"Arquivo de video nao encontrado: {video_path}"
        )

    @property
    def fps(self) -> float:
        return self._fps

    @property
    def total_frames(self) -> int:
        return self._total_frames

    @property
    def current_frame(self) -> int:
        return self._current_frame

    @property
    def original_path(self) -> str:
        return self._original_path

    @property
    def is_playing(self) -> bool:
        return self._playing

    def toggle_play(self) -> None:
        self._playing = not self._playing

    def stop_play(self) -> None:
        self._playing = False

    def go_to_frame(self, frame_index: int) -> bool:
        if self._total_frames > 0:
            frame_index = max(0, min(frame_index, self._total_frames - 1))
        else:
            frame_index = max(0, frame_index)
        self._cap.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
        self._current_frame = frame_index
        return True

    def step(self, delta: int) -> bool:
        return self.go_to_frame(self._current_frame + delta)

    def step_seconds(self, seconds: float) -> bool:
        if self._fps <= 0:
            return False
        return self.step(int(round(seconds * self._fps)))

    def read_frame(self) -> tuple:
        ret, frame = self._cap.read()
        if ret:
            self._current_frame = int(self._cap.get(cv2.CAP_PROP_POS_FRAMES)) - 1
            if self._current_frame < 0:
                self._current_frame = 0
        return ret, frame

    def get_current_frame_copy(self) -> np.ndarray | None:
        pos = self._current_frame
        self._cap.set(cv2.CAP_PROP_POS_FRAMES, pos)
        ret, frame = self._cap.read()
        if ret:
            self._current_frame = pos
        return frame if ret else None

    def release(self) -> None:
        if self._cap:
            self._cap.release()
            self._cap = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.release()
