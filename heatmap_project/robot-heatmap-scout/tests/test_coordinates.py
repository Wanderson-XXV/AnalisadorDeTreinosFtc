import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from robot_heatmap.coordinates import image_to_field, field_to_image, Coordinates
from robot_heatmap.zones import is_valid_polygon, normalize_zone, Zones


class TestCoordinates:
    def test_image_to_field_center(self):
        result = image_to_field(640, 360, 1280, 720)
        assert result == [500, 500]

    def test_image_to_field_top_left(self):
        result = image_to_field(0, 0, 1280, 720)
        assert result == [0, 0]

    def test_image_to_field_bottom_right(self):
        result = image_to_field(1280, 720, 1280, 720)
        assert result == [1000, 1000]

    def test_field_to_image_center(self):
        result = field_to_image(500, 500, 1280, 720)
        assert result == (640, 360)

    def test_field_to_image_top_left(self):
        result = field_to_image(0, 0, 1280, 720)
        assert result == (0, 0)

    def test_field_to_image_bottom_right(self):
        result = field_to_image(1000, 1000, 1280, 720)
        assert result == (1280, 720)

    def test_roundtrip_image_to_field_to_image(self):
        ix, iy = 320, 180
        fw, fh = 1280, 720
        field_pt = image_to_field(ix, iy, fw, fh)
        back = field_to_image(field_pt[0], field_pt[1], fw, fh)
        assert back == (ix, iy)

    def test_coordinates_class(self):
        c = Coordinates(1280, 720)
        fp = c.to_field(640, 360)
        assert fp == [500, 500]
        ip = c.to_image(500, 500)
        assert ip == (640, 360)

    def test_coordinates_non_square_image(self):
        c = Coordinates(800, 600)
        fp = c.to_field(400, 300)
        assert fp == [500, 500]
        ip = c.to_image(500, 500)
        assert ip == (400, 300)


class TestZones:
    def test_valid_polygon_triangle(self):
        assert is_valid_polygon([[0, 0], [100, 0], [50, 100]]) is True

    def test_valid_polygon_square(self):
        assert is_valid_polygon([[0, 0], [100, 0], [100, 100], [0, 100]]) is True

    def test_invalid_polygon_two_points(self):
        assert is_valid_polygon([[0, 0], [100, 0]]) is False

    def test_invalid_polygon_empty(self):
        assert is_valid_polygon([]) is False

    def test_invalid_polygon_not_list(self):
        assert is_valid_polygon("nao e lista") is False

    def test_invalid_polygon_bad_point_format(self):
        assert is_valid_polygon([[0, 0], [100], [50, 100]]) is False

    def test_normalize_zone(self):
        pts = [[400, 400], [600, 400], [600, 600], [400, 600]]
        result = normalize_zone("center", "Centro", pts)
        assert "center" in result
        assert result["center"]["label"] == "Centro"
        assert result["center"]["type"] == "polygon"
        assert result["center"]["points"] == pts

    def test_zones_class_is_valid(self):
        assert Zones.is_valid([[0, 0], [100, 0], [50, 100]]) is True
        assert Zones.is_valid([[0, 0], [100, 0]]) is False

    def test_zones_class_normalize(self):
        pts = [[0, 0], [100, 0], [100, 100]]
        result = Zones.normalize("tri", "Triangulo", pts)
        assert result["tri"]["label"] == "Triangulo"
        assert len(result["tri"]["points"]) == 3
