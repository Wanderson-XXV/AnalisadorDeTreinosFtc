"""Small Qt / OpenCV interop helpers shared by the UI widgets."""

from __future__ import annotations

import numpy as np
from PySide6.QtGui import QImage, QPixmap


def bgr_to_qimage(frame: np.ndarray) -> QImage:
    """Convert an OpenCV BGR (or gray) frame to a QImage (RGB888)."""
    if frame is None:
        return QImage()
    if frame.ndim == 2:
        h, w = frame.shape
        return QImage(frame.data, w, h, w, QImage.Format_Grayscale8).copy()
    # BGR -> RGB
    rgb = frame[:, :, ::-1].copy()
    h, w, ch = rgb.shape
    bytes_per_line = ch * w
    return QImage(rgb.data, w, h, bytes_per_line, QImage.Format_RGB888).copy()


def bgr_to_pixmap(frame: np.ndarray) -> QPixmap:
    return QPixmap.fromImage(bgr_to_qimage(frame))
