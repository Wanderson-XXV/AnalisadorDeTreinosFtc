import argparse
import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from robot_heatmap.calibration import (
    Calibration,
    CalibrationError,
    canvas_to_video_point,
    compose_side_by_side,
    draw_arena_points,
    draw_instructions,
    draw_projected_point,
    draw_status_bar,
    draw_video_points,
    field_to_arena_panel,
    fit_view_to_screen,
    load_arena_image,
    video_to_canvas_point,
)
from robot_heatmap.field_config import FieldConfig
from robot_heatmap.video_navigation import VideoNavigationError, VideoNavigator

WINDOW_NAME = "Video Calibration"


class CalibrationApp:
    def __init__(self, video_path: str, field_path: str, output_path: str, check_image_path: str):
        self._video_path = video_path
        self._field_path = field_path
        self._output_path = output_path
        self._check_image_path = check_image_path
        self._navigator: VideoNavigator | None = None
        self._field: FieldConfig | None = None
        self._arena_image: np.ndarray | None = None
        self._calibration: Calibration | None = None
        self._mode = "select_frame"
        self._last_projected: tuple[int, int] | None = None
        self._last_video_click: tuple[float, float] | None = None
        self._last_view = None
        self._feedback = ""
        self._running = True

    def run(self) -> None:
        try:
            self._navigator = VideoNavigator(self._video_path)
        except VideoNavigationError as e:
            print(f"ERRO: {e}")
            sys.exit(1)

        self._field = FieldConfig.from_file(self._field_path)
        self._arena_image = load_arena_image(self._field, self._field_path, cwd=os.getcwd())
        self._calibration = Calibration(
            self._field,
            self._navigator.original_path,
            start_frame=0,
            field_yaml_path=self._field_path,
            video_fps=self._navigator.fps,
        )

        cv2.namedWindow(WINDOW_NAME)
        cv2.setMouseCallback(WINDOW_NAME, self._on_mouse)

        while self._running:
            self._update()
            key = cv2.waitKey(30 if self._navigator.is_playing else 0) & 0xFF
            if key == 255:
                if self._navigator.is_playing:
                    continue
                else:
                    continue
            self._handle_key(key)

        cv2.destroyAllWindows()
        self._navigator.release()

    def _update(self) -> None:
        if self._mode == "select_frame" and self._navigator.is_playing:
            ret, frame = self._navigator.read_frame()
            if not ret:
                self._navigator.stop_play()
        else:
            frame = self._navigator.get_current_frame_copy()

        if frame is None:
            frame = np.zeros((480, 640, 3), dtype=np.uint8)

        view = compose_side_by_side(frame, self._arena_image)
        view = fit_view_to_screen(view)
        self._last_view = view
        canvas = view.canvas

        if self._mode == "select_frame":
            lines = [
                "Modo: escolher frame util",
                "SPACE: play/pause | D/d: avancar | A/a: voltar | ENTER: usar frame | Q: sair",
            ]
            status = f"Frame {self._navigator.current_frame}/{self._navigator.total_frames} | FPS {self._navigator.fps:.2f}"
            draw_instructions(canvas, lines)
            draw_status_bar(canvas, status)
        elif self._mode == "click_points":
            refs = self._calibration.reference_points()
            ref_ids = [pid for pid, _label, _pt in refs]
            labels = [label for _pid, label, _pt in refs]
            labels_by_id = {pid: label for pid, label, _pt in refs}
            used_labels = [labels_by_id[pid] for pid in self._calibration._reference_order]
            field_points = [pt for _pid, _label, pt in refs]
            arena_pts = []
            for pt in field_points:
                arena_pts.append(field_to_arena_panel(pt, self._field.field["width"], self._field.field["height"], view.arena_region))
            draw_video_points(canvas, self._calibration._video_points, used_labels, len(self._calibration._video_points), view.video_region, view.video_scale)
            clicked_count = len(self._calibration._video_points)
            remaining = self._calibration.remaining_points()
            current_index = ref_ids.index(remaining[0][0]) if remaining else None
            used_indices = {ref_ids.index(pid) for pid in self._calibration._reference_order if pid in ref_ids}
            skipped_indices = {ref_ids.index(pid) for pid in self._calibration.skipped_reference_points if pid in ref_ids}
            draw_arena_points(
                canvas,
                arena_pts,
                labels,
                already_mapped=True,
                current_index=current_index,
                used_indices=used_indices,
                skipped_indices=skipped_indices,
            )
            if remaining:
                pid, label, _pt = remaining[0]
                skipped_count = len(self._calibration.skipped_reference_points)
                lines = [
                    f"Ponto atual: {label} | usados {clicked_count} | pulados {skipped_count} | disponiveis {len(refs)}",
                    "Clique no video | N: pular invisivel | U: desfazer clique | R: reiniciar | ENTER: calcular (4+ pts) | Q: sair",
                ]
            else:
                lines = ["Nao ha mais pontos pendentes.", "ENTER: calcular homografia (4+ pts) | R: reiniciar | Q: sair"]
            draw_instructions(canvas, lines)
            status = self._feedback or f"Pontos usados: {clicked_count} | pulados: {len(self._calibration.skipped_reference_points)}"
            draw_status_bar(canvas, status)
        elif self._mode == "validate":
            refs = self._calibration.reference_points()
            labels_by_id = {pid: label for pid, label, _pt in refs}
            points_by_id = {pid: pt for pid, _label, pt in refs}
            labels = [labels_by_id[pid] for pid in self._calibration._reference_order]
            field_points = [points_by_id[pid] for pid in self._calibration._reference_order]
            arena_pts = []
            for pt in field_points:
                arena_pts.append(field_to_arena_panel(pt, self._field.field["width"], self._field.field["height"], view.arena_region))
            draw_video_points(canvas, self._calibration._video_points, labels, len(labels), view.video_region, view.video_scale)
            draw_arena_points(canvas, arena_pts, labels, already_mapped=True, confirmed_count=len(labels))
            if self._last_projected and self._last_video_click:
                video_click = video_to_canvas_point(self._last_video_click, view.video_region, view.video_scale)
                draw_projected_point(canvas, video_click, self._last_projected, already_mapped=True)
            lines = [
                "Modo: validacao",
                "Clique no video para projetar na arena | R: refazer | S: salvar | Q: sair sem salvar",
            ]
            draw_instructions(canvas, lines)
            quality = self._calibration.quality_report()
            color = (0, 255, 255) if quality["status"] == "warning" else (255, 255, 255)
            draw_status_bar(canvas, f"{quality['message']} Teste pontos longe e perto.", color)

        cv2.imshow(WINDOW_NAME, canvas)

    def _on_mouse(self, event: int, x: int, y: int, _flags, _param) -> None:
        if event != cv2.EVENT_LBUTTONDOWN:
            return
        frame = self._navigator.get_current_frame_copy()
        if frame is None:
            return
        if self._last_view is None:
            return
        video_point = canvas_to_video_point(x, y, self._last_view.video_region, self._last_view.video_scale)
        if video_point is None:
            return
        if self._mode == "click_points":
            remaining_before = self._calibration.remaining_points()
            if self._calibration.add_point(float(video_point[0]), float(video_point[1])):
                clicked_count = len(self._calibration._video_points)
                total = len(self._calibration.reference_points())
                clicked_label = remaining_before[0][1] if remaining_before else "ponto"
                next_remaining = self._calibration.remaining_points()
                if next_remaining:
                    self._feedback = f"Registrado {clicked_count}/{total}: {clicked_label}. Proximo: {next_remaining[0][1]}"
                else:
                    self._feedback = f"Registrado {clicked_count}/{total}: {clicked_label}. ENTER para calcular homografia."
                self._update()
        elif self._mode == "validate":
            projected = self._calibration.project_video_to_field(float(video_point[0]), float(video_point[1]))
            if projected:
                self._last_video_click = video_point
                self._last_projected = field_to_arena_panel(projected, self._field.field["width"], self._field.field["height"], self._last_view.arena_region)
                self._feedback = f"Projetado na arena: x={projected[0]:.1f}, y={projected[1]:.1f}"
                self._update()

    def _handle_key(self, key: int) -> None:
        if key == ord("q"):
            self._running = False
            return

        if self._mode == "select_frame":
            if key == ord(" "):
                self._navigator.toggle_play()
            elif key == ord("d"):
                self._navigator.step(1)
                self._navigator.stop_play()
            elif key == ord("a"):
                self._navigator.step(-1)
                self._navigator.stop_play()
            elif key == ord("D"):
                self._navigator.step_seconds(1.0)
                self._navigator.stop_play()
            elif key == ord("A"):
                self._navigator.step_seconds(-1.0)
                self._navigator.stop_play()
            elif key == 13:
                self._calibration._start_frame = self._navigator.current_frame
                self._mode = "click_points"
                self._navigator.stop_play()
        elif self._mode == "click_points":
            if key == ord("u"):
                if self._calibration.undo_last_point():
                    self._feedback = f"Ultimo ponto removido. Pontos: {len(self._calibration._video_points)}/{len(self._calibration.reference_points())}"
            elif key == ord("n"):
                remaining_before = self._calibration.remaining_points()
                if self._calibration.skip_current_point():
                    skipped_label = remaining_before[0][1] if remaining_before else "ponto"
                    next_remaining = self._calibration.remaining_points()
                    if next_remaining:
                        self._feedback = f"Pulado: {skipped_label}. Proximo: {next_remaining[0][1]}"
                    else:
                        self._feedback = f"Pulado: {skipped_label}. Sem pontos pendentes."
            elif key == ord("r"):
                self._calibration.reset_points()
                self._feedback = "Cliques e pontos pulados reiniciados."
            elif key == 13:
                self._feedback = f"Homografia precisa de pelo menos 4 pontos usados. Atual: {len(self._calibration._video_points)}."
                if self._calibration.can_compute_homography():
                    if self._calibration.compute_homography():
                        self._mode = "validate"
                        quality = self._calibration.quality_report()
                        self._feedback = f"Homografia calculada. {quality['message']}"
                    else:
                        print("Nao foi possivel calcular a homografia. Tente clicar novamente.")
                        self._feedback = "Erro ao calcular homografia. Refaça os cliques."
        elif self._mode == "validate":
            if key == ord("r"):
                self._calibration.reset_points()
                self._last_projected = None
                self._last_video_click = None
                self._feedback = "Refazendo pontos de calibracao."
                self._mode = "click_points"
            elif key == ord("s"):
                self._save()
                self._running = False

    def _save(self) -> None:
        self._calibration.save(self._output_path, self._check_image_path)
        frame = self._navigator.get_current_frame_copy()
        if frame is not None:
            view = compose_side_by_side(frame, self._arena_image)
            view = fit_view_to_screen(view)
            canvas = view.canvas
            refs = self._calibration.reference_points()
            labels_by_id = {pid: label for pid, label, _pt in refs}
            points_by_id = {pid: pt for pid, _label, pt in refs}
            labels = [labels_by_id[pid] for pid in self._calibration._reference_order]
            field_points = [points_by_id[pid] for pid in self._calibration._reference_order]
            arena_pts = []
            for pt in field_points:
                arena_pts.append(field_to_arena_panel(pt, self._field.field["width"], self._field.field["height"], view.arena_region))
            draw_video_points(canvas, self._calibration._video_points, labels, len(labels), view.video_region, view.video_scale)
            draw_arena_points(canvas, arena_pts, labels, already_mapped=True, confirmed_count=len(labels))
            draw_status_bar(canvas, f"Salvo em {self._output_path}")
            cv2.imwrite(self._check_image_path, canvas)
        print(f"Calibracao salva em: {self._output_path}")
        print(f"Imagem de verificacao salva em: {self._check_image_path}")


def main():
    parser = argparse.ArgumentParser(description="Ferramenta de calibracao de video para arena")
    parser.add_argument("--video", required=True, help="Caminho para o arquivo de video")
    parser.add_argument("--field", required=True, help="Caminho para o YAML da arena")
    parser.add_argument("--output", required=True, help="Caminho para salvar o YAML de calibracao")
    parser.add_argument("--check-image", default=None, help="Caminho para salvar a imagem de verificacao")
    args = parser.parse_args()

    check_image = args.check_image
    if check_image is None:
        base = os.path.splitext(os.path.basename(args.output))[0]
        check_image = os.path.join("outputs", "calibration_checks", f"{base}_check.png")

    app = CalibrationApp(args.video, args.field, args.output, check_image)
    app.run()


if __name__ == "__main__":
    main()
