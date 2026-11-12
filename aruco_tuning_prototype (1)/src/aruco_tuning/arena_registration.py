"""Camera <-> arena registration.

Two registration paths, both ending in a common
:class:`CameraExtrinsics` (arena -> camera transform) that the pose module
uses to place the robot in arena millimetres:

1. **Manual correspondences** - the user clicks matching points in the camera
   frame and in the arena view. With >= 4 pairs (all on the arena floor,
   z = 0) we compute a RANSAC homography (for residual display / warping)
   *and* recover full extrinsics via ``solvePnP``.

2. **Learned ArUco references** - right after a manual registration we detect
   the fixed ArUco markers in the frame, back-project their image corners onto
   the floor plane to obtain their arena coordinates, and store them. On later
   runs those learned world points + freshly detected image corners recover
   the extrinsics automatically with ``solvePnP`` (no clicking required).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

from . import geometry
from .models import MarkerDetection


# ---------------------------------------------------------------------------
# Extrinsics
# ---------------------------------------------------------------------------
@dataclass
class CameraExtrinsics:
    """Arena -> camera rigid transform (as returned by ``solvePnP``).

    ``X_cam = R @ X_arena + t`` with X in millimetres.
    """

    rvec: np.ndarray  # (3,1)
    tvec: np.ndarray  # (3,1)

    @property
    def R(self) -> np.ndarray:
        R, _ = cv2.Rodrigues(self.rvec)
        return R

    def camera_position_arena(self) -> np.ndarray:
        """Camera optical centre expressed in arena coordinates (mm)."""
        R = self.R
        return (-R.T @ self.tvec).reshape(3)

    def arena_to_camera(self, pts_arena: np.ndarray) -> np.ndarray:
        pts = np.asarray(pts_arena, dtype=float).reshape(-1, 3)
        return (self.R @ pts.T + self.tvec.reshape(3, 1)).T

    def camera_to_arena(self, pts_cam: np.ndarray) -> np.ndarray:
        pts = np.asarray(pts_cam, dtype=float).reshape(-1, 3)
        R = self.R
        return (R.T @ (pts.T - self.tvec.reshape(3, 1))).T

    def image_to_arena_plane(
        self,
        image_points: np.ndarray,
        camera_matrix: np.ndarray,
        dist_coeffs: np.ndarray,
        plane_z: float = 0.0,
    ) -> np.ndarray:
        """Back-project image points onto the arena plane ``z = plane_z``.

        Returns Nx3 arena points (with z == plane_z). This is the key routine
        used for the XY-stabilised pose and for learning reference positions.
        """
        pts = np.asarray(image_points, dtype=float).reshape(-1, 1, 2)
        undist = cv2.undistortPoints(pts, camera_matrix, dist_coeffs)
        undist = undist.reshape(-1, 2)
        R = self.R
        cam_center = self.camera_position_arena()  # (3,)
        out = np.zeros((undist.shape[0], 3), dtype=float)
        for i, (nx, ny) in enumerate(undist):
            ray_cam = np.array([nx, ny, 1.0])
            ray_arena = R.T @ ray_cam  # direction in arena frame
            if abs(ray_arena[2]) < 1e-9:
                out[i] = [np.nan, np.nan, plane_z]
                continue
            lam = (plane_z - cam_center[2]) / ray_arena[2]
            world = cam_center + lam * ray_arena
            world[2] = plane_z
            out[i] = world
        return out


def extrinsics_from_correspondences(
    image_points: np.ndarray,
    arena_points_xy: np.ndarray,
    camera_matrix: np.ndarray,
    dist_coeffs: np.ndarray,
) -> Optional[CameraExtrinsics]:
    """Recover extrinsics from floor (z=0) correspondences via ``solvePnP``."""
    img = np.asarray(image_points, dtype=np.float32).reshape(-1, 2)
    arena_xy = np.asarray(arena_points_xy, dtype=np.float32).reshape(-1, 2)
    if img.shape[0] < 4 or img.shape[0] != arena_xy.shape[0]:
        return None
    obj = np.hstack([arena_xy, np.zeros((arena_xy.shape[0], 1),
                                        dtype=np.float32)])
    ok, rvec, tvec = cv2.solvePnP(
        obj, img, camera_matrix, dist_coeffs,
        flags=cv2.SOLVEPNP_ITERATIVE)
    if not ok:
        return None
    return CameraExtrinsics(rvec=rvec, tvec=tvec)


# ---------------------------------------------------------------------------
# Registration data container
# ---------------------------------------------------------------------------
@dataclass
class LearnedReference:
    """A fixed ArUco whose arena-space corner coordinates have been learned."""

    marker_id: int
    corners_arena: np.ndarray  # 4x3 (z = 0)

    def to_dict(self) -> dict:
        return {
            "marker_id": int(self.marker_id),
            "corners_arena": self.corners_arena.reshape(-1, 3).tolist(),
        }

    @classmethod
    def from_dict(cls, d: dict) -> "LearnedReference":
        return cls(
            marker_id=int(d["marker_id"]),
            corners_arena=np.asarray(d["corners_arena"], dtype=float).reshape(4, 3),
        )


@dataclass
class RegistrationData:
    """Everything needed to place points from image into the arena."""

    homography: Optional[np.ndarray] = None  # image -> arena
    rvec: Optional[np.ndarray] = None
    tvec: Optional[np.ndarray] = None
    image_size: Tuple[int, int] = (0, 0)
    correspondences_image: List[List[float]] = field(default_factory=list)
    correspondences_arena: List[List[float]] = field(default_factory=list)
    residuals: List[float] = field(default_factory=list)
    learned_references: Dict[int, LearnedReference] = field(default_factory=dict)

    @property
    def is_registered(self) -> bool:
        return self.rvec is not None and self.tvec is not None

    def extrinsics(self) -> Optional[CameraExtrinsics]:
        if not self.is_registered:
            return None
        return CameraExtrinsics(
            rvec=np.asarray(self.rvec, dtype=float).reshape(3, 1),
            tvec=np.asarray(self.tvec, dtype=float).reshape(3, 1))


# ---------------------------------------------------------------------------
# Registration manager
# ---------------------------------------------------------------------------
class ArenaRegistration:
    """Build and maintain :class:`RegistrationData`."""

    def __init__(self, data: Optional[RegistrationData] = None):
        self.data = data or RegistrationData()
        self._img_pts: List[Tuple[float, float]] = [
            tuple(p) for p in self.data.correspondences_image]
        self._arena_pts: List[Tuple[float, float]] = [
            tuple(p) for p in self.data.correspondences_arena]

    # ------------------------------------------------------------------
    def add_correspondence(self, image_pt, arena_pt) -> None:
        self._img_pts.append((float(image_pt[0]), float(image_pt[1])))
        self._arena_pts.append((float(arena_pt[0]), float(arena_pt[1])))

    def remove_correspondence(self, index: int) -> bool:
        if 0 <= index < len(self._img_pts):
            self._img_pts.pop(index)
            self._arena_pts.pop(index)
            return True
        return False

    def clear_correspondences(self) -> None:
        self._img_pts.clear()
        self._arena_pts.clear()

    @property
    def num_correspondences(self) -> int:
        return len(self._img_pts)

    # ------------------------------------------------------------------
    def compute_homography(self) -> Tuple[bool, str]:
        """Compute image->arena homography (RANSAC) and per-point residuals."""
        if len(self._img_pts) < 4:
            return False, "São necessários pelo menos 4 pares de pontos"
        src = np.asarray(self._img_pts, dtype=np.float32)
        dst = np.asarray(self._arena_pts, dtype=np.float32)
        H, mask = cv2.findHomography(src, dst, cv2.RANSAC, 5.0)
        if H is None:
            return False, "Falha ao calcular a homografia"
        residuals = geometry.homography_residuals(H, src, dst)
        self.data.homography = H
        self.data.correspondences_image = [list(p) for p in self._img_pts]
        self.data.correspondences_arena = [list(p) for p in self._arena_pts]
        self.data.residuals = [float(r) for r in residuals]
        return True, (
            f"Homografia calculada. Resíduo médio = "
            f"{np.mean(residuals):.2f} mm")

    def compute_extrinsics(self, camera_matrix, dist_coeffs
                           ) -> Tuple[bool, str]:
        """Recover extrinsics from the manual floor correspondences."""
        ext = extrinsics_from_correspondences(
            np.asarray(self._img_pts), np.asarray(self._arena_pts),
            camera_matrix, dist_coeffs)
        if ext is None:
            return False, "Não foi possível recuperar a pose da câmera (solvePnP)"
        self.data.rvec = ext.rvec
        self.data.tvec = ext.tvec
        self.data.correspondences_image = [list(p) for p in self._img_pts]
        self.data.correspondences_arena = [list(p) for p in self._arena_pts]
        return True, "Pose da câmera recuperada com sucesso"

    def register_manual(self, camera_matrix, dist_coeffs, image_size=None
                        ) -> Tuple[bool, str]:
        """Full manual registration: homography + extrinsics."""
        ok, msg = self.compute_homography()
        if not ok:
            return False, msg
        ok2, msg2 = self.compute_extrinsics(camera_matrix, dist_coeffs)
        if not ok2:
            return False, msg2
        if image_size is not None:
            self.data.image_size = tuple(image_size)
        return True, f"{msg}. {msg2}"

    def worst_correspondence(self) -> Optional[int]:
        if not self.data.residuals:
            return None
        return int(np.argmax(self.data.residuals))

    # ------------------------------------------------------------------
    def learn_references(
        self,
        detections: List[MarkerDetection],
        camera_matrix,
        dist_coeffs,
        exclude_ids: Optional[List[int]] = None,
    ) -> Tuple[int, str]:
        """Learn arena coordinates of fixed markers via floor back-projection."""
        ext = self.data.extrinsics()
        if ext is None:
            return 0, "Registre a câmera antes de aprender as referências"
        exclude = set(exclude_ids or [])
        count = 0
        for det in detections:
            if det.marker_id in exclude:
                continue
            corners_arena = ext.image_to_arena_plane(
                det.corners, camera_matrix, dist_coeffs, plane_z=0.0)
            if np.any(np.isnan(corners_arena)):
                continue
            self.data.learned_references[det.marker_id] = LearnedReference(
                marker_id=det.marker_id, corners_arena=corners_arena)
            count += 1
        return count, f"{count} referência(s) ArUco aprendida(s)"

    def recover_extrinsics(
        self,
        detections: List[MarkerDetection],
        camera_matrix,
        dist_coeffs,
    ) -> Tuple[bool, str, int]:
        """Recover extrinsics from currently visible learned references."""
        if not self.data.learned_references:
            return False, "Nenhuma referência aprendida disponível", 0
        obj_pts = []
        img_pts = []
        used = 0
        for det in detections:
            ref = self.data.learned_references.get(det.marker_id)
            if ref is None:
                continue
            obj_pts.append(ref.corners_arena.reshape(4, 3))
            img_pts.append(det.corners.reshape(4, 2))
            used += 1
        if used < 1:
            return False, "Nenhuma referência aprendida visível", 0
        obj = np.vstack(obj_pts).astype(np.float32)
        img = np.vstack(img_pts).astype(np.float32)
        if obj.shape[0] < 4:
            return False, "Cantos de referência insuficientes", used
        ok, rvec, tvec = cv2.solvePnP(
            obj, img, camera_matrix, dist_coeffs,
            flags=cv2.SOLVEPNP_ITERATIVE)
        if not ok:
            return False, "solvePnP falhou na recuperação", used
        self.data.rvec = rvec
        self.data.tvec = tvec
        return True, f"Pose recuperada de {used} referência(s)", used

    def visible_reference_count(self, detections: List[MarkerDetection]) -> int:
        ids = {d.marker_id for d in detections}
        return len(ids & set(self.data.learned_references.keys()))
