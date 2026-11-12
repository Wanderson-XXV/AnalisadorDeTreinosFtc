"""Review a saved test: trajectory plot + time-series charts."""

from __future__ import annotations

import os
from typing import Dict, List, Optional

import matplotlib
matplotlib.use("QtAgg")
from matplotlib.backends.backend_qtagg import FigureCanvasQTAgg as FigureCanvas
from matplotlib.figure import Figure
from PySide6.QtWidgets import (QDialog, QFileDialog, QHBoxLayout, QLabel,
                               QPushButton, QTextEdit, QVBoxLayout, QWidget)

from .. import persistence


class ReviewDialog(QDialog):
    def __init__(self, result_json_path: Optional[str] = None, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Revisão de Teste")
        self.resize(1000, 700)

        layout = QVBoxLayout(self)
        top = QHBoxLayout()
        self.btn_load = QPushButton("Abrir resultado (.json)…")
        self.btn_load.clicked.connect(self._load_dialog)
        top.addWidget(self.btn_load)
        self.path_label = QLabel("Nenhum resultado carregado")
        top.addWidget(self.path_label, 1)
        layout.addLayout(top)

        body = QHBoxLayout()
        self.figure = Figure(figsize=(8, 6))
        self.canvas = FigureCanvas(self.figure)
        body.addWidget(self.canvas, 3)
        self.summary = QTextEdit()
        self.summary.setReadOnly(True)
        self.summary.setMaximumWidth(300)
        body.addWidget(self.summary, 1)
        layout.addLayout(body)

        if result_json_path:
            self.load(result_json_path)

    # ------------------------------------------------------------------
    def _load_dialog(self):
        path, _ = QFileDialog.getOpenFileName(
            self, "Abrir resultado", "outputs", "JSON (*.json)")
        if path:
            self.load(path)

    def load(self, path: str):
        try:
            doc = persistence.load_result_json(path)
        except Exception as exc:
            self.summary.setText(f"Erro ao carregar: {exc}")
            return
        self.path_label.setText(path)
        positions = self._find_positions_csv(path, doc)
        self._plot(doc, positions)
        self._show_summary(doc)

    def _find_positions_csv(self, json_path: str, doc: Dict) -> List[Dict]:
        base = os.path.dirname(json_path)
        candidate = os.path.join(
            base, doc.get("files", {}).get("positions_csv", "positions.csv"))
        if os.path.exists(candidate):
            try:
                return persistence.load_positions_csv(candidate)
            except Exception:
                return []
        return []

    def _plot(self, doc: Dict, positions: List[Dict]):
        self.figure.clear()
        start = doc.get("start_capture", {})
        end = doc.get("end_capture", {})

        xs, ys, ts, headings, lat = [], [], [], [], []
        for row in positions:
            if int(float(row.get("marker_visible", 0))) == 0:
                continue
            xs.append(float(row["x_mm"]))
            ys.append(float(row["y_mm"]))
            ts.append(float(row["timestamp_seconds"]))
            headings.append(float(row["heading_deg"]))

        ax1 = self.figure.add_subplot(2, 2, 1)
        ax1.set_title("Trajetória (arena)")
        ax1.set_xlabel("X (mm)"); ax1.set_ylabel("Y (mm)")
        if xs:
            ax1.plot(xs, ys, "-", color="#2ecc71", label="trajetória")
        if start:
            ax1.plot(start.get("x_mm", 0), start.get("y_mm", 0),
                     "o", color="#3498db", markersize=9, label="início")
        if end:
            ax1.plot(end.get("x_mm", 0), end.get("y_mm", 0),
                     "s", color="#e74c3c", markersize=9, label="fim")
        ax1.invert_yaxis()  # arena Y grows downwards
        ax1.legend(fontsize=7); ax1.grid(alpha=0.3)

        ax2 = self.figure.add_subplot(2, 2, 2)
        ax2.set_title("X, Y vs tempo")
        if ts:
            ax2.plot(ts, xs, label="X", color="#3498db")
            ax2.plot(ts, ys, label="Y", color="#e67e22")
        ax2.set_xlabel("t (s)"); ax2.set_ylabel("mm")
        ax2.legend(fontsize=7); ax2.grid(alpha=0.3)

        ax3 = self.figure.add_subplot(2, 2, 3)
        ax3.set_title("Direção vs tempo")
        if ts:
            ax3.plot(ts, headings, color="#9b59b6")
        ax3.set_xlabel("t (s)"); ax3.set_ylabel("graus")
        ax3.grid(alpha=0.3)

        ax4 = self.figure.add_subplot(2, 2, 4)
        ax4.set_title("Erro lateral vs percurso")
        if xs and start:
            import numpy as np
            import math
            h0 = math.radians(start.get("heading_deg", 0.0))
            fwd = np.array([math.cos(h0), math.sin(h0)])
            right = np.array([-fwd[1], fwd[0]])
            ini = np.array([start.get("x_mm", 0), start.get("y_mm", 0)])
            longd, latd = [], []
            for x, y in zip(xs, ys):
                d = np.array([x, y]) - ini
                longd.append(float(d @ fwd))
                latd.append(float(d @ right))
            ax4.plot(longd, latd, color="#e74c3c")
        ax4.set_xlabel("Longitudinal (mm)"); ax4.set_ylabel("Lateral (mm)")
        ax4.grid(alpha=0.3)

        self.figure.tight_layout()
        self.canvas.draw()

    def _show_summary(self, doc: Dict):
        cfg = doc.get("config", {})
        res = doc.get("result", {})
        lines = [
            f"Teste: {cfg.get('name', '-')}",
            f"Sessão: {cfg.get('session', '-')}",
            f"Distância solicitada: {cfg.get('requested_distance_mm', 0):.0f} mm",
            "",
            "── Resultado ──",
            f"Erro long.: {res.get('longitudinal_error_mm', 0):+.1f} mm",
            f"Desvio lat.: {res.get('lateral_deviation_mm', 0):+.1f} mm",
            f"Erro direção: {res.get('heading_error_deg', 0):+.2f}°",
            f"Deslocamento: {res.get('total_displacement_mm', 0):.1f} mm",
            f"Duração: {res.get('duration_s', 0):.2f} s",
            f"Vel. média: {res.get('average_speed_mm_s', 0):.1f} mm/s",
            f"Erro lat. máx.: {res.get('max_lateral_error_mm', 0):.1f} mm",
            f"Erro dir. máx.: {res.get('max_heading_error_deg', 0):.2f}°",
            "",
            f"Bateria: {cfg.get('battery', '-')}",
            f"Notas: {cfg.get('notes', '')}",
        ]
        self.summary.setText("\n".join(lines))
