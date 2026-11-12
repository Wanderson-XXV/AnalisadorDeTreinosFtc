"""Configuration dialogs for camera, arena and robot."""

from __future__ import annotations

from PySide6.QtWidgets import (QCheckBox, QComboBox, QDialog, QDialogButtonBox,
                               QDoubleSpinBox, QFileDialog, QFormLayout,
                               QGroupBox, QHBoxLayout, QLabel, QLineEdit,
                               QMessageBox, QPushButton, QSpinBox,
                               QVBoxLayout, QWidget)

from ..aruco_detection import list_dictionaries
from ..arena import ArenaConfig
from ..camera import enumerate_cameras
from ..models import CameraConfig, RobotConfig


class CameraConfigDialog(QDialog):
    """Camera configuration with automatic device enumeration."""

    def __init__(self, config: CameraConfig, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Configuração da Câmera")
        self.setMinimumWidth(520)
        self.config = config
        self._detected: list[dict] = []  # populated by _scan_cameras

        layout = QVBoxLayout(self)

        # --- source selection ---
        src_group = QGroupBox("Fonte de vídeo")
        src_form = QFormLayout(src_group)

        self.source = QComboBox()
        self.source.addItems(["camera", "file", "demo"])
        self.source.setCurrentText(config.source_type)
        self.source.currentTextChanged.connect(self._on_source_changed)
        src_form.addRow("Tipo", self.source)

        # camera device picker
        self._cam_row_label = QLabel("Dispositivo")
        self.camera_combo = QComboBox()
        self.camera_combo.setMinimumWidth(340)
        self.camera_combo.currentIndexChanged.connect(self._on_device_selected)
        scan_btn = QPushButton("🔍 Detectar câmeras")
        scan_btn.setToolTip(
            "Varre os dispositivos de vídeo conectados (pode levar alguns segundos)")
        scan_btn.clicked.connect(self._scan_cameras)
        cam_row = QHBoxLayout()
        cam_row.addWidget(self.camera_combo, 1)
        cam_row.addWidget(scan_btn)
        cam_w = QWidget(); cam_w.setLayout(cam_row)
        src_form.addRow(self._cam_row_label, cam_w)

        self.index = QSpinBox(); self.index.setRange(0, 16)
        self.index.setValue(config.index)
        self.index.setToolTip(
            "Índice numérico do dispositivo (0 = primeira câmera, 1 = segunda, …)")
        src_form.addRow("Índice manual", self.index)

        self.file_path = QLineEdit(config.file_path)
        browse = QPushButton("...")
        browse.clicked.connect(self._browse)
        file_row = QHBoxLayout()
        file_row.addWidget(self.file_path, 1)
        file_row.addWidget(browse)
        file_w = QWidget(); file_w.setLayout(file_row)
        src_form.addRow("Arquivo de vídeo", file_w)

        layout.addWidget(src_group)

        # --- capture parameters ---
        cap_group = QGroupBox("Captura")
        cap_form = QFormLayout(cap_group)

        self.backend = QComboBox()
        self.backend.addItems(["auto", "dshow", "msmf", "v4l2"])
        self.backend.setCurrentText(config.backend)
        self.backend.setToolTip(
            "Backend de captura. No Windows tente 'dshow' se 'auto' não "
            "conseguir a resolução desejada. No Linux use 'v4l2'.")
        cap_form.addRow("Backend", self.backend)

        self.width = QSpinBox(); self.width.setRange(320, 4096)
        self.width.setValue(config.width)
        cap_form.addRow("Largura (px)", self.width)
        self.height = QSpinBox(); self.height.setRange(240, 2160)
        self.height.setValue(config.height)
        cap_form.addRow("Altura (px)", self.height)
        self.fps = QSpinBox(); self.fps.setRange(1, 120)
        self.fps.setValue(config.fps)
        cap_form.addRow("FPS", self.fps)

        layout.addWidget(cap_group)

        # --- controls ---
        ctrl_group = QGroupBox("Controles da câmera")
        ctrl_form = QFormLayout(ctrl_group)

        self.autofocus = QCheckBox("Ativado")
        self.autofocus.setChecked(config.autofocus)
        ctrl_form.addRow("Autofoco", self.autofocus)
        self.focus = QSpinBox(); self.focus.setRange(0, 255)
        self.focus.setValue(config.focus)
        ctrl_form.addRow("Foco manual", self.focus)

        self.autoexposure = QCheckBox("Ativada")
        self.autoexposure.setChecked(config.autoexposure)
        ctrl_form.addRow("Autoexposição", self.autoexposure)
        self.exposure = QSpinBox(); self.exposure.setRange(-13, 0)
        self.exposure.setValue(config.exposure)
        ctrl_form.addRow("Exposição manual", self.exposure)
        self.gain = QSpinBox(); self.gain.setRange(0, 255)
        self.gain.setValue(config.gain)
        ctrl_form.addRow("Ganho", self.gain)
        self.brightness = QSpinBox(); self.brightness.setRange(0, 255)
        self.brightness.setValue(config.brightness)
        ctrl_form.addRow("Brilho", self.brightness)

        hint = QLabel(
            "<i>Se um controle não for suportado pela câmera, ele será "
            "ignorado sem erro.</i>")
        hint.setWordWrap(True)
        ctrl_form.addRow(hint)

        layout.addWidget(ctrl_group)

        # --- buttons ---
        buttons = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

        # populate the camera combo with the current index as placeholder
        self.camera_combo.addItem(
            f"Camera {config.index} (não detectada ainda)", config.index)
        self._on_source_changed(config.source_type)

    # ---- helpers ----
    def _scan_cameras(self):
        """Probe a small range with the selected backend."""
        self.camera_combo.clear()
        self.camera_combo.addItem("Detectando…", -1)
        self.camera_combo.repaint()
        from PySide6.QtWidgets import QApplication
        QApplication.processEvents()

        self._detected = enumerate_cameras(
            max_index=4, backend=self.backend.currentText())
        self.camera_combo.clear()

        if not self._detected:
            self.camera_combo.addItem("Nenhuma câmera encontrada", -1)
            QMessageBox.information(
                self, "Detecção",
                "Nenhuma câmera foi encontrada.\n"
                "Verifique se a câmera está conectada e não está sendo "
                "usada por outro programa.")
            return

        select_idx = 0
        for i, cam in enumerate(self._detected):
            self.camera_combo.addItem(cam["name"], cam["index"])
            if cam["index"] == self.config.index:
                select_idx = i
        self.camera_combo.setCurrentIndex(select_idx)

    def _on_device_selected(self, combo_idx: int):
        """When the user picks a device from the combo, sync the index spinbox."""
        if combo_idx < 0:
            return
        device_index = self.camera_combo.currentData()
        if device_index is not None and device_index >= 0:
            self.index.setValue(device_index)

    def _on_source_changed(self, src: str):
        """Show/hide fields depending on the source type."""
        is_cam = (src == "camera")
        is_file = (src == "file")
        self.camera_combo.parentWidget().setVisible(is_cam)
        self._cam_row_label.setVisible(is_cam)
        self.index.parentWidget().setVisible(is_cam)
        self.file_path.parentWidget().setVisible(is_file)

    def _browse(self):
        path, _ = QFileDialog.getOpenFileName(
            self, "Selecionar vídeo", "", "Vídeos (*.mp4 *.avi *.mov *.mkv)")
        if path:
            self.file_path.setText(path)

    def get_config(self) -> CameraConfig:
        return CameraConfig(
            name=self.config.name,
            source_type=self.source.currentText(),
            index=self.index.value(),
            file_path=self.file_path.text(),
            backend=self.backend.currentText(),
            width=self.width.value(),
            height=self.height.value(),
            fps=self.fps.value(),
            autofocus=self.autofocus.isChecked(),
            focus=self.focus.value(),
            autoexposure=self.autoexposure.isChecked(),
            exposure=self.exposure.value(),
            gain=self.gain.value(),
            brightness=self.brightness.value(),
        )


class ArenaConfigDialog(QDialog):
    """Arena configuration with optional zone file loading."""

    def __init__(self, config: ArenaConfig, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Configuração da Arena")
        self.setMinimumWidth(480)
        self.config = config
        self._zones = list(config.zones)  # mutable copy

        layout = QVBoxLayout(self)

        # --- dimensions ---
        dim_group = QGroupBox("Dimensões da arena")
        form = QFormLayout(dim_group)

        self.name = QLineEdit(config.name)
        form.addRow("Nome", self.name)
        self.width = QDoubleSpinBox(); self.width.setRange(10, 100000)
        self.width.setValue(config.width_mm); self.width.setSuffix(" mm")
        form.addRow("Largura", self.width)
        self.height = QDoubleSpinBox(); self.height.setRange(10, 100000)
        self.height.setValue(config.height_mm); self.height.setSuffix(" mm")
        form.addRow("Altura", self.height)

        layout.addWidget(dim_group)

        # --- coordinate system ---
        coord_group = QGroupBox("Sistema de coordenadas")
        coord_form = QFormLayout(coord_group)

        self.origin = QComboBox()
        self.origin.addItems(["top-left", "top-right",
                              "bottom-left", "bottom-right"])
        self.origin.setCurrentText(config.origin)
        coord_form.addRow("Origem", self.origin)
        self.x_axis = QComboBox(); self.x_axis.addItems(["right", "left"])
        self.x_axis.setCurrentText(config.x_axis)
        coord_form.addRow("Eixo X", self.x_axis)
        self.y_axis = QComboBox(); self.y_axis.addItems(["down", "up"])
        self.y_axis.setCurrentText(config.y_axis)
        coord_form.addRow("Eixo Y", self.y_axis)

        layout.addWidget(coord_group)

        # --- visual ---
        vis_group = QGroupBox("Visual")
        vis_form = QFormLayout(vis_group)

        self.bg = QLineEdit(config.background_image)
        bg_browse = QPushButton("...")
        bg_browse.clicked.connect(self._browse_bg)
        bg_row = QHBoxLayout()
        bg_row.addWidget(self.bg, 1); bg_row.addWidget(bg_browse)
        bg_w = QWidget(); bg_w.setLayout(bg_row)
        vis_form.addRow("Imagem de fundo", bg_w)

        layout.addWidget(vis_group)

        # --- zones ---
        zone_group = QGroupBox("Zonas (opcional)")
        zone_layout = QVBoxLayout(zone_group)
        zone_help = QLabel(
            "Zonas são regiões nomeadas dentro da arena (ex: partida, chegada, "
            "obstáculo). Servem para identificar onde o robô está durante os "
            "testes. São definidas como polígonos em milímetros dentro de um "
            "arquivo YAML.\n\n"
            "Se você não precisa de zonas, deixe em branco.")
        zone_help.setWordWrap(True)
        zone_layout.addWidget(zone_help)

        self.zones_file = QLineEdit("")
        zones_browse = QPushButton("Carregar YAML de zonas...")
        zones_browse.clicked.connect(self._browse_zones)
        z_row = QHBoxLayout()
        z_row.addWidget(self.zones_file, 1); z_row.addWidget(zones_browse)
        z_w = QWidget(); z_w.setLayout(z_row)
        zone_layout.addWidget(z_w)

        self.zones_label = QLabel(self._zones_summary())
        self.zones_label.setWordWrap(True)
        zone_layout.addWidget(self.zones_label)

        clear_btn = QPushButton("Limpar zonas")
        clear_btn.clicked.connect(self._clear_zones)
        zone_layout.addWidget(clear_btn)

        layout.addWidget(zone_group)

        # --- buttons ---
        buttons = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

    def _browse_bg(self):
        path, _ = QFileDialog.getOpenFileName(
            self, "Imagem de fundo", "", "Imagens (*.png *.jpg *.jpeg)")
        if path:
            self.bg.setText(path)

    def _browse_zones(self):
        path, _ = QFileDialog.getOpenFileName(
            self, "Arquivo de zonas", "", "YAML (*.yaml *.yml)")
        if not path:
            return
        self.zones_file.setText(path)
        try:
            import yaml
            from ..models import Zone
            with open(path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
            # support both top-level list and nested under "zones" or "arena.zones"
            zone_list = data
            if isinstance(data, dict):
                zone_list = data.get("zones", data.get("arena", {}).get("zones", []))
            if not isinstance(zone_list, list):
                raise ValueError("O arquivo não contém uma lista de zonas.")
            self._zones = [Zone.from_dict(z) for z in zone_list]
            self.zones_label.setText(self._zones_summary())
        except Exception as e:
            QMessageBox.warning(
                self, "Erro ao carregar zonas", str(e))

    def _clear_zones(self):
        self._zones = []
        self.zones_file.clear()
        self.zones_label.setText(self._zones_summary())

    def _zones_summary(self) -> str:
        if not self._zones:
            return "<i>Nenhuma zona carregada.</i>"
        lines = [f"<b>{len(self._zones)} zona(s) carregada(s):</b>"]
        for z in self._zones:
            lines.append(f"  • {z.name} ({z.type}) — {len(z.polygon)} vértices")
        return "<br>".join(lines)

    def get_config(self) -> ArenaConfig:
        return ArenaConfig(
            name=self.name.text(),
            width_mm=self.width.value(),
            height_mm=self.height.value(),
            origin=self.origin.currentText(),
            x_axis=self.x_axis.currentText(),
            y_axis=self.y_axis.currentText(),
            background_image=self.bg.text(),
            zones=self._zones,
        )


class RobotConfigDialog(QDialog):
    def __init__(self, config: RobotConfig, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Configuração do Robô / Marcador")
        self.config = config
        form = QFormLayout()

        self.name = QLineEdit(config.name)
        form.addRow("Nome", self.name)
        self.dictionary = QComboBox()
        self.dictionary.addItems(list_dictionaries())
        self.dictionary.setCurrentText(config.marker_dictionary)
        form.addRow("Dicionário ArUco", self.dictionary)
        self.marker_id = QSpinBox(); self.marker_id.setRange(0, 1000)
        self.marker_id.setValue(config.marker_id)
        form.addRow("ID do marcador", self.marker_id)

        self.marker_length = _mm_spin(config.marker_length_mm)
        form.addRow("Lado do marcador (borda preta)", self.marker_length)
        self.white_margin = _mm_spin(config.white_margin_mm)
        form.addRow("Margem branca (impressão)", self.white_margin)
        self.marker_height = _mm_spin(config.marker_height_mm)
        form.addRow("Altura do marcador", self.marker_height)

        self.offset_x = _mm_spin(config.offset_x_mm, -2000, 2000)
        form.addRow("Offset X (marcador→robô)", self.offset_x)
        self.offset_y = _mm_spin(config.offset_y_mm, -2000, 2000)
        form.addRow("Offset Y (marcador→robô)", self.offset_y)
        self.offset_heading = QDoubleSpinBox()
        self.offset_heading.setRange(-180, 180)
        self.offset_heading.setSuffix(" °")
        self.offset_heading.setValue(config.offset_heading_deg)
        form.addRow("Offset angular", self.offset_heading)

        self.robot_width = _mm_spin(config.robot_width_mm)
        form.addRow("Largura do robô", self.robot_width)
        self.robot_length = _mm_spin(config.robot_length_mm)
        form.addRow("Comprimento do robô", self.robot_length)

        buttons = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout = QVBoxLayout(self)
        layout.addLayout(form)
        layout.addWidget(buttons)

    def get_config(self) -> RobotConfig:
        return RobotConfig(
            name=self.name.text(),
            marker_dictionary=self.dictionary.currentText(),
            marker_id=self.marker_id.value(),
            marker_length_mm=self.marker_length.value(),
            white_margin_mm=self.white_margin.value(),
            marker_height_mm=self.marker_height.value(),
            offset_x_mm=self.offset_x.value(),
            offset_y_mm=self.offset_y.value(),
            offset_heading_deg=self.offset_heading.value(),
            robot_width_mm=self.robot_width.value(),
            robot_length_mm=self.robot_length.value(),
        )


def _mm_spin(value, lo=0.0, hi=100000.0) -> QDoubleSpinBox:
    sb = QDoubleSpinBox()
    sb.setRange(lo, hi)
    sb.setDecimals(1)
    sb.setSuffix(" mm")
    sb.setValue(value)
    return sb
