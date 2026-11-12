"""Live camera view with detection / pose overlays."""

from __future__ import annotations

from typing import List, Optional

import cv2
import numpy as np
from PySide6.QtCore import Qt
from PySide6.QtWidgets import QLabel, QVBoxLayout, QWidget

from ..models import MarkerDetection, RobotPose
from .qt_helpers import bgr_to_pixmap


class CameraPanel(QWidget):
    """Shows the camera frame plus ArUco / pose overlays."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._label = QLabel("Sem sinal de câmera")
        self._label.setAlignment(Qt.AlignCenter)
        self._label.setMinimumSize(480, 360)
        self._label.setStyleSheet(
            "background:#1e1e1e; color:#bbb; border:1px solid #333;")
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.addWidget(self._label)
        self.show_overlays = True

    # ------------------------------------------------------------------
    def update_frame(
        self,
        frame: np.ndarray,
        detections: Optional[List[MarkerDetection]] = None,
        pose: Optional[RobotPose] = None,
        robot_marker_id: int = 0,
        camera_matrix: Optional[np.ndarray] = None,
        dist_coeffs: Optional[np.ndarray] = None,
        marker_length_mm: float = 80.0,
    ) -> None:
        if frame is None:
            return
        vis = frame.copy()
        if self.show_overlays and detections:
            self._draw_overlays(
                vis, detections, pose, robot_marker_id,
                camera_matrix, dist_coeffs, marker_length_mm)
        pix = bgr_to_pixmap(vis)
        self._label.setPixmap(pix.scaled(
            self._label.size(), Qt.KeepAspectRatio, Qt.SmoothTransformation))

    # ------------------------------------------------------------------
    def _draw_overlays(self, vis, detections, pose, robot_id,
                       K, dist, marker_len):
        for d in detections:
            pts = d.corners.astype(int)
            is_robot = d.marker_id == robot_id
            color = (0, 165, 255) if is_robot else (0, 200, 0)
            if d.is_blurred:
                color = (0, 0, 255)
            cv2.polylines(vis, [pts], True, color, 2)
            for c in pts:
                cv2.circle(vis, tuple(c), 4, (0, 255, 255), -1)
            center = d.center.astype(int)
            cv2.circle(vis, tuple(center), 4, (255, 0, 255), -1)
            label = f"ID {d.marker_id} ({d.apparent_size_px:.0f}px)"
            cv2.putText(vis, label, (pts[0][0], pts[0][1] - 8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2)
            if d.is_blurred:
                cv2.putText(vis, "BORRADO", (pts[0][0], pts[0][1] + 18),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)

        # draw pose axes for the robot marker
        robot_det = next((d for d in detections if d.marker_id == robot_id),
                         None)
        if (robot_det is not None and K is not None and dist is not None):
            self._draw_axes(vis, robot_det, K, dist, marker_len)

        # HUD text
        if pose is not None and pose.marker_visible:
            hud = [
                f"Reproj: {pose.reprojection_error_px:.2f}px",
                f"Conf: {pose.pose_confidence:.2f}",
            ]
            if pose.pose_confidence < 0.4:
                hud.append("BAIXA CONFIANCA")
            for i, t in enumerate(hud):
                cv2.putText(vis, t, (10, 30 + i * 26),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)
        elif not detections or robot_det is None:
            cv2.putText(vis, "Marcador do robo nao detectado", (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

    def _draw_axes(self, vis, det, K, dist, marker_len):
        h = marker_len / 2.0
        obj = np.array([[-h, h, 0], [h, h, 0], [h, -h, 0], [-h, -h, 0]],
                       dtype=np.float32)
        img = det.corners.reshape(4, 2).astype(np.float32)
        ok, rvec, tvec = cv2.solvePnP(
            obj, img, K, dist, flags=cv2.SOLVEPNP_IPPE_SQUARE)
        if not ok:
            return
        try:
            cv2.drawFrameAxes(vis, K, dist, rvec, tvec, marker_len * 0.6, 2)
        except Exception:
            pass
