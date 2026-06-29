import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from robot_heatmap.zones import (
    DEFAULT_ZONE_ANALYSIS,
    DEFAULT_ZONE_VISUAL,
    normalize_field_zones,
    point_in_polygon,
)


def test_normalize_field_zones_adds_defaults_to_old_yaml_shape():
    zones = {
        "close_zone": {
            "label": "close zone",
            "type": "polygon",
            "points": [[0, 0], [10, 0], [10, 10], [0, 10]],
        }
    }

    normalized = normalize_field_zones(zones)

    assert normalized == [
        {
            "id": "close_zone",
            "label": "close zone",
            "type": "polygon",
            "role": "unknown",
            "alliance": "neutral",
            "polygon": [[0.0, 0.0], [10.0, 0.0], [10.0, 10.0], [0.0, 10.0]],
            "visual": DEFAULT_ZONE_VISUAL,
            "analysis": DEFAULT_ZONE_ANALYSIS,
        }
    ]


def test_normalize_field_zones_preserves_semantic_zone_fields():
    zones = {
        "red_loading_zone": {
            "label": "Red Loading Zone",
            "type": "polygon",
            "role": "collect",
            "alliance": "red",
            "points": [[0, 0], [20, 0], [20, 20], [0, 20]],
            "visual": {"color": "collect", "opacity": 0.18, "border": True, "label": True},
            "analysis": {"count_time": True, "detect_stops": True, "important": True},
        }
    }

    normalized = normalize_field_zones(zones)

    assert normalized[0]["id"] == "red_loading_zone"
    assert normalized[0]["role"] == "collect"
    assert normalized[0]["alliance"] == "red"
    assert normalized[0]["visual"]["color"] == "collect"
    assert normalized[0]["analysis"]["important"] is True


def test_normalize_field_zones_falls_back_from_invalid_semantics():
    zones = {
        "bad_zone": {
            "label": "Bad Zone",
            "type": "polygon",
            "role": "launchpad",
            "alliance": "green",
            "points": [[0, 0], [10, 0], [10, 10]],
        }
    }

    normalized = normalize_field_zones(zones)

    assert normalized[0]["role"] == "unknown"
    assert normalized[0]["alliance"] == "neutral"


def test_point_in_polygon_handles_inside_outside_and_edges():
    polygon = [[0, 0], [10, 0], [10, 10], [0, 10]]

    assert point_in_polygon(5, 5, polygon) is True
    assert point_in_polygon(12, 5, polygon) is False
    assert point_in_polygon(0, 5, polygon) is True
