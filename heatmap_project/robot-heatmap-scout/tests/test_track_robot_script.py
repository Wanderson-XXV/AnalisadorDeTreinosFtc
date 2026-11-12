import os
import subprocess
import sys


def test_track_robot_script_help_loads_without_opening_ui():
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    script = os.path.join(root, "scripts", "track_robot.py")

    result = subprocess.run(
        [sys.executable, script, "--help"],
        cwd=root,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0
    assert "Tracker Human-in-the-loop" in result.stdout
    assert "--calibration" in result.stdout
    assert "--video" in result.stdout
    assert "--speed" in result.stdout
    assert "--analysis-dir" in result.stdout
    assert "--tracker" in result.stdout
