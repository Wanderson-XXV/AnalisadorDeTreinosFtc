import os
from pathlib import Path
from dataclasses import dataclass

import cv2
import numpy as np
import yaml

from robot_heatmap.field_config import FieldConfig, resolve_image_path


class CalibrationError(Exception):
    pass


@dataclass(frozen=True)
class CalibrationView:
    canvas: np.ndarray
    video_region: tuple[int, int, int, int]
    arena_region: tuple[int, int, int, int]
    video_scale: float
    arena_scale: float


class Calibration:
    def __init__(self, field_config: FieldConfig, video_path: str, start_frame: int = 0, field_yaml_path: str = "", video_fps: float = 30.0):
        self._field = field_config
        self._video_path = video_path
        self._start_frame = start_frame
        self._field_yaml_path = field_yaml_path
        self._video_fps = float(video_fps)
        self._video_points: list[tuple[float, float]] = []
        self._field_points: list[tuple[float, float]] = []
        self._homography: np.ndarray | None = None
        self._reference_order: list[str] = []
        self._skipped_reference_order: list[str] = []

    @property
    def field_config(self) -> FieldConfig:
        return self._field

    @property
    def video_path(self) -> str:
        return self._video_path

    @property
    def start_frame(self) -> int:
        return self._start_frame

    @property
    def homography(self) -> np.ndarray | None:
        return self._homography

    @property
    def skipped_reference_points(self) -> list[str]:
        return list(self._skipped_reference_order)

    def reference_points(self) -> list[tuple[str, str, list]]:
        refs = self._field.reference_points
        ordered = []
        priority = ["top_left", "top_right", "bottom_right", "bottom_left"]
        for key in priority:
            if key in refs:
                ordered.append((key, refs[key].get("label", key), refs[key]["point"]))
        for key, data in refs.items():
            if key not in priority:
                ordered.append((key, data.get("label", key), data["point"]))
        return ordered

    def remaining_points(self) -> list[tuple[str, str, list]]:
        resolved = set(self._reference_order) | set(self._skipped_reference_order)
        return [ref for ref in self.reference_points() if ref[0] not in resolved]

    def add_point(self, video_x: float, video_y: float) -> bool:
        remaining = self.remaining_points()
        if not remaining:
            return False
        point_id, _label, field_point = remaining[0]
        self._video_points.append((float(video_x), float(video_y)))
        self._field_points.append((float(field_point[0]), float(field_point[1])))
        self._reference_order.append(point_id)
        return True

    def skip_current_point(self) -> bool:
        remaining = self.remaining_points()
        if not remaining:
            return False
        point_id, _label, _field_point = remaining[0]
        self._skipped_reference_order.append(point_id)
        self._homography = None
        return True

    def undo_last_point(self) -> bool:
        if not self._video_points:
            return False
        self._video_points.pop()
        self._field_points.pop()
        self._reference_order.pop()
        self._homography = None
        return True

    def reset_points(self) -> None:
        self._video_points.clear()
        self._field_points.clear()
        self._reference_order.clear()
        self._skipped_reference_order.clear()
        self._homography = None

    def can_compute_homography(self) -> bool:
        return len(self._video_points) >= 4

    def compute_homography(self) -> bool:
        if not self.can_compute_homography():
            return False
        src = np.array(self._video_points, dtype=np.float32).reshape(-1, 1, 2)
        dst = np.array(self._field_points, dtype=np.float32).reshape(-1, 1, 2)
        H, _status = cv2.findHomography(src, dst, cv2.RANSAC, 5.0)
        if H is None:
            return False
        self._homography = H
        return True

    def project_video_to_field(self, video_x: float, video_y: float) -> tuple[float, float] | None:
        if self._homography is None:
            return None
        src = np.array([[video_x, video_y]], dtype=np.float32).reshape(-1, 1, 2)
        dst = cv2.perspectiveTransform(src, self._homography)
        return (float(dst[0][0][0]), float(dst[0][0][1]))

    def quality_report(self) -> dict:
        field = self._field.field
        field_width = float(field.get("width", 1000))
        field_height = float(field.get("height", 1000))
        point_count = len(self._field_points)
        if point_count < 4 or field_width <= 0 or field_height <= 0:
            return {
                "status": "warning",
                "message": "Use pelo menos 4 pontos visiveis e bem espalhados.",
                "field_x_coverage": 0.0,
                "field_y_coverage": 0.0,
                "used_reference_count": point_count,
            }

        xs = [point[0] for point in self._field_points]
        ys = [point[1] for point in self._field_points]
        x_coverage = min(1.0, (max(xs) - min(xs)) / field_width)
        y_coverage = min(1.0, (max(ys) - min(ys)) / field_height)

        if x_coverage < 0.45 or y_coverage < 0.45:
            status = "warning"
            message = "Pontos pouco espalhados; a homografia pode ficar ruim longe deles."
        else:
            status = "ok"
            message = "Pontos bem espalhados para esta calibracao."

        return {
            "status": status,
            "message": message,
            "field_x_coverage": round(float(x_coverage), 3),
            "field_y_coverage": round(float(y_coverage), 3),
            "used_reference_count": point_count,
        }

    def to_dict(self, check_image_path: str | None = None) -> dict:
        field = self._field.field
        refs = {}
        for i, point_id in enumerate(self._reference_order):
            refs[point_id] = {
                "label": self._field.reference_points[point_id].get("label", point_id),
                "field": list(self._field_points[i]),
                "video": [int(self._video_points[i][0]), int(self._video_points[i][1])],
            }
        H = self._homography
        matrix = (
            [[float(v) for v in row] for row in H]
            if H is not None
            else [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]]
        )
        return {
            "calibration_mode": "partial_reference_subset",
            "video": {
                "path": self._video_path,
                "start_frame": int(self._start_frame),
                "start_time_seconds": round(self._start_frame / self._video_fps, 3)
                if self._video_fps > 0
                else 0.0,
                "fps": round(self._video_fps, 3) if self._video_fps > 0 else 0.0,
            },
            "field": {
                "path": self._field_path(),
                "unit": field.get("unit", "normalized"),
                "width": float(field.get("width", 1000)),
                "height": float(field.get("height", 1000)),
            },
            "reference_points": refs,
            "skipped_reference_points": list(self._skipped_reference_order),
            "used_reference_count": len(self._reference_order),
            "available_reference_count": len(self.reference_points()),
            "quality": self.quality_report(),
            "homography": {
                "direction": "video_to_field",
                "matrix": matrix,
            },
            "outputs": {
                "check_image": check_image_path if check_image_path else "",
            },
        }

    def _field_path(self) -> str:
        return self._field_yaml_path

    def save(self, output_path: str, check_image_path: str | None = None) -> None:
        os.makedirs(os.path.dirname(output_path), exist_ok=True) if os.path.dirname(output_path) else None
        data = self.to_dict(check_image_path)
        with open(output_path, "w", encoding="utf-8") as f:
            yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
        if check_image_path:
            os.makedirs(os.path.dirname(check_image_path), exist_ok=True) if os.path.dirname(check_image_path) else None

    @classmethod
    def load(cls, path: str) -> "Calibration":
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        field_path = data.get("field", {}).get("path", "")
        field = FieldConfig.from_file(field_path) if field_path and os.path.exists(field_path) else FieldConfig()
        start_frame = int(data.get("video", {}).get("start_frame", 0))
        video_path = data.get("video", {}).get("path", "")
        video_fps = float(data.get("video", {}).get("fps", 30.0))
        cal = cls(field, video_path, start_frame, field_path, video_fps)
        refs = data.get("reference_points", {})
        for point_id, info in refs.items():
            cal._reference_order.append(point_id)
            cal._field_points.append((float(info["field"][0]), float(info["field"][1])))
            cal._video_points.append((float(info["video"][0]), float(info["video"][1])))
        cal._skipped_reference_order = list(data.get("skipped_reference_points", []))
        matrix = data.get("homography", {}).get("matrix")
        if matrix:
            cal._homography = np.array(matrix, dtype=np.float64)
        return cal


def load_arena_image(field_config: FieldConfig, field_yaml_path: str, cwd: str = None) -> np.ndarray:
    try:
        image_path = resolve_image_path(field_yaml_path, field_config.field.get("image", ""), cwd=cwd)
    except FileNotFoundError as e:
        raise CalibrationError(str(e))
    image = cv2.imread(image_path)
    if image is None:
        raise CalibrationError(f"Nao foi possivel carregar a imagem da arena: {image_path}")
    return image


def resize_to_height(image: np.ndarray, target_height: int) -> np.ndarray:
    h, w = image.shape[:2]
    scale = target_height / h
    return cv2.resize(image, (int(w * scale), target_height))


def resize_to_fit(image: np.ndarray, max_width: int, max_height: int) -> tuple[np.ndarray, float]:
    h, w = image.shape[:2]
    scale = min(max_width / w, max_height / h)
    new_w = max(1, int(round(w * scale)))
    new_h = max(1, int(round(h * scale)))
    return cv2.resize(image, (new_w, new_h)), scale


def compose_side_by_side(
    video_frame: np.ndarray,
    arena_image: np.ndarray,
    max_height: int = 720,
    arena_panel_width: int = 420,
    gap: int = 10,
) -> CalibrationView:
    video_resized, video_scale = resize_to_fit(video_frame, 1280, max_height)
    video_h, video_w = video_resized.shape[:2]
    canvas_h = max(video_h, min(max_height, video_h))

    arena_resized, arena_scale = resize_to_fit(arena_image, arena_panel_width, canvas_h)
    arena_h, arena_w = arena_resized.shape[:2]

    canvas_w = video_w + gap + arena_panel_width
    canvas = np.zeros((canvas_h, canvas_w, 3), dtype=np.uint8)
    canvas[:, :] = (22, 22, 22)

    video_y = (canvas_h - video_h) // 2
    arena_x = video_w + gap + (arena_panel_width - arena_w) // 2
    arena_y = (canvas_h - arena_h) // 2

    canvas[video_y:video_y + video_h, 0:video_w] = video_resized
    canvas[arena_y:arena_y + arena_h, arena_x:arena_x + arena_w] = arena_resized

    panel_x = video_w + gap
    cv2.rectangle(canvas, (panel_x, 0), (canvas_w - 1, canvas_h - 1), (45, 45, 45), 1)

    return CalibrationView(
        canvas=canvas,
        video_region=(0, video_y, video_w, video_h),
        arena_region=(arena_x, arena_y, arena_w, arena_h),
        video_scale=video_scale,
        arena_scale=arena_scale,
    )


def fit_view_to_screen(view: CalibrationView, max_width: int = 1850, max_height: int = 980) -> CalibrationView:
    canvas = view.canvas
    ch, cw = canvas.shape[:2]
    scale = min(max_width / cw, max_height / ch, 1.0)
    if scale >= 1.0:
        return view
    new_w = max(1, int(round(cw * scale)))
    new_h = max(1, int(round(ch * scale)))
    resized = cv2.resize(canvas, (new_w, new_h))
    vx, vy, vw, vh = view.video_region
    ax, ay, aw, ah = view.arena_region
    return CalibrationView(
        canvas=resized,
        video_region=(int(round(vx * scale)), int(round(vy * scale)), int(round(vw * scale)), int(round(vh * scale))),
        arena_region=(int(round(ax * scale)), int(round(ay * scale)), int(round(aw * scale)), int(round(ah * scale))),
        video_scale=view.video_scale * scale,
        arena_scale=view.arena_scale * scale,
    )


def make_side_by_side(video_frame: np.ndarray, arena_image: np.ndarray) -> np.ndarray:
    target_height = max(video_frame.shape[0], arena_image.shape[0])
    v_resized = resize_to_height(video_frame, target_height)
    a_resized = resize_to_height(arena_image, target_height)
    gap = 10
    canvas = np.zeros((target_height, v_resized.shape[1] + gap + a_resized.shape[1], 3), dtype=np.uint8)
    canvas[:, :v_resized.shape[1]] = v_resized
    canvas[:, v_resized.shape[1] + gap:] = a_resized
    return canvas


def canvas_to_video_point(x: int, y: int, video_region: tuple[int, int, int, int], video_scale: float) -> tuple[float, float] | None:
    vx, vy, vw, vh = video_region
    if x < vx or y < vy or x > vx + vw or y > vy + vh:
        return None
    return ((x - vx) / video_scale, (y - vy) / video_scale)


def video_to_canvas_point(video_point: tuple[float, float], video_region: tuple[int, int, int, int], video_scale: float) -> tuple[int, int]:
    vx, vy, _vw, _vh = video_region
    return (int(round(vx + video_point[0] * video_scale)), int(round(vy + video_point[1] * video_scale)))


def field_to_arena_panel(
    field_point: list | tuple,
    field_width: float,
    field_height: float,
    arena_region: tuple[int, int, int, int],
) -> tuple[int, int]:
    ax, ay, aw, ah = arena_region
    x = ax + int(round((float(field_point[0]) / field_width) * (aw - 1)))
    y = ay + int(round((float(field_point[1]) / field_height) * (ah - 1)))
    return (x, y)


def draw_text(image: np.ndarray, text: str, position: tuple, color: tuple = (255, 255, 255)) -> None:
    cv2.putText(image, text, position, cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 4, cv2.LINE_AA)
    cv2.putText(image, text, position, cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2, cv2.LINE_AA)


def label_position_inside_bounds(
    text: str,
    anchor: tuple[int, int],
    bounds: tuple[int, int, int, int],
    font_scale: float = 0.5,
    thickness: int = 2,
    padding: int = 4,
) -> tuple[int, int]:
    bx, by, bw, bh = bounds
    text_w, text_h = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)[0]
    x = anchor[0] + 8
    y = anchor[1] - 8

    min_x = bx + padding
    max_x = bx + bw - text_w - padding
    min_y = by + text_h + padding
    max_y = by + bh - padding

    if x > max_x:
        x = anchor[0] - text_w - 8
    if y < min_y:
        y = anchor[1] + text_h + 12

    x = max(min_x, min(x, max_x))
    y = max(min_y, min(y, max_y))
    return (int(x), int(y))


def compact_reference_label(label: str) -> str:
    normalized = label.strip().lower()
    replacements = {
        "canto superior esquerdo": "sup esq",
        "canto superior direito": "sup dir",
        "canto inferior esquerdo": "inf esq",
        "canto inferior direito": "inf dir",
    }
    return replacements.get(normalized, label)


def draw_status_bar(canvas: np.ndarray, text: str, color: tuple = (255, 255, 255)) -> None:
    h = canvas.shape[0]
    draw_text(canvas, text, (10, h - 15), color)


def draw_instructions(canvas: np.ndarray, lines: list[str], color: tuple = (255, 255, 255)) -> None:
    y = 25
    for line in lines:
        draw_text(canvas, line, (10, y), color)
        y += 25


def draw_video_points(
    canvas: np.ndarray,
    video_points: list[tuple[float, float]],
    labels: list[str],
    current_index: int,
    video_region: tuple[int, int, int, int] | None = None,
    video_scale: float = 1.0,
) -> None:
    if video_region:
        label_bounds = video_region
    else:
        label_bounds = (0, 0, canvas.shape[1], canvas.shape[0])
    for i, (x, y) in enumerate(video_points):
        color = (0, 255, 0)
        draw_x, draw_y = video_to_canvas_point((x, y), video_region, video_scale) if video_region else (int(x), int(y))
        cv2.circle(canvas, (draw_x, draw_y), 6, color, -1)
        if i < len(labels):
            pos = label_position_inside_bounds(labels[i], (draw_x, draw_y), label_bounds)
            draw_text(canvas, labels[i], pos, color)
    if current_index < len(labels):
        remaining = [(int(px), int(py)) for px, py in video_points[current_index:]]
        if remaining:
            cv2.circle(canvas, remaining[0], 10, (0, 255, 255), 2)


def draw_arena_points(
    canvas: np.ndarray,
    arena_points: list[tuple[int, int]],
    labels: list[str],
    video_width: int = 0,
    gap: int = 10,
    already_mapped: bool = False,
    confirmed_count: int | None = None,
    current_index: int | None = None,
    used_indices: set[int] | None = None,
    skipped_indices: set[int] | None = None,
) -> None:
    offset_x = 0 if already_mapped else video_width + gap
    if confirmed_count is None:
        confirmed_count = len(arena_points)
    used_indices = used_indices or set()
    skipped_indices = skipped_indices or set()
    if arena_points:
        xs = [p[0] + offset_x for p in arena_points]
        ys = [p[1] for p in arena_points]
        bounds = (min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys))
    else:
        bounds = (0, 0, canvas.shape[1], canvas.shape[0])
    label_bounds = (
        max(0, bounds[0] - 4),
        max(0, bounds[1] - 4),
        min(canvas.shape[1] - max(0, bounds[0] - 4), bounds[2] + 8),
        min(canvas.shape[0] - max(0, bounds[1] - 4), bounds[3] + 8),
    )
    for i, (x, y) in enumerate(arena_points):
        if current_index is not None:
            if i in used_indices:
                color = (0, 255, 0)
            elif i == current_index:
                color = (0, 255, 255)
            else:
                color = (160, 160, 160)
        elif i < confirmed_count:
            color = (0, 255, 0)
        elif i == confirmed_count:
            color = (0, 255, 255)
        else:
            color = (160, 160, 160)
        cv2.circle(canvas, (x + offset_x, y), 6, color, -1)
        if i < len(labels):
            label = compact_reference_label(labels[i])
            anchor = (x + offset_x, y)
            pos = label_position_inside_bounds(label, anchor, label_bounds)
            draw_text(canvas, label, pos, color)


def draw_projected_point(canvas: np.ndarray, video_point: tuple[int, int], field_point: tuple[int, int], video_width: int = 0, gap: int = 10, already_mapped: bool = False) -> None:
    offset_x = 0 if already_mapped else video_width + gap
    arena_point = (field_point[0] + offset_x, field_point[1])
    cv2.circle(canvas, video_point, 8, (255, 0, 0), -1)
    cv2.circle(canvas, video_point, 10, (255, 255, 255), 2)
    cv2.circle(canvas, arena_point, 8, (255, 0, 0), -1)
    cv2.circle(canvas, arena_point, 10, (255, 255, 255), 2)
    cv2.line(canvas, video_point, arena_point, (255, 0, 0), 2, cv2.LINE_AA)
    draw_text(canvas, "proj", label_position_inside_bounds("proj", video_point, (0, 0, canvas.shape[1], canvas.shape[0])), (255, 0, 0))
    draw_text(canvas, "proj", label_position_inside_bounds("proj", arena_point, (0, 0, canvas.shape[1], canvas.shape[0])), (255, 0, 0))
