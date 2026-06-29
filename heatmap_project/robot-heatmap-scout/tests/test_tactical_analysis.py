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


from robot_heatmap.tactical_analysis import (
    assign_zone,
    build_position_analysis,
    build_segments,
    build_stops,
)


def test_assign_zone_returns_first_matching_zone_and_unknown_fallback():
    zones = normalize_field_zones(
        {
            "collect_zone": {
                "label": "Collect",
                "role": "collect",
                "points": [[0, 0], [20, 0], [20, 20], [0, 20]],
            },
            "score_zone": {
                "label": "Score",
                "role": "score",
                "points": [[10, 10], [30, 10], [30, 30], [10, 30]],
            },
        }
    )

    assert assign_zone(12, 12, zones)["id"] == "collect_zone"
    assert assign_zone(25, 25, zones)["id"] == "score_zone"
    assert assign_zone(50, 50, zones) is None


def test_build_position_analysis_adds_zone_speed_and_state():
    zones = normalize_field_zones(
        {
            "collect_zone": {
                "label": "Collect",
                "role": "collect",
                "points": [[0, 0], [20, 0], [20, 20], [0, 20]],
            }
        }
    )
    raw_positions = [
        {"frame": "0", "time_seconds": "0.0", "video_x": "1", "video_y": "1", "field_x": "0", "field_y": "0", "bbox_x": "0", "bbox_y": "0", "bbox_w": "2", "bbox_h": "2", "tracking_ok": "true"},
        {"frame": "10", "time_seconds": "1.0", "video_x": "2", "video_y": "1", "field_x": "2", "field_y": "0", "bbox_x": "1", "bbox_y": "0", "bbox_w": "2", "bbox_h": "2", "tracking_ok": "true"},
        {"frame": "20", "time_seconds": "2.0", "video_x": "30", "video_y": "1", "field_x": "30", "field_y": "0", "bbox_x": "29", "bbox_y": "0", "bbox_w": "2", "bbox_h": "2", "tracking_ok": "true"},
        {"frame": "30", "time_seconds": "3.0", "video_x": "", "video_y": "", "field_x": "", "field_y": "", "bbox_x": "", "bbox_y": "", "bbox_w": "", "bbox_h": "", "tracking_ok": "false"},
    ]

    analyzed = build_position_analysis(raw_positions, zones)

    assert analyzed[0]["zone_id"] == "collect_zone"
    assert analyzed[0]["zone_role"] == "collect"
    assert analyzed[0]["speed_cm_s"] == 0.0
    assert analyzed[0]["state"] == "stopped"
    assert analyzed[2]["zone_id"] is None
    assert analyzed[2]["zone_role"] == "unknown"
    assert analyzed[2]["state"] == "moving"
    assert analyzed[3]["state"] == "unknown"


def test_build_segments_groups_consecutive_zone_role_and_state():
    positions = [
        {"t": 0.0, "zone_id": "collect", "zone_role": "collect", "state": "moving", "speed_cm_s": 10.0, "tracking_ok": True},
        {"t": 1.0, "zone_id": "collect", "zone_role": "collect", "state": "moving", "speed_cm_s": 12.0, "tracking_ok": True},
        {"t": 2.0, "zone_id": "score", "zone_role": "score", "state": "stopped", "speed_cm_s": 2.0, "tracking_ok": True},
        {"t": 3.5, "zone_id": "score", "zone_role": "score", "state": "stopped", "speed_cm_s": 1.0, "tracking_ok": True},
    ]

    segments = build_segments(positions)

    assert len(segments) == 2
    assert segments[0]["start"] == 0.0
    assert segments[0]["end"] == 2.0
    assert segments[0]["zone_role"] == "collect"
    assert segments[1]["state"] == "stopped"
    assert segments[1]["duration"] == 1.5


def test_build_stops_extracts_relevant_stopped_segments():
    segments = [
        {"id": "seg_001", "start": 0.0, "end": 0.5, "duration": 0.5, "zone_id": "collect", "zone_role": "collect", "state": "stopped"},
        {"id": "seg_002", "start": 1.0, "end": 2.5, "duration": 1.5, "zone_id": "score", "zone_role": "score", "state": "stopped"},
    ]
    positions = [
        {"t": 1.0, "field_x": 10.0, "field_y": 20.0, "tracking_ok": True},
        {"t": 2.0, "field_x": 14.0, "field_y": 22.0, "tracking_ok": True},
    ]

    stops = build_stops(segments, positions)

    assert len(stops) == 1
    assert stops[0]["id"] == "P1"
    assert stops[0]["duration"] == 1.5
    assert stops[0]["zone_id"] == "score"
    assert stops[0]["field_x"] == 12.0
    assert stops[0]["field_y"] == 21.0
