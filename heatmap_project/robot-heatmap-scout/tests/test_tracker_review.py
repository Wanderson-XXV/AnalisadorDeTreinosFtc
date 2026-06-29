import json
import os
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from robot_heatmap.field_config import save_yaml
from robot_heatmap.tracker_review import build_tracker_review


def test_build_tracker_review_writes_analysis_and_coach_replay_html():
    with tempfile.TemporaryDirectory() as tmpdir:
        field_path = os.path.join(tmpdir, "field.yaml")
        save_yaml(
            {
                "field": {
                    "id": "field",
                    "name": "Field",
                    "image": "arena.png",
                    "unit": "cm",
                    "width": 100,
                    "height": 100,
                },
                "reference_points": {},
                "zones": {
                    "score": {
                        "label": "Score",
                        "role": "score",
                        "points": [[0, 0], [50, 0], [50, 50], [0, 50]],
                    }
                },
            },
            field_path,
        )
        with open(os.path.join(tmpdir, "positions.csv"), "w", encoding="utf-8", newline="") as f:
            f.write(
                "frame,time_seconds,video_x,video_y,field_x,field_y,bbox_x,bbox_y,bbox_w,bbox_h,tracking_ok\n"
                "1,0.1,10,20,30,40,5,15,10,10,true\n"
                "2,0.2,,,,,,,,false\n"
            )
        with open(os.path.join(tmpdir, "tracker_events.csv"), "w", encoding="utf-8", newline="") as f:
            f.write("event,frame,time_seconds,detail\nroi_reselected,2,0.2,manual\n")
        with open(os.path.join(tmpdir, "tracker_metrics.json"), "w", encoding="utf-8") as f:
            json.dump(
                {
                    "analysis_name": "lab",
                    "video_path": "video.mp4",
                    "arena_image": "arena.png",
                    "field_path": field_path,
                    "field_width": 100,
                    "field_height": 100,
                    "tracking_ok_percent": 50.0,
                    "corrections_per_minute": 12.0,
                },
                f,
            )

        output_path = os.path.join(tmpdir, "review.html")
        build_tracker_review(tmpdir, output_path)
        html = open(output_path, "r", encoding="utf-8").read()
        analysis = json.load(open(os.path.join(tmpdir, "analysis.json"), "r", encoding="utf-8"))

    assert "Tactical Replay" in html
    assert "Coach Replay" in html
    assert "timeline" in html
    assert "debugToggle" in html
    assert "analysis-data" in html
    assert "video.mp4" in html
    assert "arena.png" in html
    assert analysis["positions"][0]["zone_id"] == "score"


def test_build_tracker_review_script_help_loads_without_ui():
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    script = os.path.join(root, "scripts", "build_tracker_review.py")

    result = subprocess.run(
        [sys.executable, script, "--help"],
        cwd=root,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0
    assert "Gera review HTML do Tracker Lab" in result.stdout
    assert "--analysis-dir" in result.stdout
    assert "--field" in result.stdout
