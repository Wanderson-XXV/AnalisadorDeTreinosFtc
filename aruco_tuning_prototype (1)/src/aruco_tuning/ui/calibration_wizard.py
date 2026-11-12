"""Step-by-step ChArUco camera calibration wizard."""

from __future__ import annotations

import os
from typing import Optional

import cv2
from PySide6.QtCore import Qt, QTimer
from PySide6.QtWidgets import (QDialog, QFileDialog, QHBoxLayout, QLabel,
                               QListWidget, QMessageBox, QProgressBar,
                               QPushButton, QVBoxLayout)

from ..camera import CameraManager
from ..camera_calibration import CameraCalibrator, CharucoBoardSpec
from ..models import CalibrationData
from .qt_helpers import bgr_to_pixmap


class CalibrationWizard(QDialog):
    """Guides the user through capturing ChArUco frames and calibrating."""

    def __init__(self, camera: CameraManager,
                 spec: Optional[CharucoBoardSpec] = None, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Assistente de Calibração (ChArUco)")
        self.resize(900, 600)
        self.camera = camera
        self.calibrator = CameraCalibrator(spec or CharucoBoardSpec())
        self.result: Optional[CalibrationData] = None
        self._last_frame = None

        # --- layout -------------------------------------------------
        main = QHBoxLayout(self)

        left = QVBoxLayout()
        self.preview = QLabel("Pré-visualização")
        self.preview.setAlignment(Qt.AlignCenter)
        self.preview.setMinimumSize(560, 420)
        self.preview.setStyleSheet("background:#1e1e1e; color:#bbb;")
        left.addWidget(self.preview)
        self.info = QLabel(
            "Aponte a câmera para o tabuleiro ChArUco impresso e capture "
            "de 10 a 20 quadros em diferentes ângulos/posições.")
        self.info.setWordWrap(True)
        left.addWidget(self.info)
        self.coverage = QProgressBar()
        self.coverage.setFormat("Cobertura: %p%")
        left.addWidget(self.coverage)
        main.addLayout(left, 3)

        right = QVBoxLayout()
        self.btn_generate = QPushButton("Gerar imagem do tabuleiro…")
        self.btn_capture = QPushButton("Capturar quadro")
        self.btn_remove = QPushButton("Remover selecionado")
        self.btn_remove_worst = QPushButton("Remover pior")
        self.btn_calibrate = QPushButton("Calibrar")
        self.btn_save = QPushButton("Salvar calibração…")
        self.btn_save.setEnabled(False)
        right.addWidget(self.btn_generate)
        right.addWidget(self.btn_capture)
        right.addWidget(QLabel("Capturas:"))
        self.capture_list = QListWidget()
        right.addWidget(self.capture_list, 1)
        right.addWidget(self.btn_remove)
        right.addWidget(self.btn_remove_worst)
        right.addWidget(self.btn_calibrate)
        self.rms_label = QLabel("RMS: —")
        right.addWidget(self.rms_label)
        right.addWidget(self.btn_save)
        main.addLayout(right, 2)

        # --- signals ------------------------------------------------
        self.btn_generate.clicked.connect(self._generate_board)
        self.btn_capture.clicked.connect(self._capture)
        self.btn_remove.clicked.connect(self._remove_selected)
        self.btn_remove_worst.clicked.connect(self._remove_worst)
        self.btn_calibrate.clicked.connect(self._calibrate)
        self.btn_save.clicked.connect(self._save)

        # --- preview timer -----------------------------------------
        self._timer = QTimer(self)
        self._timer.timeout.connect(self._update_preview)
        if self.camera.is_open():
            self._timer.start(50)
        else:
            self.info.setText(
                "Nenhuma câmera aberta. Abra a câmera antes de calibrar.")
            self.btn_capture.setEnabled(False)

    # ------------------------------------------------------------------
    def _update_preview(self):
        ok, frame = self.camera.read()
        if not ok or frame is None:
            return
        self._last_frame = frame
        corners, ids = self.calibrator.detect(frame)
        vis = frame.copy()
        if ids is not None and len(ids) > 0:
            cv2.aruco.drawDetectedCornersCharuco(vis, corners, ids)
        pix = bgr_to_pixmap(vis)
        self.preview.setPixmap(pix.scaled(
            self.preview.size(), Qt.KeepAspectRatio, Qt.SmoothTransformation))

    def _capture(self):
        if self._last_frame is None:
            return
        ok, msg = self.calibrator.add_capture(self._last_frame)
        if ok:
            self.capture_list.addItem(
                f"#{len(self.calibrator.captures)} - {msg}")
        else:
            QMessageBox.warning(self, "Captura", msg)
        self.coverage.setValue(int(self.calibrator.coverage_ratio() * 100))

    def _remove_selected(self):
        idx = self.capture_list.currentRow()
        if idx >= 0 and self.calibrator.remove_capture(idx):
            self.capture_list.takeItem(idx)
            self._refresh_list()

    def _remove_worst(self):
        idx = self.calibrator.worst_capture_index()
        if idx is not None and self.calibrator.remove_capture(idx):
            self._refresh_list()

    def _refresh_list(self):
        self.capture_list.clear()
        for i, cap in enumerate(self.calibrator.captures):
            err = (f" - erro {cap.view_error:.3f}px"
                   if cap.view_error else "")
            self.capture_list.addItem(
                f"#{i + 1} - {cap.num_corners} cantos{err}")
        self.coverage.setValue(int(self.calibrator.coverage_ratio() * 100))

    def _calibrate(self):
        ok, msg = self.calibrator.calibrate()
        if not ok:
            QMessageBox.warning(self, "Calibração", msg)
            return
        self.result = self.calibrator.result
        self.rms_label.setText(f"RMS: {self.result.rms_error:.4f} px")
        self.btn_save.setEnabled(True)
        self._refresh_list()
        QMessageBox.information(self, "Calibração", msg)

    def _generate_board(self):
        path, _ = QFileDialog.getSaveFileName(
            self, "Salvar imagem do tabuleiro", "charuco_board.png",
            "PNG (*.png)")
        if not path:
            return
        img = self.calibrator.generate_board_image()
        cv2.imwrite(path, img)
        QMessageBox.information(
            self, "Tabuleiro",
            f"Tabuleiro salvo em {path}.\nImprima em 100% (sem ajuste de "
            "escala) e meça um quadrado para confirmar as dimensões.")

    def _save(self):
        if self.result is None:
            return
        path, _ = QFileDialog.getSaveFileName(
            self, "Salvar calibração", "calibration.yaml",
            "YAML (*.yaml *.yml)")
        if not path:
            return
        from .. import persistence
        persistence.save_calibration(self.result, path)
        QMessageBox.information(self, "Calibração", f"Salvo em {path}")
        self.accept()

    def closeEvent(self, event):
        self._timer.stop()
        super().closeEvent(event)
