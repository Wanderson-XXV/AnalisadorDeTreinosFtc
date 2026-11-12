import os
import sys
import tempfile

import cv2
import numpy as np
import yaml

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from robot_heatmap.calibration import (
    Calibration,
    CalibrationError,
    compose_side_by_side,
    draw_arena_points,
    field_to_arena_panel,
    label_position_inside_bounds,
    compact_reference_label,
    load_arena_image,
    make_side_by_side,
)
from robot_heatmap.field_config import FieldConfig
from robot_heatmap.video_navigation import VideoNavigationError, VideoNavigator


def test_homography_with_four_corners():
    field = FieldConfig("decode", "Decode", "", "cm", 365.76, 365.76)
    field.add_reference_point("top_left", "Canto superior esquerdo", [0, 0])
    field.add_reference_point("top_right", "Canto superior direito", [365.76, 0])
    field.add_reference_point("bottom_right", "Canto inferior direito", [365.76, 365.76])
    field.add_reference_point("bottom_left", "Canto inferior esquerdo", [0, 365.76])

    cal = Calibration(field, "video.mp4", 0, "field.yaml", 30.0)
    video_points = [(100, 100), (400, 90), (410, 300), (90, 310)]
    for x, y in video_points:
        cal.add_point(x, y)

    assert cal.can_compute_homography()
    assert cal.compute_homography()

    projected = cal.project_video_to_field(250, 200)
    assert projected is not None
    assert 0 < projected[0] < 365.76
    assert 0 < projected[1] < 365.76


def test_homography_with_visible_subset_after_skipping_points():
    field = FieldConfig("decode", "Decode", "", "cm", 365.76, 365.76)
    field.add_reference_point("top_left", "Canto superior esquerdo", [0, 0])
    field.add_reference_point("top_right", "Canto superior direito", [365.76, 0])
    field.add_reference_point("bottom_right", "Canto inferior direito", [365.76, 365.76])
    field.add_reference_point("bottom_left", "Canto inferior esquerdo", [0, 365.76])
    field.add_reference_point("center", "Centro", [182.88, 182.88])
    field.add_reference_point("launch_line", "Linha de lancamento", [182.88, 90])

    cal = Calibration(field, "video.mp4", 0, "field.yaml", 30.0)
    assert cal.skip_current_point()
    assert cal.add_point(400, 90)
    assert cal.add_point(410, 300)
    assert cal.add_point(90, 310)
    assert cal.add_point(250, 200)

    assert cal.skipped_reference_points == ["top_left"]
    assert [point_id for point_id, _label, _pt in cal.remaining_points()][0] == "launch_line"
    assert cal.can_compute_homography()
    assert cal.compute_homography()

    projected = cal.project_video_to_field(250, 200)
    assert projected is not None
    assert abs(projected[0] - 182.88) < 2
    assert abs(projected[1] - 182.88) < 2


def test_save_partial_calibration_omits_skipped_points_and_writes_metadata():
    field = FieldConfig("decode", "Decode", "", "cm", 365.76, 365.76)
    for point_id, label, point in [
        ("top_left", "Canto superior esquerdo", [0, 0]),
        ("top_right", "Canto superior direito", [365.76, 0]),
        ("bottom_right", "Canto inferior direito", [365.76, 365.76]),
        ("bottom_left", "Canto inferior esquerdo", [0, 365.76]),
        ("center", "Centro", [182.88, 182.88]),
    ]:
        field.add_reference_point(point_id, label, point)

    cal = Calibration(field, "video.mp4", 0, "field.yaml", 30.0)
    cal.skip_current_point()
    for x, y in [(400, 90), (410, 300), (90, 310), (250, 200)]:
        cal.add_point(x, y)
    cal.compute_homography()

    with tempfile.TemporaryDirectory() as tmpdir:
        output = os.path.join(tmpdir, "cal.yaml")
        cal.save(output)

        with open(output, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

    assert data["calibration_mode"] == "partial_reference_subset"
    assert data["skipped_reference_points"] == ["top_left"]
    assert data["used_reference_count"] == 4
    assert data["available_reference_count"] == 5
    assert "top_left" not in data["reference_points"]
    assert set(data["reference_points"]) == {"top_right", "bottom_right", "bottom_left", "center"}


def test_quality_warns_when_reference_points_are_clustered():
    field = FieldConfig("decode", "Decode", "", "cm", 365.76, 365.76)
    field.add_reference_point("a", "A", [70, 250])
    field.add_reference_point("b", "B", [120, 250])
    field.add_reference_point("c", "C", [120, 310])
    field.add_reference_point("d", "D", [70, 310])

    cal = Calibration(field, "video.mp4", 0, "field.yaml", 30.0)
    for x, y in [(100, 100), (200, 100), (200, 200), (100, 200)]:
        cal.add_point(x, y)

    quality = cal.quality_report()

    assert quality["status"] == "warning"
    assert quality["field_x_coverage"] < 0.5
    assert quality["field_y_coverage"] < 0.5
    assert "espalhados" in quality["message"]


def test_quality_accepts_reference_points_spread_across_field():
    field = FieldConfig("decode", "Decode", "", "cm", 365.76, 365.76)
    field.add_reference_point("top_left", "Canto superior esquerdo", [0, 0])
    field.add_reference_point("top_right", "Canto superior direito", [365.76, 0])
    field.add_reference_point("bottom_right", "Canto inferior direito", [365.76, 365.76])
    field.add_reference_point("bottom_left", "Canto inferior esquerdo", [0, 365.76])

    cal = Calibration(field, "video.mp4", 0, "field.yaml", 30.0)
    for x, y in [(100, 100), (400, 90), (410, 300), (90, 310)]:
        cal.add_point(x, y)

    quality = cal.quality_report()

    assert quality["status"] == "ok"
    assert quality["field_x_coverage"] == 1.0
    assert quality["field_y_coverage"] == 1.0


def test_load_legacy_calibration_without_partial_metadata():
    legacy = {
        "video": {
            "path": "video.mp4",
            "start_frame": 37,
            "fps": 59.442,
        },
        "field": {
            "path": "",
            "unit": "cm",
            "width": 365.76,
            "height": 365.76,
        },
        "reference_points": {
            "top_left": {"label": "Canto superior esquerdo", "field": [0, 0], "video": [255, 48]},
            "top_right": {"label": "Canto superior direito", "field": [365.76, 0], "video": [499, 50]},
            "bottom_right": {"label": "Canto inferior direito", "field": [365.76, 365.76], "video": [519, 295]},
            "bottom_left": {"label": "Canto inferior esquerdo", "field": [0, 365.76], "video": [226, 294]},
        },
        "homography": {
            "direction": "video_to_field",
            "matrix": [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]],
        },
    }

    with tempfile.TemporaryDirectory() as tmpdir:
        output = os.path.join(tmpdir, "legacy.yaml")
        with open(output, "w", encoding="utf-8") as f:
            yaml.dump(legacy, f)

        loaded = Calibration.load(output)

    assert loaded.start_frame == 37
    assert loaded.video_path == "video.mp4"
    assert loaded.homography is not None
    assert loaded.skipped_reference_points == []


def test_save_and_load_calibration():
    field = FieldConfig("decode", "Decode", "", "cm", 365.76, 365.76)
    field.add_reference_point("top_left", "Canto superior esquerdo", [0, 0])
    field.add_reference_point("top_right", "Canto superior direito", [365.76, 0])
    field.add_reference_point("bottom_right", "Canto inferior direito", [365.76, 365.76])
    field.add_reference_point("bottom_left", "Canto inferior esquerdo", [0, 365.76])

    cal = Calibration(field, "video.mp4", 540, "field.yaml", 59.44)
    for x, y in [(100, 100), (400, 90), (410, 300), (90, 310)]:
        cal.add_point(x, y)
    cal.compute_homography()

    with tempfile.TemporaryDirectory() as tmpdir:
        output = os.path.join(tmpdir, "cal.yaml")
        check = os.path.join(tmpdir, "check.png")
        cal.save(output, check)

        with open(output, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        assert data["video"]["start_frame"] == 540
        assert data["video"]["fps"] == 59.44
        assert data["homography"]["direction"] == "video_to_field"
        assert "top_left" in data["reference_points"]

        loaded = Calibration.load(output)
        assert loaded.start_frame == 540
        assert loaded.video_path == "video.mp4"
        assert loaded.homography is not None


def test_video_navigator_invalid_file():
    with tempfile.TemporaryDirectory() as tmpdir:
        invalid = os.path.join(tmpdir, "nao_existe.mp4")
        try:
            VideoNavigator(invalid)
            assert False, "Deveria ter levantado VideoNavigationError"
        except VideoNavigationError:
            pass


def test_reference_points_read_from_yaml():
    with tempfile.TemporaryDirectory() as tmpdir:
        field_path = os.path.join(tmpdir, "field.yaml")
        config = FieldConfig("decode", "Decode", "", "cm", 365.76, 365.76)
        config.add_reference_point("top_left", "Canto superior esquerdo", [0, 0])
        config.add_reference_point("top_right", "Canto superior direito", [365.76, 0])
        config.save(field_path)

        field = FieldConfig.from_file(field_path)
        cal = Calibration(field, "video.mp4", 0, field_path, 30.0)
        refs = cal.reference_points()
        assert len(refs) == 2
        assert refs[0][0] == "top_left"
        assert refs[1][0] == "top_right"


def test_load_arena_image_missing_raises():
    field = FieldConfig("decode", "Decode", "assets/arenas/missing.png", "cm", 365.76, 365.76)
    with tempfile.TemporaryDirectory() as tmpdir:
        field_path = os.path.join(tmpdir, "field.yaml")
        field.save(field_path)
        try:
            load_arena_image(field, field_path, cwd=tmpdir)
            assert False, "Deveria ter levantado CalibrationError"
        except CalibrationError:
            pass


def test_make_side_by_side():
    video = np.zeros((100, 200, 3), dtype=np.uint8)
    arena = np.zeros((120, 180, 3), dtype=np.uint8)
    canvas = make_side_by_side(video, arena)
    assert canvas.shape[0] == 120
    assert canvas.shape[1] == 430


def test_compose_side_by_side_preserves_full_arena_in_panel():
    video = np.zeros((720, 1280, 3), dtype=np.uint8)
    arena = np.zeros((1000, 1000, 3), dtype=np.uint8)

    view = compose_side_by_side(video, arena, max_height=720, arena_panel_width=420)

    assert view.canvas.shape[0] == 720
    assert view.video_region == (0, 0, 1280, 720)
    ax, ay, aw, ah = view.arena_region
    assert aw == 420
    assert ah == 420
    assert ay == 150
    assert ax > view.video_region[2]


def test_field_to_arena_panel_uses_scaled_arena_region():
    video = np.zeros((720, 1280, 3), dtype=np.uint8)
    arena = np.zeros((1000, 1000, 3), dtype=np.uint8)
    view = compose_side_by_side(video, arena, max_height=720, arena_panel_width=420)

    assert field_to_arena_panel([0, 0], 365.76, 365.76, view.arena_region) == (
        view.arena_region[0],
        view.arena_region[1],
    )
    assert field_to_arena_panel([365.76, 365.76], 365.76, 365.76, view.arena_region) == (
        view.arena_region[0] + view.arena_region[2] - 1,
        view.arena_region[1] + view.arena_region[3] - 1,
    )


def test_draw_arena_points_highlights_current_point_after_skips():
    canvas = np.zeros((160, 260, 3), dtype=np.uint8)
    arena_points = [(40, 80), (100, 80), (160, 80)]

    draw_arena_points(
        canvas,
        arena_points,
        [],
        already_mapped=True,
        current_index=1,
        skipped_indices={0},
    )

    assert tuple(canvas[80, 40]) == (160, 160, 160)
    assert tuple(canvas[80, 100]) == (0, 255, 255)
    assert tuple(canvas[80, 160]) == (160, 160, 160)


def test_label_position_stays_inside_right_edge():
    x, y = label_position_inside_bounds(
        "Canto superior direito",
        anchor=(400, 100),
        bounds=(0, 0, 420, 420),
    )
    assert x < 400
    assert x >= 4
    assert y >= 20


def test_label_position_stays_inside_top_edge():
    x, y = label_position_inside_bounds(
        "Canto superior esquerdo",
        anchor=(5, 2),
        bounds=(0, 0, 420, 420),
    )
    assert x >= 4
    assert y >= 20


def test_compact_reference_label_shortens_corner_names():
    assert compact_reference_label("Canto superior esquerdo") == "sup esq"
    assert compact_reference_label("Canto superior direito") == "sup dir"
    assert compact_reference_label("Canto inferior direito") == "inf dir"
    assert compact_reference_label("Centro") == "Centro"
