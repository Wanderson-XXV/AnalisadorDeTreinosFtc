"""Camera capture abstraction.

Supports three source types:

* ``camera`` - a live UVC device via ``cv2.VideoCapture`` (C920 defaults)
* ``file``   - a video file played back frame by frame
* ``demo``   - a synthetic renderer that draws a moving ArUco marker so the
               whole application can be exercised without any hardware.
"""

from __future__ import annotations

from contextlib import contextmanager
import sys
import time
from typing import Optional, Tuple

import cv2
import numpy as np

from .models import CameraConfig, CameraState
from . import aruco_detection


# Backend name -> cv2 constant (best effort; falls back to CAP_ANY).
_BACKENDS = {
    "auto": getattr(cv2, "CAP_ANY", 0),
    "dshow": getattr(cv2, "CAP_DSHOW", 700),
    "msmf": getattr(cv2, "CAP_MSMF", 1400),
    "v4l2": getattr(cv2, "CAP_V4L2", 200),
}


def _backend_candidates(backend_name: str, *, allow_fallback: bool) -> list[int]:
    """Choose capture backends without sending Windows through CAP_ANY first."""
    normalized = str(backend_name or "auto").strip().lower()
    if normalized != "auto":
        return [_BACKENDS.get(normalized, cv2.CAP_ANY)]

    # CAP_ANY probes obsensor/OpenNI for empty slots on some Windows installs.
    # A UVC webcam such as the C920 should use DirectShow first.
    if sys.platform.startswith("win"):
        candidates = [getattr(cv2, "CAP_DSHOW", cv2.CAP_ANY)]
        if allow_fallback:
            candidates.append(getattr(cv2, "CAP_MSMF", cv2.CAP_ANY))
        return list(dict.fromkeys(candidates))
    if sys.platform.startswith("linux"):
        return [getattr(cv2, "CAP_V4L2", cv2.CAP_ANY)]
    return [cv2.CAP_ANY]


@contextmanager
def _silence_opencv_logs():
    """Hide expected diagnostics while deliberately probing empty slots."""
    get_level = getattr(cv2, "getLogLevel", None)
    set_level = getattr(cv2, "setLogLevel", None)
    previous = get_level() if callable(get_level) else None
    if callable(set_level):
        try:
            set_level(getattr(cv2, "LOG_LEVEL_SILENT", 0))
        except Exception:
            pass
    try:
        yield
    finally:
        if callable(set_level) and previous is not None:
            try:
                set_level(previous)
            except Exception:
                pass


def _legacy_enumerate_cameras(max_index: int = 10) -> list[dict]:
    """Probe camera indices 0..max_index and return info on available ones.

    Each entry: {"index": int, "name": str, "width": int, "height": int}.
    The "name" is inferred from the backend (best effort); it will usually
    say "Camera N" on platforms that do not expose a human-friendly name.
    """
    found: list[dict] = []
    for idx in range(max_index + 1):
        cap = cv2.VideoCapture(idx)
        if cap.isOpened():
            w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            backend_id = int(cap.get(cv2.CAP_PROP_BACKEND))
            backend_label = cap.getBackendName() if hasattr(cap, "getBackendName") else str(backend_id)
            name = f"Camera {idx} ({w}×{h}, {backend_label})"
            found.append({"index": idx, "name": name, "width": w, "height": h})
            cap.release()
        else:
            cap.release()
    return found


def enumerate_cameras(max_index: int = 4, backend: str = "auto") -> list[dict]:
    """Find cameras without displaying errors for indices that do not exist.

    On Windows, ``auto`` probes DirectShow instead of CAP_ANY. The latter can
    invoke the obsensor backend for every missing index and flood the terminal
    with harmless "Camera index out of range" messages.
    """
    found: list[dict] = []
    capture_backend = _backend_candidates(backend, allow_fallback=False)[0]
    with _silence_opencv_logs():
        for idx in range(max_index + 1):
            cap = cv2.VideoCapture(idx, capture_backend)
            try:
                if not cap.isOpened():
                    continue
                width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                backend_id = int(cap.get(cv2.CAP_PROP_BACKEND))
                backend_label = (cap.getBackendName()
                                 if hasattr(cap, "getBackendName")
                                 else str(backend_id))
                found.append({
                    "index": idx,
                    "name": f"Camera {idx} ({width}x{height}, {backend_label})",
                    "width": width,
                    "height": height,
                })
            finally:
                cap.release()
    return found


class CameraManager:
    """Manage a capture source and expose obtained (actual) parameters."""

    def __init__(self, config: Optional[CameraConfig] = None):
        self.config = config or CameraConfig()
        self.state = CameraState()
        self._cap: Optional[cv2.VideoCapture] = None
        self._demo = None
        self._last_time = 0.0
        self._fps_samples: list[float] = []

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    def open(self, config: Optional[CameraConfig] = None) -> bool:
        if config is not None:
            self.config = config
        self.close()

        st = self.config.source_type
        if st == "demo":
            return self._open_demo()
        if st == "file":
            return self._open_file()
        return self._open_camera()

    def _open_demo(self) -> bool:
        self._demo = DemoSource(self.config)
        self.state = CameraState(
            connected=True,
            actual_width=self.config.width,
            actual_height=self.config.height,
            actual_fps=float(self.config.fps),
            backend_name="demo",
            supported_controls={},
        )
        return True

    def _open_file(self) -> bool:
        cap = cv2.VideoCapture(self.config.file_path)
        if not cap.isOpened():
            self.state = CameraState(connected=False)
            return False
        self._cap = cap
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS) or float(self.config.fps)
        self.state = CameraState(
            connected=True, actual_width=w, actual_height=h,
            actual_fps=fps, backend_name="file",
        )
        return True

    def _open_camera(self) -> bool:
        cap = None
        for backend in _backend_candidates(
            self.config.backend, allow_fallback=True
        ):
            candidate = cv2.VideoCapture(self.config.index, backend)
            if candidate.isOpened():
                cap = candidate
                break
            candidate.release()
        if cap is None:
            self.state = CameraState(connected=False)
            return False

        self._cap = cap
        self._apply_resolution()
        supported = self.apply_controls()

        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
        self.state = CameraState(
            connected=True, actual_width=w, actual_height=h,
            actual_fps=fps, backend_name=self.config.backend,
            supported_controls=supported,
        )
        return True

    def _apply_resolution(self) -> None:
        if self._cap is None:
            return
        # MJPG lets the C920 reach 1080p30 over USB.
        try:
            self._cap.set(cv2.CAP_PROP_FOURCC,
                          cv2.VideoWriter_fourcc(*"MJPG"))
        except Exception:
            pass
        self._cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.config.width)
        self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.config.height)
        self._cap.set(cv2.CAP_PROP_FPS, self.config.fps)

    def apply_controls(self) -> dict:
        """Apply focus/exposure/gain controls; report which were accepted."""
        supported: dict = {}
        if self._cap is None:
            return supported
        c = self.config

        supported["autofocus"] = self._safe_set(
            cv2.CAP_PROP_AUTOFOCUS, 1 if c.autofocus else 0)
        if not c.autofocus:
            supported["focus"] = self._safe_set(cv2.CAP_PROP_FOCUS, c.focus)

        # 0.75 -> auto, 0.25 -> manual on many UVC drivers.
        supported["autoexposure"] = self._safe_set(
            cv2.CAP_PROP_AUTO_EXPOSURE, 0.75 if c.autoexposure else 0.25)
        if not c.autoexposure:
            supported["exposure"] = self._safe_set(
                cv2.CAP_PROP_EXPOSURE, c.exposure)

        supported["gain"] = self._safe_set(cv2.CAP_PROP_GAIN, c.gain)
        supported["brightness"] = self._safe_set(
            cv2.CAP_PROP_BRIGHTNESS, c.brightness)
        return supported

    def _safe_set(self, prop: int, value) -> bool:
        """Set a property and report whether it appears to have taken effect."""
        if self._cap is None:
            return False
        try:
            ok = self._cap.set(prop, float(value))
            return bool(ok)
        except Exception:
            return False

    def is_open(self) -> bool:
        if self.config.source_type == "demo":
            return self._demo is not None
        return self._cap is not None and self._cap.isOpened()

    def close(self) -> None:
        if self._cap is not None:
            self._cap.release()
            self._cap = None
        self._demo = None
        self.state = CameraState(connected=False)
        self._fps_samples.clear()

    # ------------------------------------------------------------------
    # Frame reading
    # ------------------------------------------------------------------
    def read(self) -> Tuple[bool, Optional[np.ndarray]]:
        if self.config.source_type == "demo" and self._demo is not None:
            frame = self._demo.render()
            self._update_fps()
            return True, frame
        if self._cap is None:
            return False, None
        ok, frame = self._cap.read()
        if ok:
            self._update_fps()
        return ok, frame

    def _update_fps(self) -> None:
        now = time.time()
        if self._last_time > 0:
            dt = now - self._last_time
            if dt > 0:
                self._fps_samples.append(1.0 / dt)
                if len(self._fps_samples) > 30:
                    self._fps_samples.pop(0)
                self.state.measured_fps = float(np.mean(self._fps_samples))
        self._last_time = now

    def __enter__(self) -> "CameraManager":
        self.open()
        return self

    def __exit__(self, *exc) -> None:
        self.close()


class DemoSource:
    """Render a synthetic *perspective* scene: fixed references + moving robot.

    A true pinhole virtual camera looks down (with a slight tilt) at an arena.
    Reference markers lie on the floor (z=0); the robot marker moves along a
    path at ``marker_height_mm``. Because the scene is a real perspective
    projection with known intrinsics/extrinsics, the whole pipeline (detection,
    ``solvePnP`` pose, arena registration) works end to end with no hardware.

    Ground truth is exposed via :meth:`get_calibration` and
    :meth:`get_reference_corners` so the app can auto-configure the demo.
    """

    # arena the virtual camera observes (mm)
    ARENA_W = 2000.0
    ARENA_H = 1000.0
    ROBOT_ID = 0
    REF_IDS = (10, 11, 12, 13)
    MARKER_LEN = 220.0          # robot + reference marker side (mm, enlarged
                                # so the synthetic projection stays detectable)
    ROBOT_HEIGHT = 60.0         # robot marker plane height (mm)

    def __init__(self, config: CameraConfig, dictionary: str = "DICT_4X4_50"):
        self.config = config
        self.width = config.width
        self.height = config.height
        self._dict = aruco_detection.get_dictionary(dictionary)
        self._t0 = time.time()

        # virtual intrinsics
        f = 1.15 * max(self.width, self.height)
        self.K = np.array([[f, 0, self.width / 2.0],
                           [0, f, self.height / 2.0],
                           [0, 0, 1.0]], dtype=np.float64)
        self.dist = np.zeros((1, 5), dtype=np.float64)

        # virtual extrinsics from a look-at (camera behind + above the arena,
        # aimed at the arena centre) so the whole floor is in frame.
        self.rvec, self.tvec = self._lookat_extrinsics(
            camera=(self.ARENA_W / 2.0, -1200.0, 2400.0),
            target=(self.ARENA_W / 2.0, self.ARENA_H / 2.0, 0.0))

        # reference floor positions (centres, mm)
        m = 300.0
        self._ref_centers = {
            self.REF_IDS[0]: (m, m),
            self.REF_IDS[1]: (self.ARENA_W - m, m),
            self.REF_IDS[2]: (self.ARENA_W - m, self.ARENA_H - m),
            self.REF_IDS[3]: (m, self.ARENA_H - m),
        }
        self._marker_px = 200
        self._tiles = {
            mid: self._make_marker_tile(mid, self._marker_px)
            for mid in (self.ROBOT_ID,) + self.REF_IDS
        }
        # Tile = black marker (marker_px) + quiet-zone padding on each side.
        # The full tile is pasted over an area larger than MARKER_LEN so that
        # the *black border* (what ArUco measures / solvePnP uses) spans
        # exactly MARKER_LEN mm.
        pad = self._marker_px // 5
        self._pad_ratio = (self._marker_px + 2 * pad) / self._marker_px

    # ------------------------------------------------------------------
    @staticmethod
    def _lookat_extrinsics(camera, target,
                           world_up=(0.0, 0.0, 1.0)):
        """Build (rvec, tvec) so the camera at ``camera`` looks at ``target``."""
        C = np.asarray(camera, dtype=np.float64)
        T = np.asarray(target, dtype=np.float64)
        up = np.asarray(world_up, dtype=np.float64)
        fwd = T - C
        fwd /= np.linalg.norm(fwd)
        right = np.cross(fwd, up)
        right /= np.linalg.norm(right)
        down = np.cross(fwd, right)
        R = np.stack([right, down, fwd], axis=0)  # rows: camera axes in world
        rvec, _ = cv2.Rodrigues(R)
        tvec = (-R @ C).reshape(3, 1)
        return rvec, tvec

    def _make_marker_tile(self, marker_id: int, size: int) -> np.ndarray:
        img = cv2.aruco.generateImageMarker(self._dict, marker_id, size)
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        # add a white quiet-zone border
        pad = size // 5
        return cv2.copyMakeBorder(img, pad, pad, pad, pad,
                                  cv2.BORDER_CONSTANT, value=(255, 255, 255))

    def _marker_world_corners(self, cx, cy, z, heading_deg=0.0):
        """Return 4 world corners TL,TR,BR,BL (arena mm) for a marker."""
        h = self.MARKER_LEN / 2.0
        local = np.array([[-h, -h], [h, -h], [h, h], [-h, h]], dtype=float)
        c = np.cos(np.radians(heading_deg))
        s = np.sin(np.radians(heading_deg))
        R = np.array([[c, -s], [s, c]])
        world = []
        for lx, ly in local:
            wx, wy = R @ np.array([lx, ly])
            world.append([cx + wx, cy + wy, z])
        return np.array(world, dtype=np.float64)

    def _project(self, pts3d):
        p, _ = cv2.projectPoints(np.asarray(pts3d, dtype=np.float64),
                                 self.rvec, self.tvec, self.K, self.dist)
        return p.reshape(-1, 2)

    @staticmethod
    def _signed_area(pts) -> float:
        x = pts[:, 0]
        y = pts[:, 1]
        return 0.5 * float(np.sum(x * np.roll(y, -1) - np.roll(x, -1) * y))

    def _paste_marker(self, canvas, tile, world_corners):
        # Expand the (black-border) world corners outwards about their centroid
        # so the pasted tile's quiet-zone padding lands *outside* MARKER_LEN.
        wc = np.asarray(world_corners, dtype=np.float64)
        centroid = wc.mean(axis=0)
        wc = centroid + (wc - centroid) * self._pad_ratio
        img_corners = self._project(wc).astype(np.float32)
        th, tw = tile.shape[:2]
        # Tile corners TL,TR,BR,BL are clockwise in image space (y-down).
        src = np.array([[0, 0], [tw, 0], [tw, th], [0, th]], dtype=np.float32)
        # The virtual camera can flip the winding of the projected quad
        # (e.g. arena +y maps to image "up"). Mapping a clockwise tile onto a
        # counter-clockwise quad mirrors the marker and ArUco rejects it, so
        # reverse the correspondence whenever the projected quad is CCW.
        # ``src`` is clockwise -> positive signed area with this convention;
        # reverse the tile correspondence when the projected quad flips it.
        if self._signed_area(img_corners) < 0:
            src = src[::-1].copy()
        H = cv2.getPerspectiveTransform(src, img_corners)
        warped = cv2.warpPerspective(tile, H, (canvas.shape[1], canvas.shape[0]))
        mask = cv2.warpPerspective(
            np.full((th, tw), 255, np.uint8), H,
            (canvas.shape[1], canvas.shape[0]))
        canvas[mask > 0] = warped[mask > 0]

    # ------------------------------------------------------------------
    def render(self) -> np.ndarray:
        canvas = np.full((self.height, self.width, 3), 210, dtype=np.uint8)
        # floor rectangle (project arena corners)
        floor = self._project([[0, 0, 0], [self.ARENA_W, 0, 0],
                               [self.ARENA_W, self.ARENA_H, 0],
                               [0, self.ARENA_H, 0]]).astype(np.int32)
        cv2.fillPoly(canvas, [floor], (190, 190, 185))
        cv2.polylines(canvas, [floor], True, (120, 120, 120), 3)

        for mid, (cx, cy) in self._ref_centers.items():
            self._paste_marker(canvas, self._tiles[mid],
                               self._marker_world_corners(cx, cy, 0.0))

        # robot moves along an S-path
        t = time.time() - self._t0
        cx = self.ARENA_W / 2 + (self.ARENA_W * 0.30) * np.sin(t * 0.4)
        cy = self.ARENA_H / 2 + (self.ARENA_H * 0.28) * np.sin(t * 0.8)
        heading = (np.degrees(t * 0.4)) % 360
        self._paste_marker(
            canvas, self._tiles[self.ROBOT_ID],
            self._marker_world_corners(cx, cy, self.ROBOT_HEIGHT, heading))
        return canvas

    # ------------------------------------------------------------------
    # ground-truth exposed for auto-configuring the demo
    def get_calibration(self):
        from .models import CalibrationData
        return CalibrationData(
            camera_matrix=self.K.copy(),
            dist_coeffs=self.dist.copy(),
            image_width=self.width,
            image_height=self.height,
            rms_error=0.0,
            num_views=0,
            board_spec={"source": "demo"},
        )

    def get_reference_corners(self):
        """Return {marker_id: 4x3 arena corners (z=0)} for the fixed refs."""
        return {
            mid: self._marker_world_corners(cx, cy, 0.0)
            for mid, (cx, cy) in self._ref_centers.items()
        }
