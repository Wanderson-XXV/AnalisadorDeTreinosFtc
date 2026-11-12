"""Test controls: state machine buttons, config form and result display."""

from __future__ import annotations

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (QCheckBox, QDoubleSpinBox, QFormLayout,
                               QGroupBox, QHBoxLayout, QLabel, QLineEdit,
                               QPlainTextEdit, QPushButton, QVBoxLayout,
                               QWidget)

from ..models import TestConfig, TestResult, TestState


class TestControls(QWidget):
    """Emits high-level signals the main window connects to the state machine."""

    new_test_requested = Signal(object)      # TestConfig
    capture_start_requested = Signal()
    start_recording_requested = Signal()
    capture_end_requested = Signal()
    save_requested = Signal()
    discard_requested = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        layout = QVBoxLayout(self)

        # ---- configuration form -----------------------------------
        cfg_box = QGroupBox("Configuração do Teste")
        form = QFormLayout(cfg_box)
        self.name = QLineEdit("teste_01")
        form.addRow("Nome", self.name)
        self.session = QLineEdit("sessao_01")
        form.addRow("Sessão", self.session)
        self.distance = _num(1000, 0, 100000, " mm")
        form.addRow("Distância solicitada", self.distance)
        self.target_heading = _num(0, -3600, 3600, " °")
        form.addRow("Mudança de direção alvo", self.target_heading)
        self.max_velocity = _num(0, 0, 100000)
        form.addRow("Velocidade máx.", self.max_velocity)
        self.acceleration = _num(0, 0, 100000)
        form.addRow("Aceleração", self.acceleration)
        self.deceleration = _num(0, 0, 100000)
        form.addRow("Desaceleração", self.deceleration)
        self.p_factor = _num(0, 0, 10000)
        form.addRow("Fator P (opcional)", self.p_factor)
        self.battery = QLineEdit("")
        form.addRow("Bateria", self.battery)
        self.record_video = QCheckBox("Gravar vídeo")
        self.record_video.setChecked(True)
        form.addRow(self.record_video)
        self.notes = QPlainTextEdit()
        self.notes.setMaximumHeight(50)
        form.addRow("Notas", self.notes)
        layout.addWidget(cfg_box)

        # ---- state machine buttons --------------------------------
        btn_box = QGroupBox("Fluxo do Teste")
        btn_layout = QVBoxLayout(btn_box)
        self.state_label = QLabel("Estado: READY")
        self.state_label.setStyleSheet("font-weight:bold; color:#3498db;")
        btn_layout.addWidget(self.state_label)

        self.btn_new = QPushButton("1. Novo Teste")
        self.btn_capture_start = QPushButton("2. Capturar Início")
        self.btn_record = QPushButton("3. Iniciar Gravação")
        self.btn_capture_end = QPushButton("4. Capturar Fim")
        self.btn_save = QPushButton("5. Salvar Resultado")
        self.btn_discard = QPushButton("Descartar")
        for b in (self.btn_new, self.btn_capture_start, self.btn_record,
                  self.btn_capture_end, self.btn_save, self.btn_discard):
            btn_layout.addWidget(b)
        layout.addWidget(btn_box)

        self.btn_new.clicked.connect(self._on_new)
        self.btn_capture_start.clicked.connect(self.capture_start_requested)
        self.btn_record.clicked.connect(self.start_recording_requested)
        self.btn_capture_end.clicked.connect(self.capture_end_requested)
        self.btn_save.clicked.connect(self.save_requested)
        self.btn_discard.clicked.connect(self.discard_requested)

        # ---- result display ---------------------------------------
        self.result_box = QGroupBox("Resultado")
        rl = QVBoxLayout(self.result_box)
        self.result_label = QLabel("—")
        self.result_label.setTextFormat(Qt.RichText)
        self.result_label.setWordWrap(True)
        rl.addWidget(self.result_label)
        layout.addWidget(self.result_box)
        layout.addStretch(1)

        self.set_state(TestState.READY)

    # ------------------------------------------------------------------
    def _on_new(self):
        self.new_test_requested.emit(self.get_config())

    def get_config(self) -> TestConfig:
        pf = self.p_factor.value()
        return TestConfig(
            name=self.name.text().strip() or "teste",
            session=self.session.text().strip() or "sessao",
            requested_distance_mm=self.distance.value(),
            target_heading_change_deg=self.target_heading.value(),
            max_velocity=self.max_velocity.value(),
            acceleration=self.acceleration.value(),
            deceleration=self.deceleration.value(),
            p_factor=pf if pf > 0 else None,
            battery=self.battery.text(),
            notes=self.notes.toPlainText(),
            record_video=self.record_video.isChecked(),
        )

    # ------------------------------------------------------------------
    def set_state(self, state: TestState):
        self.state_label.setText(f"Estado: {state.value}")
        enable = {
            "new": state in (TestState.READY, TestState.SAVED,
                             TestState.DISCARDED, TestState.RESULT),
            "capture_start": state == TestState.NEW_TEST,
            "record": state == TestState.CAPTURING_START,
            "capture_end": state == TestState.RECORDING,
            "save": state == TestState.RESULT,
            "discard": state not in (TestState.READY, TestState.SAVED,
                                     TestState.DISCARDED),
        }
        self.btn_new.setEnabled(enable["new"])
        self.btn_capture_start.setEnabled(enable["capture_start"])
        self.btn_record.setEnabled(enable["record"])
        self.btn_capture_end.setEnabled(enable["capture_end"])
        self.btn_save.setEnabled(enable["save"])
        self.btn_discard.setEnabled(enable["discard"])

    def show_result(self, result: TestResult, start_warn="", end_warn=""):
        html = (
            f"<b>Erro longitudinal:</b> {result.longitudinal_error_mm:+.1f} mm "
            f"(percorrido {result.longitudinal_distance_mm:.1f} mm)<br>"
            f"<b>Desvio lateral:</b> {result.lateral_deviation_mm:+.1f} mm "
            f"({'direita' if result.lateral_deviation_mm >= 0 else 'esquerda'})<br>"
            f"<b>Erro de direção:</b> {result.heading_error_deg:+.2f}°<br>"
            f"<b>Deslocamento total:</b> {result.total_displacement_mm:.1f} mm<br>"
            f"<b>Duração:</b> {result.duration_s:.2f} s<br>"
            f"<b>Velocidade média:</b> {result.average_speed_mm_s:.1f} mm/s<br>"
            f"<b>Erro lateral máx.:</b> {result.max_lateral_error_mm:.1f} mm<br>"
            f"<b>Erro direção máx.:</b> {result.max_heading_error_deg:.2f}°"
        )
        warns = [w for w in (start_warn, end_warn) if w]
        if warns:
            html += ("<br><span style='color:#e67e22;'>⚠ "
                     + "; ".join(warns) + "</span>")
        self.result_label.setText(html)

    def clear_result(self):
        self.result_label.setText("—")


def _num(value, lo, hi, suffix=""):
    sb = QDoubleSpinBox()
    sb.setRange(lo, hi)
    sb.setDecimals(1)
    if suffix:
        sb.setSuffix(suffix)
    sb.setValue(value)
    return sb
