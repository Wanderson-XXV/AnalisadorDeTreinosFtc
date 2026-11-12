"""Application status bar.

Shows camera / calibration / registration health plus the live robot pose.
"""

from __future__ import annotations

from PySide6.QtWidgets import QStatusBar, QLabel


class StatusBar(QStatusBar):
    def __init__(self, parent=None):
        super().__init__(parent)
        self._camera = QLabel("Câmera: —")
        self._calib = QLabel("Calibração: —")
        self._arena = QLabel("Arena: —")
        self._refs = QLabel("Refs: 0")
        self._pose = QLabel("Pose: —")
        self._conf = QLabel("Conf.: —")
        self._z = QLabel("Z: —")
        for w in (self._camera, self._calib, self._arena, self._refs,
                  self._pose, self._conf, self._z):
            w.setMinimumWidth(90)
            self.addWidget(w)
            self.addWidget(_sep())

    # ------------------------------------------------------------------
    def set_camera(self, connected: bool, width=0, height=0, fps=0.0):
        if connected:
            self._camera.setText(
                f"Câmera: {width}x{height} @ {fps:.1f} fps")
            self._camera.setStyleSheet("color: #2ecc71;")
        else:
            self._camera.setText("Câmera: desconectada")
            self._camera.setStyleSheet("color: #e74c3c;")

    def set_calibration(self, loaded: bool, rms: float = 0.0):
        if loaded:
            self._calib.setText(f"Calibração: OK (RMS {rms:.2f}px)")
            self._calib.setStyleSheet("color: #2ecc71;")
        else:
            self._calib.setText("Calibração: ausente")
            self._calib.setStyleSheet("color: #e67e22;")

    def set_arena(self, registered: bool):
        if registered:
            self._arena.setText("Arena: registrada")
            self._arena.setStyleSheet("color: #2ecc71;")
        else:
            self._arena.setText("Arena: não registrada")
            self._arena.setStyleSheet("color: #e67e22;")

    def set_reference_count(self, visible: int, total: int):
        self._refs.setText(f"Refs: {visible}/{total}")

    def set_pose(self, visible: bool, x=0.0, y=0.0, heading=0.0):
        if visible:
            self._pose.setText(
                f"X={x:.0f} Y={y:.0f} θ={heading:.1f}°")
            self._pose.setStyleSheet("color: #2ecc71;")
        else:
            self._pose.setText("Pose: marcador ausente")
            self._pose.setStyleSheet("color: #e74c3c;")

    def set_confidence(self, conf: float):
        color = "#2ecc71" if conf > 0.7 else (
            "#e67e22" if conf > 0.4 else "#e74c3c")
        self._conf.setText(f"Conf.: {conf:.2f}")
        self._conf.setStyleSheet(f"color: {color};")

    def set_z(self, z_mm: float, z_dev_mm: float):
        self._z.setText(f"Z={z_mm:.0f}mm (Δ{z_dev_mm:+.0f})")


def _sep() -> QLabel:
    lbl = QLabel("|")
    lbl.setStyleSheet("color: #7f8c8d;")
    return lbl
