"""Main application window: wires every component into a live workflow.

The window owns the camera, detector, pose estimator, arena registration and
the tuning-test state machine. A ``QTimer`` drives the per-frame loop:

    read -> detect -> recover extrinsics -> estimate pose (raw)
         -> smooth (display only) -> update panels/status
         -> feed the state machine + video recorder

All user facing strings are in Brazilian Portuguese.
"""

from __future__ import annotations

import os
import time
from typing import List, Optional

import numpy as np
from PySide6.QtCore import Qt, QTimer
from PySide6.QtWidgets import (QDockWidget, QFileDialog, QMainWindow,
                               QMessageBox, QSplitter, QWidget)

from .. import persistence
from ..arena import ArenaConfig
from ..arena_registration import ArenaRegistration
from ..aruco_detection import ArucoDetector
from ..camera import CameraManager
from ..camera_calibration import CharucoBoardSpec
from ..models import (CalibrationData, CameraConfig, RobotConfig, RobotPose,
                      TestConfig, TestState)
from ..recording import VideoRecorder
from ..robot_pose import PoseSmoother, RobotPoseEstimator
from ..tuning_test import TuningTest
from .arena_panel import ArenaPanel
from .calibration_wizard import CalibrationWizard
from .camera_panel import CameraPanel
from .config_dialogs import (ArenaConfigDialog, CameraConfigDialog,
                             RobotConfigDialog)
from .registration_dialog import RegistrationDialog
from .review_dialog import ReviewDialog
from .status_bar import StatusBar
from .test_controls import TestControls


# how many stationary samples an end-capture collects before auto-finalising
_END_CAPTURE_SAMPLES = 30
_START_CAPTURE_MIN_SAMPLES = 15


class MainWindow(QMainWindow):
    """Top level orchestrator."""

    def __init__(self, base_dir: str = "."):
        super().__init__()
        self.setWindowTitle("Protótipo de Ajuste ArUco - Rastreamento de Robô")
        self.resize(1280, 800)

        self.base_dir = os.path.abspath(base_dir)
        self.outputs_dir = os.path.join(self.base_dir, "outputs")
        self.configs_dir = os.path.join(self.base_dir, "configs")
        self.calib_dir = os.path.join(self.base_dir, "calibrations")

        # ---- core state -------------------------------------------
        self.camera_config = CameraConfig()
        self.arena = ArenaConfig()
        self.robot_config = RobotConfig()
        self.board_spec = CharucoBoardSpec()
        self.calibration = CalibrationData()

        self.camera = CameraManager(self.camera_config)
        self.detector = ArucoDetector(self.robot_config.marker_dictionary)
        self.registration = ArenaRegistration()
        self.pose_estimator = RobotPoseEstimator(self.robot_config)
        self.smoother = PoseSmoother()
        self.test = TuningTest()
        self.recorder = VideoRecorder()
        self.session_mgr = persistence.SessionManager(self.outputs_dir)

        self._frame_index = 0
        self._collecting: Optional[str] = None  # None|'start'|'end'
        self._session_poses: List[RobotPose] = []
        self._last_frame: Optional[np.ndarray] = None
        self._last_pose: Optional[RobotPose] = None
        self._current_test_dir = ""

        # ---- widgets ----------------------------------------------
        self.camera_panel = CameraPanel()
        self.arena_panel = ArenaPanel()
        self.arena_panel.set_arena(self.arena)
        self.arena_panel.set_robot_config(self.robot_config)

        splitter = QSplitter(Qt.Horizontal)
        splitter.addWidget(self.camera_panel)
        splitter.addWidget(self.arena_panel)
        splitter.setStretchFactor(0, 3)
        splitter.setStretchFactor(1, 2)
        self.setCentralWidget(splitter)

        self.controls = TestControls()
        dock = QDockWidget("Controle de Teste", self)
        dock.setWidget(self.controls)
        dock.setAllowedAreas(Qt.LeftDockWidgetArea | Qt.RightDockWidgetArea)
        self.addDockWidget(Qt.RightDockWidgetArea, dock)

        self.status = StatusBar(self)
        self.setStatusBar(self.status)

        self._build_menu()
        self._connect_controls()

        # ---- frame loop -------------------------------------------
        self.timer = QTimer(self)
        self.timer.timeout.connect(self._on_frame)

        self._refresh_status_static()
        self._try_load_default_configs()

        # auto-connect camera on startup (non-blocking — if it fails, user
        # can configure manually)
        QTimer.singleShot(200, self._auto_connect_camera)

    # ==================================================================
    # Menu
    # ==================================================================
    def _build_menu(self) -> None:
        mb = self.menuBar()

        m_file = mb.addMenu("&Arquivo")
        m_file.addAction("Carregar configurações...", self.load_all_configs)
        m_file.addAction("Salvar configurações...", self.save_all_configs)
        m_file.addSeparator()
        m_file.addAction("Sair", self.close)

        m_cam = mb.addMenu("&Câmera")
        m_cam.addAction("Configurar câmera...", self.configure_camera)
        m_cam.addAction("Conectar", self.connect_camera)
        m_cam.addAction("Modo demonstração", self.start_demo)
        m_cam.addAction("Desconectar", self.disconnect_camera)
        m_cam.addSeparator()
        m_cam.addAction("Assistente de calibração...", self.run_calibration)
        m_cam.addAction("Carregar calibração...", self.load_calibration)
        m_cam.addAction("Salvar calibração...", self.save_calibration)

        m_arena = mb.addMenu("A&rena")
        m_arena.addAction("Configurar arena...", self.configure_arena)
        m_arena.addAction("Registrar câmera ↔ arena...", self.register_arena)
        m_arena.addAction("Aprender referências", self.learn_references)
        m_arena.addAction("Registro rápido (demo)", self.quick_register_demo)
        m_arena.addSeparator()
        m_arena.addAction("Carregar registro...", self.load_registration)
        m_arena.addAction("Salvar registro...", self.save_registration)

        m_robot = mb.addMenu("R&obô")
        m_robot.addAction("Configurar robô...", self.configure_robot)

        m_test = mb.addMenu("&Teste")
        m_test.addAction("Revisar resultado salvo...", self.review_result)

        m_help = mb.addMenu("A&juda")
        m_help.addAction("Sobre", self.show_about)

    def _connect_controls(self) -> None:
        self.controls.new_test_requested.connect(self.on_new_test)
        self.controls.capture_start_requested.connect(self.on_capture_start)
        self.controls.start_recording_requested.connect(self.on_start_recording)
        self.controls.capture_end_requested.connect(self.on_capture_end)
        self.controls.save_requested.connect(self.on_save_result)
        self.controls.discard_requested.connect(self.on_discard)

    # ==================================================================
    # Camera lifecycle
    # ==================================================================
    def configure_camera(self) -> None:
        # A UVC camera may not allow a second DirectShow handle while it is
        # streaming. Release the active handle so "Detectar cameras" can see
        # the device, then restore it after the modal dialog closes.
        was_open = self.camera.is_open()
        if was_open:
            self.timer.stop()
            self.camera.close()
        dlg = CameraConfigDialog(self.camera_config, self)
        if dlg.exec():
            new_cfg = dlg.get_config()
            changed = (new_cfg.index != self.camera_config.index
                       or new_cfg.source_type != self.camera_config.source_type
                       or new_cfg.file_path != self.camera_config.file_path
                       or new_cfg.backend != self.camera_config.backend
                       or new_cfg.width != self.camera_config.width
                       or new_cfg.height != self.camera_config.height)
            self.camera_config = new_cfg
            # Restore the live preview after a scan, even if configuration
            # values themselves did not change.
            if changed or was_open:
                self._open_camera()
        elif was_open:
            self._open_camera(silent=True)

    def connect_camera(self) -> None:
        self.camera_config.source_type = (
            "file" if self.camera_config.file_path else "camera")
        self._open_camera()

    def start_demo(self) -> None:
        self.camera_config.source_type = "demo"
        self.camera_config.width = 1280
        self.camera_config.height = 720
        if self._open_camera():
            # auto-configure calibration + registration from the demo scene
            self.quick_register_demo(silent=True)
            self.status.showMessage(
                "Modo demonstração ativo (calibração e registro automáticos).",
                5000)

    def _open_camera(self, silent: bool = False) -> bool:
        if not self.camera.open(self.camera_config):
            if not silent:
                QMessageBox.warning(
                    self, "Câmera",
                    "Não foi possível abrir a fonte de vídeo. Verifique o "
                    "índice ou o caminho do arquivo.\n\n"
                    "Use Câmera → Configurar câmera → Detectar câmeras "
                    "para ver quais dispositivos estão disponíveis.")
            self.status.set_camera(False)
            return False
        self.detector.set_dictionary(self.robot_config.marker_dictionary)
        self.smoother.reset()
        self._frame_index = 0
        self.timer.start(30)  # ~33 fps target
        st = self.camera.state
        self.status.set_camera(True, st.actual_width, st.actual_height,
                               st.actual_fps or self.camera_config.fps)
        return True

    def _auto_connect_camera(self) -> None:
        """Try to connect the camera on startup — silently skip on failure."""
        if self.camera.is_open():
            return
        src = self.camera_config.source_type
        if src == "demo":
            self.start_demo()
        elif src in ("camera", "file"):
            ok = self._open_camera(silent=True)
            if ok:
                self.status.showMessage(
                    f"Câmera conectada (índice {self.camera_config.index}, "
                    f"{self.camera.state.actual_width}×"
                    f"{self.camera.state.actual_height}).", 5000)
            else:
                self.status.showMessage(
                    "Câmera não encontrada. Use Câmera → Configurar câmera "
                    "para selecionar o dispositivo correto.", 8000)

    def disconnect_camera(self) -> None:
        self.timer.stop()
        self.camera.close()
        self.status.set_camera(False)

    # ==================================================================
    # Calibration
    # ==================================================================
    def run_calibration(self) -> None:
        if not self.camera.is_open():
            QMessageBox.information(
                self, "Calibração",
                "Conecte a câmera antes de calibrar.")
            return
        was_running = self.timer.isActive()
        self.timer.stop()
        dlg = CalibrationWizard(self.camera, self.board_spec, self)
        dlg.exec()
        if dlg.result is not None:
            self.calibration = dlg.result
            self._refresh_status_static()
        if was_running:
            self.timer.start(30)

    def load_calibration(self) -> None:
        path, _ = QFileDialog.getOpenFileName(
            self, "Carregar calibração", self.calib_dir,
            "YAML (*.yaml *.yml)")
        if not path:
            return
        self.calibration = persistence.load_calibration(path)
        self._refresh_status_static()

    def save_calibration(self) -> None:
        if not self.calibration.is_valid:
            QMessageBox.information(self, "Calibração",
                                    "Não há calibração válida para salvar.")
            return
        path, _ = QFileDialog.getSaveFileName(
            self, "Salvar calibração",
            os.path.join(self.calib_dir, "camera_calibration.yaml"),
            "YAML (*.yaml *.yml)")
        if path:
            persistence.save_calibration(self.calibration, path)

    # ==================================================================
    # Arena / robot config
    # ==================================================================
    def configure_arena(self) -> None:
        dlg = ArenaConfigDialog(self.arena, self)
        if dlg.exec():
            self.arena = dlg.get_config()
            self.arena_panel.set_arena(self.arena)

    def configure_robot(self) -> None:
        dlg = RobotConfigDialog(self.robot_config, self)
        if dlg.exec():
            self.robot_config = dlg.get_config()
            self.pose_estimator.robot_config = self.robot_config
            self.detector.set_dictionary(self.robot_config.marker_dictionary)
            self.arena_panel.set_robot_config(self.robot_config)

    # ==================================================================
    # Registration
    # ==================================================================
    def register_arena(self) -> None:
        if self._last_frame is None:
            QMessageBox.information(
                self, "Registro", "Conecte a câmera para obter um quadro.")
            return
        if not self.calibration.is_valid:
            QMessageBox.information(
                self, "Registro",
                "Calibre a câmera antes de registrar a arena.")
            return
        was_running = self.timer.isActive()
        self.timer.stop()
        dlg = RegistrationDialog(
            self._last_frame.copy(), self.arena, self.calibration,
            self.robot_config, self.registration, self)
        if dlg.exec():
            self.registration = dlg.get_registration()
            self.arena_panel.set_registration(self.registration.data)
            self._refresh_status_static()
        if was_running:
            self.timer.start(30)

    def learn_references(self) -> None:
        if self._last_frame is None or not self.calibration.is_valid:
            QMessageBox.information(
                self, "Referências",
                "É necessário câmera conectada, calibrada e registrada.")
            return
        dets = self.detector.detect(self._last_frame)
        n, msg = self.registration.learn_references(
            dets, self.calibration.camera_matrix,
            self.calibration.dist_coeffs,
            exclude_ids=[self.robot_config.marker_id])
        self.arena_panel.set_registration(self.registration.data)
        QMessageBox.information(self, "Referências", msg)

    def quick_register_demo(self, silent: bool = False) -> None:
        """Auto-configure calibration + registration from the demo scene."""
        demo = getattr(self.camera, "_demo", None)
        if demo is None:
            if not silent:
                QMessageBox.information(
                    self, "Registro rápido",
                    "Disponível apenas no modo demonstração.")
            return
        # calibration + geometry ground truth
        self.calibration = demo.get_calibration()
        self.robot_config.marker_dictionary = "DICT_4X4_50"
        self.robot_config.marker_id = demo.ROBOT_ID
        self.robot_config.marker_length_mm = demo.MARKER_LEN
        self.robot_config.marker_height_mm = demo.ROBOT_HEIGHT
        self.pose_estimator.robot_config = self.robot_config
        self.detector.set_dictionary("DICT_4X4_50")
        self.arena = ArenaConfig(width_mm=demo.ARENA_W, height_mm=demo.ARENA_H)
        self.arena_panel.set_arena(self.arena)
        self.arena_panel.set_robot_config(self.robot_config)

        ok, frame = self.camera.read()
        if not ok:
            return
        dets = self.detector.detect(frame)
        det_by_id = {d.marker_id: d for d in dets}
        refs = demo.get_reference_corners()
        self.registration = ArenaRegistration()
        for mid, arena_corners in refs.items():
            if mid in det_by_id:
                img_c = det_by_id[mid].corners.reshape(4, 2)
                self.registration.add_correspondence(
                    img_c.mean(axis=0), arena_corners[:, :2].mean(axis=0))
        ok2, msg = self.registration.compute_extrinsics(
            self.calibration.camera_matrix, self.calibration.dist_coeffs)
        if ok2:
            self.registration.learn_references(
                dets, self.calibration.camera_matrix,
                self.calibration.dist_coeffs,
                exclude_ids=[self.robot_config.marker_id])
        self.arena_panel.set_registration(self.registration.data)
        self._refresh_status_static()
        if not silent:
            QMessageBox.information(self, "Registro rápido", msg)

    def load_registration(self) -> None:
        path, _ = QFileDialog.getOpenFileName(
            self, "Carregar registro", self.configs_dir, "YAML (*.yaml *.yml)")
        if not path:
            return
        data = persistence.load_registration(path)
        self.registration = ArenaRegistration(data)
        self.arena_panel.set_registration(self.registration.data)
        self._refresh_status_static()

    def save_registration(self) -> None:
        path, _ = QFileDialog.getSaveFileName(
            self, "Salvar registro",
            os.path.join(self.configs_dir, "registration.yaml"),
            "YAML (*.yaml *.yml)")
        if path:
            persistence.save_registration(self.registration.data, path)

    # ==================================================================
    # Config load/save
    # ==================================================================
    def _try_load_default_configs(self) -> None:
        mapping = [
            ("camera.yaml", self._apply_camera_cfg),
            ("arena.yaml", self._apply_arena_cfg),
            ("robot.yaml", self._apply_robot_cfg),
            ("charuco_board.yaml", self._apply_board_cfg),
        ]
        for fname, applier in mapping:
            path = os.path.join(self.configs_dir, fname)
            if os.path.exists(path):
                try:
                    applier(path)
                except Exception:
                    pass

    def _apply_camera_cfg(self, path):
        self.camera_config = persistence.load_camera_config(path)

    def _apply_arena_cfg(self, path):
        self.arena = persistence.load_arena_config(path)
        self.arena_panel.set_arena(self.arena)

    def _apply_robot_cfg(self, path):
        self.robot_config = persistence.load_robot_config(path)
        self.pose_estimator.robot_config = self.robot_config
        self.arena_panel.set_robot_config(self.robot_config)

    def _apply_board_cfg(self, path):
        self.board_spec = persistence.load_board_spec(path)

    def load_all_configs(self) -> None:
        d = QFileDialog.getExistingDirectory(
            self, "Pasta de configurações", self.configs_dir)
        if not d:
            return
        for fname, applier in [
            ("camera.yaml", self._apply_camera_cfg),
            ("arena.yaml", self._apply_arena_cfg),
            ("robot.yaml", self._apply_robot_cfg),
            ("charuco_board.yaml", self._apply_board_cfg),
        ]:
            path = os.path.join(d, fname)
            if os.path.exists(path):
                applier(path)
        self._refresh_status_static()

    def save_all_configs(self) -> None:
        d = QFileDialog.getExistingDirectory(
            self, "Pasta de configurações", self.configs_dir)
        if not d:
            return
        persistence.save_camera_config(
            self.camera_config, os.path.join(d, "camera.yaml"))
        persistence.save_arena_config(
            self.arena, os.path.join(d, "arena.yaml"))
        persistence.save_robot_config(
            self.robot_config, os.path.join(d, "robot.yaml"))
        persistence.save_board_spec(
            self.board_spec, os.path.join(d, "charuco_board.yaml"))
        QMessageBox.information(self, "Configurações",
                                "Configurações salvas com sucesso.")

    # ==================================================================
    # Per-frame loop
    # ==================================================================
    def _on_frame(self) -> None:
        ok, frame = self.camera.read()
        if not ok or frame is None:
            return
        self._last_frame = frame
        ts = time.time()

        detections = self.detector.detect(frame)
        det_by_id = {d.marker_id: d for d in detections}

        # recover the camera pose from currently visible learned references
        ref_count = 0
        if self.registration.data.learned_references and self.calibration.is_valid:
            ok_rec, _, ref_count = self.registration.recover_extrinsics(
                detections, self.calibration.camera_matrix,
                self.calibration.dist_coeffs)

        extrinsics = self.registration.data.extrinsics()
        robot_det = det_by_id.get(self.robot_config.marker_id)

        pose = RobotPose(timestamp=ts, frame_index=self._frame_index,
                         marker_visible=False)
        if (robot_det is not None and self.calibration.is_valid
                and extrinsics is not None):
            pose = self.pose_estimator.estimate(
                robot_det, self.calibration.camera_matrix,
                self.calibration.dist_coeffs, extrinsics,
                frame_index=self._frame_index, timestamp=ts,
                arena_reference_count=ref_count)
        self._frame_index += 1
        self._last_pose = pose

        # feed the state machine (RAW pose only)
        self._feed_state_machine(pose, frame)

        # smoothed pose is DISPLAY ONLY
        display_pose = self.smoother.update(pose)

        # ---- update views -----------------------------------------
        self.camera_panel.update_frame(
            frame, detections, pose, self.robot_config.marker_id,
            self.calibration.camera_matrix if self.calibration.is_valid else None,
            self.calibration.dist_coeffs if self.calibration.is_valid else None,
            self.robot_config.marker_length_mm)
        self.arena_panel.set_pose(display_pose)
        if self.test.state in (TestState.RECORDING, TestState.CAPTURING_END,
                               TestState.RESULT):
            self.arena_panel.set_trajectory(self.test.trajectory)

        # ---- status bar -------------------------------------------
        self.status.set_reference_count(
            ref_count, len(self.registration.data.learned_references))
        self.status.set_pose(pose.marker_visible, pose.x_mm, pose.y_mm,
                             pose.heading_deg)
        self.status.set_confidence(pose.pose_confidence)
        self.status.set_z(pose.raw_z_mm, pose.z_deviation_mm)
        st = self.camera.state
        self.status.set_camera(True, st.actual_width, st.actual_height,
                               st.measured_fps or st.actual_fps)

    def _feed_state_machine(self, pose: RobotPose, frame: np.ndarray) -> None:
        state = self.test.state
        if state in (TestState.CAPTURING_START, TestState.RECORDING,
                     TestState.CAPTURING_END):
            self._session_poses.append(pose)

        if state == TestState.CAPTURING_START and self._collecting == "start":
            self.test.add_start_sample(pose)
        elif state == TestState.RECORDING:
            self.test.add_trajectory_sample(pose)
            if self.recorder.is_recording:
                self.recorder.write(frame, pose.timestamp)
        elif state == TestState.CAPTURING_END and self._collecting == "end":
            self.test.add_end_sample(pose)
            if self.recorder.is_recording:
                self.recorder.write(frame, pose.timestamp)
            if len(self.test.end_samples) >= _END_CAPTURE_SAMPLES:
                self._finalize_end()

    # ==================================================================
    # Test flow (signals from TestControls)
    # ==================================================================
    def on_new_test(self, config: TestConfig) -> None:
        if not self._preflight_ok():
            return
        self.test.new_test(config, timestamp=time.time())
        self._session_poses = []
        self._collecting = None
        self.smoother.reset()
        self.arena_panel.clear_trajectory()
        self.controls.clear_result()
        self.controls.set_state(self.test.state)

    def on_capture_start(self) -> None:
        self.test.begin_start_capture(timestamp=time.time())
        self._collecting = "start"
        self.controls.set_state(self.test.state)
        self.status.showMessage(
            "Capturando posição inicial - mantenha o robô parado...", 3000)

    def on_start_recording(self) -> None:
        if len(self.test.start_samples) < _START_CAPTURE_MIN_SAMPLES:
            ret = QMessageBox.question(
                self, "Captura inicial",
                f"Apenas {len(self.test.start_samples)} amostras coletadas. "
                "Continuar mesmo assim?")
            if ret != QMessageBox.Yes:
                return
        self._collecting = None
        stats = self.test.finalize_start_capture(timestamp=time.time())
        # start the video recorder
        if self.test.config and self.test.config.record_video and \
                self._last_frame is not None:
            self._current_test_dir = self.session_mgr.test_dir(
                self.test.config.session, self.test.config.name)
            h, w = self._last_frame.shape[:2]
            self.recorder.start(
                os.path.join(self._current_test_dir, "recording.mp4"),
                (w, h), fps=self.camera.state.measured_fps or 30.0)
        self.controls.set_state(self.test.state)
        if stats.warning:
            self.status.showMessage("Início: " + stats.warning, 4000)

    def on_capture_end(self) -> None:
        self.test.begin_end_capture(timestamp=time.time())
        self._collecting = "end"
        self.controls.set_state(self.test.state)
        self.status.showMessage(
            "Capturando posição final - mantenha o robô parado...", 3000)

    def _finalize_end(self) -> None:
        self._collecting = None
        result = self.test.finalize_end_capture(timestamp=time.time())
        if self.recorder.is_recording:
            self.recorder.stop()
        self.controls.set_state(self.test.state)
        self.controls.show_result(
            result,
            self.test.start_stats.warning if self.test.start_stats else "",
            self.test.end_stats.warning if self.test.end_stats else "")

    def on_save_result(self) -> None:
        if self.test.state != TestState.RESULT:
            return
        cfg = self.test.config
        if not self._current_test_dir:
            self._current_test_dir = self.session_mgr.test_dir(
                cfg.session, cfg.name)
        tdir = self._current_test_dir

        positions_path = os.path.join(tdir, "positions.csv")
        events_path = os.path.join(tdir, "events.csv")
        result_path = os.path.join(tdir, "result.json")
        video_rel = "recording.mp4" if os.path.exists(
            os.path.join(tdir, "recording.mp4")) else ""

        persistence.save_positions_csv(self._session_poses, positions_path)
        persistence.save_events_csv(self.test.events, events_path)
        doc = persistence.build_result_document(
            cfg, self.test.start_stats, self.test.end_stats, self.test.result,
            video_path=video_rel, positions_csv="positions.csv",
            events_csv="events.csv",
            metadata={
                "robot": self.robot_config.to_dict(),
                "arena": {"width_mm": self.arena.width_mm,
                          "height_mm": self.arena.height_mm},
                "calibration_rms": self.calibration.rms_error,
            })
        persistence.save_result_json(doc, result_path)

        self.test.save(timestamp=time.time())
        self.test.to_ready()
        self.controls.set_state(self.test.state)
        QMessageBox.information(
            self, "Resultado salvo", f"Resultado salvo em:\n{tdir}")
        self._current_test_dir = ""

    def on_discard(self) -> None:
        if self.recorder.is_recording:
            self.recorder.stop()
        self._collecting = None
        try:
            self.test.discard(timestamp=time.time())
            self.test.to_ready()
        except ValueError:
            self.test.reset()
        self.arena_panel.clear_trajectory()
        self.controls.clear_result()
        self.controls.set_state(self.test.state)
        self._current_test_dir = ""

    # ==================================================================
    # Misc
    # ==================================================================
    def _preflight_ok(self) -> bool:
        problems = []
        if not self.camera.is_open():
            problems.append("câmera não conectada")
        if not self.calibration.is_valid:
            problems.append("câmera não calibrada")
        if self.registration.data.extrinsics() is None:
            problems.append("arena não registrada")
        if problems:
            QMessageBox.warning(
                self, "Pré-requisitos",
                "Não é possível iniciar o teste:\n- " + "\n- ".join(problems))
            return False
        return True

    def review_result(self) -> None:
        path, _ = QFileDialog.getOpenFileName(
            self, "Abrir result.json", self.outputs_dir, "JSON (*.json)")
        if not path:
            return
        dlg = ReviewDialog(path, self)
        dlg.exec()

    def show_about(self) -> None:
        QMessageBox.about(
            self, "Sobre",
            "<b>Protótipo de Ajuste ArUco</b><br>"
            "Rastreamento em tempo real de robôs LEGO usando marcadores "
            "ArUco e webcam Logitech C920.<br><br>"
            "Fluxo: calibrar → registrar arena → aprender referências → "
            "executar testes de ajuste.")

    def _refresh_status_static(self) -> None:
        self.status.set_calibration(
            self.calibration.is_valid, self.calibration.rms_error)
        self.status.set_arena(self.registration.data.extrinsics() is not None)

    def closeEvent(self, event) -> None:  # noqa: N802 (Qt signature)
        self.timer.stop()
        if self.recorder.is_recording:
            self.recorder.stop()
        self.camera.close()
        super().closeEvent(event)
