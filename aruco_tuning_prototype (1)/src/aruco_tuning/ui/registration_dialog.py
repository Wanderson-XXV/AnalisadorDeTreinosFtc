"""Camera <-> arena registration dialog.

Left: a captured camera frame. Right: the arena rectangle. The user clicks a
point in the camera frame and then the matching point in the arena; each pair
is added to the correspondence list. With >= 4 pairs the homography +
extrinsics are computed (RANSAC) and per-point residuals are shown. After a
good registration the fixed ArUco markers can be auto-learned.
"""

from __future__ import annotations

from typing import List, Optional, Tuple

import cv2
import numpy as np
from PySide6.QtCore import QPointF, Qt, Signal
from PySide6.QtGui import QColor, QImage, QPainter, QPen, QPixmap
from PySide6.QtWidgets import (QDialog, QHBoxLayout, QLabel, QListWidget,
                               QMessageBox, QPushButton, QVBoxLayout, QWidget)

from ..arena import ArenaConfig
from ..arena_registration import ArenaRegistration
from ..aruco_detection import ArucoDetector
from ..models import CalibrationData, RobotConfig
from .qt_helpers import bgr_to_qimage


class ClickableImage(QLabel):
    clicked = Signal(float, float)  # image/content coordinates

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setMinimumSize(360, 270)
        self.setAlignment(Qt.AlignCenter)
        self.setStyleSheet("background:#12181f; border:1px solid #2c3e50;")
        self._content_size = (0, 0)  # (w, h) of underlying content
        self._draw_rect = (0, 0, 0, 0)  # x, y, w, h of drawn pixmap
        self._markers: List[Tuple[float, float]] = []
        self._base_pixmap: Optional[QPixmap] = None

    def set_content(self, pixmap: QPixmap, content_size):
        self._base_pixmap = pixmap
        self._content_size = content_size
        self._render()

    def set_markers(self, markers):
        self._markers = list(markers)
        self._render()

    def _render(self):
        if self._base_pixmap is None:
            return
        scaled = self._base_pixmap.scaled(
            self.size(), Qt.KeepAspectRatio, Qt.SmoothTransformation)
        dx = (self.width() - scaled.width()) / 2
        dy = (self.height() - scaled.height()) / 2
        self._draw_rect = (dx, dy, scaled.width(), scaled.height())
        canvas = QPixmap(self.size())
        canvas.fill(QColor("#12181f"))
        painter = QPainter(canvas)
        painter.drawPixmap(int(dx), int(dy), scaled)
        # draw markers
        cw, ch = self._content_size
        if cw and ch:
            sx = scaled.width() / cw
            sy = scaled.height() / ch
            painter.setPen(QPen(QColor("#e74c3c"), 2))
            for i, (mx, my) in enumerate(self._markers):
                px = dx + mx * sx
                py = dy + my * sy
                painter.drawLine(QPointF(px - 6, py), QPointF(px + 6, py))
                painter.drawLine(QPointF(px, py - 6), QPointF(px, py + 6))
                painter.drawText(QPointF(px + 8, py - 8), str(i + 1))
        painter.end()
        self.setPixmap(canvas)

    def resizeEvent(self, event):
        self._render()
        super().resizeEvent(event)

    def mousePressEvent(self, event):
        if self._base_pixmap is None:
            return
        dx, dy, w, h = self._draw_rect
        x = event.position().x() - dx
        y = event.position().y() - dy
        if 0 <= x <= w and 0 <= y <= h and w > 0 and h > 0:
            cw, ch = self._content_size
            cx = x / w * cw
            cy = y / h * ch
            self.clicked.emit(cx, cy)


class RegistrationDialog(QDialog):
    def __init__(self, frame: np.ndarray, arena: ArenaConfig,
                 calibration: CalibrationData, robot: RobotConfig,
                 registration: Optional[ArenaRegistration] = None, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Registro Câmera ↔ Arena")
        self.resize(1000, 640)
        self.frame = frame
        self.arena = arena
        self.calibration = calibration
        self.robot = robot
        self.registration = registration or ArenaRegistration()
        self._pending_image_pt: Optional[Tuple[float, float]] = None

        main = QVBoxLayout(self)
        images = QHBoxLayout()

        # camera image
        cam_col = QVBoxLayout()
        cam_col.addWidget(QLabel("1) Clique um ponto na câmera"))
        self.cam_view = ClickableImage()
        qimg = bgr_to_qimage(frame)
        self.cam_view.set_content(QPixmap.fromImage(qimg),
                                  (frame.shape[1], frame.shape[0]))
        self.cam_view.clicked.connect(self._on_camera_click)
        cam_col.addWidget(self.cam_view)
        images.addLayout(cam_col)

        # arena image
        arena_col = QVBoxLayout()
        arena_col.addWidget(QLabel("2) Clique o ponto correspondente na arena"))
        self.arena_view = ClickableImage()
        self.arena_view.set_content(self._render_arena_pixmap(),
                                    (arena.width_mm, arena.height_mm))
        self.arena_view.clicked.connect(self._on_arena_click)
        arena_col.addWidget(self.arena_view)
        images.addLayout(arena_col)
        main.addLayout(images)

        # controls
        controls = QHBoxLayout()
        self.pairs_list = QListWidget()
        controls.addWidget(self.pairs_list, 2)
        btns = QVBoxLayout()
        self.status = QLabel("0 pares. Mínimo 4 (recomendado 8+).")
        self.status.setWordWrap(True)
        btns.addWidget(self.status)
        self.btn_remove = QPushButton("Remover selecionado")
        self.btn_remove_worst = QPushButton("Remover pior resíduo")
        self.btn_compute = QPushButton("Calcular registro")
        self.btn_learn = QPushButton("Aprender ArUcos fixos")
        self.btn_learn.setEnabled(False)
        for b in (self.btn_remove, self.btn_remove_worst,
                  self.btn_compute, self.btn_learn):
            btns.addWidget(b)
        self.btn_ok = QPushButton("Concluir")
        self.btn_cancel = QPushButton("Cancelar")
        btns.addWidget(self.btn_ok)
        btns.addWidget(self.btn_cancel)
        controls.addLayout(btns, 1)
        main.addLayout(controls)

        self.btn_remove.clicked.connect(self._remove_selected)
        self.btn_remove_worst.clicked.connect(self._remove_worst)
        self.btn_compute.clicked.connect(self._compute)
        self.btn_learn.clicked.connect(self._learn)
        self.btn_ok.clicked.connect(self.accept)
        self.btn_cancel.clicked.connect(self.reject)
        self._refresh()

    # ------------------------------------------------------------------
    def _render_arena_pixmap(self) -> QPixmap:
        w = 800
        h = int(w * self.arena.height_mm / max(1.0, self.arena.width_mm))
        img = QImage(w, h, QImage.Format_RGB888)
        img.fill(QColor("#1b2733"))
        painter = QPainter(img)
        painter.setPen(QPen(QColor("#4aa3df"), 2))
        painter.drawRect(1, 1, w - 2, h - 2)
        # grid
        painter.setPen(QPen(QColor(255, 255, 255, 30), 1))
        step_mm = 250
        x = 0
        while x < self.arena.width_mm:
            px = int(x / self.arena.width_mm * w)
            painter.drawLine(px, 0, px, h)
            x += step_mm
        y = 0
        while y < self.arena.height_mm:
            py = int(y / self.arena.height_mm * h)
            painter.drawLine(0, py, w, py)
            y += step_mm
        painter.end()
        return QPixmap.fromImage(img)

    # ------------------------------------------------------------------
    def _on_camera_click(self, x, y):
        self._pending_image_pt = (x, y)
        self.status.setText(
            f"Ponto na câmera ({x:.0f},{y:.0f}) marcado. "
            "Agora clique na arena.")
        self._update_pending_markers()

    def _on_arena_click(self, x, y):
        if self._pending_image_pt is None:
            self.status.setText("Clique primeiro um ponto na câmera.")
            return
        self.registration.add_correspondence(self._pending_image_pt, (x, y))
        self._pending_image_pt = None
        self._refresh()

    def _update_pending_markers(self):
        img_markers = list(self.registration._img_pts)
        if self._pending_image_pt is not None:
            img_markers = img_markers + [self._pending_image_pt]
        self.cam_view.set_markers(img_markers)
        self.arena_view.set_markers(self.registration._arena_pts)

    def _refresh(self):
        self.pairs_list.clear()
        res = self.registration.data.residuals
        for i in range(self.registration.num_correspondences):
            ip = self.registration._img_pts[i]
            ap = self.registration._arena_pts[i]
            txt = (f"#{i + 1} img({ip[0]:.0f},{ip[1]:.0f}) -> "
                   f"arena({ap[0]:.0f},{ap[1]:.0f})")
            if i < len(res):
                txt += f"  resíduo={res[i]:.1f}mm"
            self.pairs_list.addItem(txt)
        n = self.registration.num_correspondences
        self.status.setText(
            f"{n} pares. Mínimo 4 (recomendado 8+).")
        self._update_pending_markers()

    def _remove_selected(self):
        idx = self.pairs_list.currentRow()
        if idx >= 0 and self.registration.remove_correspondence(idx):
            self.registration.data.residuals = []
            self._refresh()

    def _remove_worst(self):
        idx = self.registration.worst_correspondence()
        if idx is not None and self.registration.remove_correspondence(idx):
            self.registration.data.residuals = []
            self._refresh()

    def _compute(self):
        if not self.calibration.is_valid:
            QMessageBox.warning(
                self, "Registro",
                "Calibração intrínseca necessária antes do registro.")
            return
        ok, msg = self.registration.register_manual(
            self.calibration.camera_matrix, self.calibration.dist_coeffs,
            (self.frame.shape[1], self.frame.shape[0]))
        if not ok:
            QMessageBox.warning(self, "Registro", msg)
            return
        self.btn_learn.setEnabled(True)
        self._refresh()
        QMessageBox.information(self, "Registro", msg)

    def _learn(self):
        detector = ArucoDetector(self.robot.marker_dictionary)
        detections = detector.detect(self.frame)
        count, msg = self.registration.learn_references(
            detections, self.calibration.camera_matrix,
            self.calibration.dist_coeffs,
            exclude_ids=[self.robot.marker_id])
        QMessageBox.information(self, "Referências", msg)

    def get_registration(self) -> ArenaRegistration:
        return self.registration
