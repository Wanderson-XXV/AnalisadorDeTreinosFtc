import argparse
import csv
import os
import sys
import time

import cv2
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from robot_heatmap.calibration import (
    Calibration,
    CalibrationError,
    compose_side_by_side,
    draw_instructions,
    draw_status_bar,
    field_to_arena_panel,
    fit_view_to_screen,
    load_arena_image,
)
from robot_heatmap.field_config import resolve_image_path
from robot_heatmap.tracker_review import build_tracker_review
from robot_heatmap.tracking import (
    TrackerEvent,
    TrackingError,
    compute_tracking_metrics,
    create_opencv_tracker,
    default_analysis_dir,
    make_position_record,
    save_tracker_events_csv,
    save_tracking_metrics,
    save_positions_csv,
    speed_to_delay_ms,
)
from robot_heatmap.video_navigation import VideoNavigationError, VideoNavigator


WINDOW_NAME = "Robot Tracker"


class RobotTrackerApp:
    def __init__(
        self,
        calibration_path: str,
        analysis_dir: str,
        tracker_name: str,
        speed: str,
        video_path: str | None = None,
        output_path: str | None = None,
    ):
        self._calibration_path = calibration_path
        self._analysis_dir = analysis_dir
        self._output_path = output_path or os.path.join(analysis_dir, "positions.csv")
        self._events_path = os.path.join(analysis_dir, "tracker_events.csv")
        self._metrics_path = os.path.join(analysis_dir, "tracker_metrics.json")
        self._review_path = os.path.join(analysis_dir, "review.html")
        self._tracker_name = tracker_name
        self._speed = speed
        self._video_path_override = video_path
        self._calibration: Calibration | None = None
        self._navigator: VideoNavigator | None = None
        self._arena_image: np.ndarray | None = None
        self._field_path = ""
        self._arena_image_path = ""
        self._video_path = ""
        self._tracker = None
        self._bbox: tuple[float, float, float, float] | None = None
        self._records = []
        self._events: list[TrackerEvent] = []
        self._last_record = None
        self._last_tracking_ok: bool | None = None
        self._paused = False
        self._running = True
        self._started_at = 0.0

    def run(self) -> None:
        self._load_inputs()
        os.makedirs(self._analysis_dir, exist_ok=True)
        self._started_at = time.perf_counter()
        cv2.namedWindow(WINDOW_NAME)

        frame = self._navigator.get_current_frame_copy()
        if frame is None:
            raise TrackingError("Nao foi possivel ler o frame inicial do video.")

        if not self._select_roi(frame, "roi_selected", "initial"):
            print("ROI nao selecionada. Nada foi salvo.")
            cv2.destroyAllWindows()
            self._navigator.release()
            return

        self._append_record(self._navigator.current_frame, self._bbox, True)

        while self._running:
            if self._paused:
                self._draw(frame, "PAUSADO | SPACE: continuar | R: reselecionar | Q: salvar e sair")
                key = cv2.waitKey(0) & 0xFF
                self._handle_key(key, frame)
                continue

            ret, frame = self._navigator.read_frame()
            if not ret:
                break

            ok, bbox = self._tracker.update(frame) if self._tracker else (False, None)
            if ok:
                self._bbox = tuple(float(v) for v in bbox)
                self._append_record(self._navigator.current_frame, self._bbox, True)
                self._last_tracking_ok = True
                status = "Tracking OK"
            else:
                self._bbox = None
                self._append_record(self._navigator.current_frame, None, False)
                if self._last_tracking_ok is not False:
                    self._add_event("tracking_lost", "tracker update failed")
                self._last_tracking_ok = False
                status = "Tracking perdido | R: reselecionar"

            self._draw(frame, status)
            key = cv2.waitKey(self._frame_delay_ms()) & 0xFF
            self._handle_key(key, frame)

        self._add_event("finished", "tracker stopped")
        self._save(time.perf_counter() - self._started_at)
        cv2.destroyAllWindows()
        self._navigator.release()

    def _load_inputs(self) -> None:
        self._calibration = Calibration.load(self._calibration_path)
        if self._calibration.homography is None:
            raise TrackingError("Calibracao sem homografia. Rode calibrate_video.py antes.")

        try:
            self._video_path = self._video_path_override or self._calibration.video_path
            self._navigator = VideoNavigator(self._video_path)
            self._navigator.go_to_frame(self._calibration.start_frame)
        except VideoNavigationError as e:
            raise TrackingError(str(e))

        self._field_path = self._calibration.to_dict()["field"]["path"]
        try:
            self._arena_image_path = resolve_image_path(
                self._field_path,
                self._calibration.field_config.field.get("image", ""),
                cwd=os.getcwd(),
            )
            self._arena_image = load_arena_image(
                self._calibration.field_config,
                self._field_path,
                cwd=os.getcwd(),
            )
        except (CalibrationError, FileNotFoundError, ValueError) as e:
            raise TrackingError(str(e))

    def _select_roi(self, frame: np.ndarray, event_name: str, detail: str) -> bool:
        bbox = cv2.selectROI(WINDOW_NAME, frame, fromCenter=False, showCrosshair=True)
        if bbox is None:
            return False
        x, y, w, h = bbox
        if w <= 0 or h <= 0:
            return False
        self._tracker = create_opencv_tracker(self._tracker_name)
        self._tracker.init(frame, tuple(map(int, bbox)))
        self._bbox = tuple(float(v) for v in bbox)
        self._last_tracking_ok = True
        self._add_event(event_name, detail)
        return True

    def _add_event(self, event_name: str, detail: str = "") -> None:
        frame_index = self._navigator.current_frame if self._navigator else 0
        fps = self._navigator.fps if self._navigator else 0.0
        time_seconds = round(frame_index / fps, 3) if fps > 0 else 0.0
        self._events.append(TrackerEvent(event_name, frame_index, time_seconds, detail))

    def _append_record(
        self,
        frame_index: int,
        bbox: tuple[float, float, float, float] | None,
        tracking_ok: bool,
    ) -> None:
        record = make_position_record(
            frame_index=frame_index,
            fps=self._navigator.fps,
            bbox=bbox,
            calibration=self._calibration,
            tracking_ok=tracking_ok,
        )
        self._records.append(record)
        self._last_record = record

    def _draw(self, frame: np.ndarray, status: str) -> None:
        view = compose_side_by_side(frame, self._arena_image)
        view = fit_view_to_screen(view)
        canvas = view.canvas

        if self._bbox is not None:
            self._draw_bbox(canvas, self._bbox, view.video_region, view.video_scale)

        if self._last_record and self._last_record.field_x is not None:
            self._draw_arena_position(canvas, view.arena_region)

        draw_instructions(
            canvas,
            [
                "Tracker Human-in-the-loop",
                "SPACE: pausa/continua | R: reselecionar ROI | Q: salvar e sair",
            ],
        )
        draw_status_bar(canvas, self._status_text(status))
        cv2.imshow(WINDOW_NAME, canvas)

    def _draw_bbox(
        self,
        canvas: np.ndarray,
        bbox: tuple[float, float, float, float],
        video_region: tuple[int, int, int, int],
        video_scale: float,
    ) -> None:
        vx, vy, _vw, _vh = video_region
        x, y, w, h = bbox
        p1 = (int(round(vx + x * video_scale)), int(round(vy + y * video_scale)))
        p2 = (
            int(round(vx + (x + w) * video_scale)),
            int(round(vy + (y + h) * video_scale)),
        )
        cv2.rectangle(canvas, p1, p2, (0, 255, 0), 2)

    def _draw_arena_position(
        self,
        canvas: np.ndarray,
        arena_region: tuple[int, int, int, int],
    ) -> None:
        field = self._calibration.field_config.field
        point = field_to_arena_panel(
            [self._last_record.field_x, self._last_record.field_y],
            float(field.get("width", 1000)),
            float(field.get("height", 1000)),
            arena_region,
        )
        field_width = float(field.get("width", 1000))
        field_height = float(field.get("height", 1000))
        ax, ay, aw, ah = arena_region
        robot_width = max(8, int(round((45.72 / field_width) * aw)))
        robot_height = max(8, int(round((45.72 / field_height) * ah)))
        p1 = (point[0] - robot_width // 2, point[1] - robot_height // 2)
        p2 = (point[0] + robot_width // 2, point[1] + robot_height // 2)
        cv2.rectangle(canvas, p1, p2, (0, 0, 255), -1)
        cv2.rectangle(canvas, p1, p2, (255, 255, 255), 2)
        cv2.circle(canvas, point, 3, (0, 0, 0), -1)

    def _status_text(self, status: str) -> str:
        frame = self._navigator.current_frame
        total = self._navigator.total_frames
        reselects = len([event for event in self._events if event.event == "roi_reselected"])
        since_reselect = self._seconds_since_last_selection()
        if self._last_record and self._last_record.field_x is not None:
            return (
                f"{status} | Frame {frame}/{total} | "
                f"arena x={self._last_record.field_x:.1f}, y={self._last_record.field_y:.1f} | "
                f"reselecoes {reselects} | trecho {since_reselect:.1f}s"
            )
        return f"{status} | Frame {frame}/{total} | reselecoes {reselects} | trecho {since_reselect:.1f}s"

    def _frame_delay_ms(self) -> int:
        return speed_to_delay_ms(self._speed, self._navigator.fps)

    def _seconds_since_last_selection(self) -> float:
        if not self._navigator:
            return 0.0
        fps = self._navigator.fps
        now = self._navigator.current_frame / fps if fps > 0 else 0.0
        selection_times = [
            event.time_seconds
            for event in self._events
            if event.event in {"roi_selected", "roi_reselected"}
        ]
        if not selection_times:
            return 0.0
        return max(0.0, now - selection_times[-1])

    def _handle_key(self, key: int, frame: np.ndarray) -> None:
        if key == 255:
            return
        if key == ord("q") or key == ord("Q"):
            self._running = False
        elif key == ord(" "):
            self._paused = not self._paused
            if self._paused:
                self._add_event("paused", "manual pause")
        elif key == ord("r") or key == ord("R"):
            was_paused = self._paused
            self._paused = True
            if self._select_roi(frame, "roi_reselected", "manual reselection"):
                self._append_record(self._navigator.current_frame, self._bbox, True)
            self._paused = was_paused

    def _save(self, processing_seconds: float) -> None:
        save_positions_csv(self._records, self._output_path)
        save_tracker_events_csv(self._events, self._events_path)
        metrics = compute_tracking_metrics(
            self._records,
            self._events,
            processing_seconds,
            metadata=self._metadata(),
        )
        save_tracking_metrics(metrics, self._metrics_path)
        build_tracker_review(self._analysis_dir, self._review_path)
        self._append_lab_index(metrics)
        print(f"Posicoes salvas em: {self._output_path}")
        print(f"Eventos salvos em: {self._events_path}")
        print(f"Metricas salvas em: {self._metrics_path}")
        print(f"Review salvo em: {self._review_path}")
        print(f"Linhas salvas: {len(self._records)}")

    def _metadata(self) -> dict:
        field = self._calibration.field_config.field
        return {
            "analysis_name": os.path.basename(os.path.normpath(self._analysis_dir)),
            "analysis_dir": self._analysis_dir,
            "video_path": self._relative_to_analysis(self._video_path),
            "calibration_path": self._relative_to_analysis(self._calibration_path),
            "field_path": self._relative_to_analysis(self._field_path),
            "arena_image": self._relative_to_analysis(self._arena_image_path),
            "tracker": self._tracker_name,
            "speed": self._speed,
            "field_width": float(field.get("width", 1000)),
            "field_height": float(field.get("height", 1000)),
        }

    def _relative_to_analysis(self, path: str) -> str:
        if not path:
            return ""
        absolute = path if os.path.isabs(path) else os.path.abspath(path)
        try:
            return os.path.relpath(absolute, self._analysis_dir)
        except ValueError:
            return absolute

    def _append_lab_index(self, metrics: dict) -> None:
        index_path = os.path.join(os.path.dirname(self._analysis_dir), "lab_index.csv")
        columns = [
            "analysis_name",
            "analysis_dir",
            "video_path",
            "tracker",
            "speed",
            "tracking_ok_percent",
            "corrections_per_minute",
            "roi_reselections",
            "tracking_lost_count",
            "duration_seconds",
            "processing_seconds",
        ]
        exists = os.path.exists(index_path)
        with open(index_path, "a", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=columns)
            if not exists:
                writer.writeheader()
            writer.writerow({key: metrics.get(key, "") for key in columns})


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Tracker Human-in-the-loop para gerar positions.csv"
    )
    parser.add_argument(
        "--calibration",
        default="calibrations/decode_v1.yaml",
        help="Caminho para o YAML de calibracao",
    )
    parser.add_argument(
        "--video",
        default=None,
        help="Caminho para o video; quando omitido, usa o video salvo na calibracao",
    )
    parser.add_argument(
        "--analysis-dir",
        default=None,
        help="Pasta da analise; por padrao usa outputs/analyses/<nome_do_video_ou_calibracao>",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Caminho legado do positions.csv; se omitido, usa <analysis-dir>/positions.csv",
    )
    parser.add_argument(
        "--tracker",
        default="CSRT",
        choices=["CSRT", "KCF"],
        help="Tracker OpenCV usado apos a selecao manual da ROI",
    )
    parser.add_argument(
        "--speed",
        default="4",
        choices=["1", "2", "4", "8", "max"],
        help="Velocidade de playback/processamento durante tracking",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    analysis_dir = args.analysis_dir or default_analysis_dir(args.video or "", args.calibration)
    output_path = args.output or os.path.join(analysis_dir, "positions.csv")
    app = RobotTrackerApp(
        args.calibration,
        analysis_dir,
        args.tracker,
        args.speed,
        video_path=args.video,
        output_path=output_path,
    )
    try:
        app.run()
    except TrackingError as e:
        print(f"ERRO: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
