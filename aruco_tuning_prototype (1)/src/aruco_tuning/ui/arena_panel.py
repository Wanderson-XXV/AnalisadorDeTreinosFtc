"""Virtual top-down arena view (custom painted)."""

from __future__ import annotations

import math
import os
from typing import List, Optional

from PySide6.QtCore import QPointF, QRectF, Qt
from PySide6.QtGui import (QBrush, QColor, QFont, QImage, QPainter, QPen,
                           QPixmap, QPolygonF)
from PySide6.QtWidgets import QWidget

from ..arena import ArenaConfig
from ..arena_registration import RegistrationData
from ..models import RobotConfig, RobotPose


class ArenaPanel(QWidget):
    """Draws the arena rectangle, zones, references, robot and trajectory."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setMinimumSize(400, 300)
        self.arena = ArenaConfig()
        self.robot_config = RobotConfig()
        self.registration: Optional[RegistrationData] = None
        self.pose: Optional[RobotPose] = None
        self.trajectory: List[RobotPose] = []
        self._bg_pixmap: Optional[QPixmap] = None
        self._bg_path = ""
        self.setStyleSheet("background:#101418;")

    # ------------------------------------------------------------------
    def set_arena(self, arena: ArenaConfig):
        self.arena = arena
        self._load_background()
        self.update()

    def set_robot_config(self, cfg: RobotConfig):
        self.robot_config = cfg
        self.update()

    def set_registration(self, reg: Optional[RegistrationData]):
        self.registration = reg
        self.update()

    def set_pose(self, pose: Optional[RobotPose]):
        self.pose = pose
        self.update()

    def set_trajectory(self, trajectory: List[RobotPose]):
        self.trajectory = trajectory
        self.update()

    def clear_trajectory(self):
        self.trajectory = []
        self.update()

    # ------------------------------------------------------------------
    def _load_background(self):
        if self.arena.has_background() and self.arena.background_image != self._bg_path:
            img = QImage(self.arena.background_image)
            self._bg_pixmap = QPixmap.fromImage(img) if not img.isNull() else None
            self._bg_path = self.arena.background_image
        elif not self.arena.background_image:
            self._bg_pixmap = None
            self._bg_path = ""

    # ------------------------------------------------------------------
    def _compute_transform(self):
        """Return (scale, offset_x, offset_y) mapping arena mm -> widget px."""
        margin = 24
        aw = max(1.0, self.arena.width_mm)
        ah = max(1.0, self.arena.height_mm)
        avail_w = self.width() - 2 * margin
        avail_h = self.height() - 2 * margin
        scale = min(avail_w / aw, avail_h / ah)
        draw_w = aw * scale
        draw_h = ah * scale
        ox = (self.width() - draw_w) / 2.0
        oy = (self.height() - draw_h) / 2.0
        return scale, ox, oy

    def _to_px(self, x_mm, y_mm, scale, ox, oy):
        return QPointF(ox + x_mm * scale, oy + y_mm * scale)

    # ------------------------------------------------------------------
    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        painter.fillRect(self.rect(), QColor("#101418"))

        scale, ox, oy = self._compute_transform()
        aw = self.arena.width_mm * scale
        ah = self.arena.height_mm * scale
        arena_rect = QRectF(ox, oy, aw, ah)

        # background image or plain floor
        if self._bg_pixmap is not None:
            painter.drawPixmap(arena_rect, self._bg_pixmap,
                               QRectF(self._bg_pixmap.rect()))
        else:
            painter.fillRect(arena_rect, QColor("#1b2733"))

        # grid every 250 mm
        self._draw_grid(painter, scale, ox, oy)

        # arena border
        painter.setPen(QPen(QColor("#4aa3df"), 2))
        painter.setBrush(Qt.NoBrush)
        painter.drawRect(arena_rect)

        # zones
        self._draw_zones(painter, scale, ox, oy)
        # learned references
        self._draw_references(painter, scale, ox, oy)
        # trajectory
        self._draw_trajectory(painter, scale, ox, oy)
        # robot
        self._draw_robot(painter, scale, ox, oy)
        # origin marker + axes labels
        self._draw_axes_labels(painter, scale, ox, oy)
        painter.end()

    # ------------------------------------------------------------------
    def _draw_grid(self, painter, scale, ox, oy):
        painter.setPen(QPen(QColor(255, 255, 255, 20), 1))
        step = 250.0
        x = 0.0
        while x <= self.arena.width_mm + 1:
            p1 = self._to_px(x, 0, scale, ox, oy)
            p2 = self._to_px(x, self.arena.height_mm, scale, ox, oy)
            painter.drawLine(p1, p2)
            x += step
        y = 0.0
        while y <= self.arena.height_mm + 1:
            p1 = self._to_px(0, y, scale, ox, oy)
            p2 = self._to_px(self.arena.width_mm, y, scale, ox, oy)
            painter.drawLine(p1, p2)
            y += step

    def _draw_zones(self, painter, scale, ox, oy):
        for zone in self.arena.zones:
            if len(zone.polygon) < 3:
                continue
            color = QColor(zone.color)
            poly = QPolygonF([self._to_px(px, py, scale, ox, oy)
                              for px, py in zone.polygon])
            fill = QColor(color)
            fill.setAlpha(70)
            painter.setBrush(QBrush(fill))
            painter.setPen(QPen(color, 2))
            painter.drawPolygon(poly)
            # label at centroid
            cx = sum(p.x() for p in poly) / poly.count()
            cy = sum(p.y() for p in poly) / poly.count()
            painter.setPen(QPen(QColor("#ecf0f1")))
            painter.drawText(QPointF(cx, cy), zone.name or zone.id)

    def _draw_references(self, painter, scale, ox, oy):
        if self.registration is None:
            return
        painter.setPen(QPen(QColor("#f1c40f"), 2))
        painter.setBrush(QBrush(QColor(241, 196, 15, 60)))
        for ref in self.registration.learned_references.values():
            corners = ref.corners_arena
            poly = QPolygonF([self._to_px(c[0], c[1], scale, ox, oy)
                              for c in corners])
            painter.drawPolygon(poly)
            cx = sum(c[0] for c in corners) / 4
            cy = sum(c[1] for c in corners) / 4
            painter.setPen(QPen(QColor("#f1c40f")))
            painter.drawText(self._to_px(cx, cy, scale, ox, oy),
                             f"#{ref.marker_id}")
            painter.setPen(QPen(QColor("#f1c40f"), 2))

    def _draw_trajectory(self, painter, scale, ox, oy):
        pts = [(p.x_mm, p.y_mm) for p in self.trajectory if p.marker_visible]
        if len(pts) < 2:
            return
        painter.setPen(QPen(QColor("#2ecc71"), 2))
        for i in range(1, len(pts)):
            painter.drawLine(
                self._to_px(*pts[i - 1], scale=scale, ox=ox, oy=oy),
                self._to_px(*pts[i], scale=scale, ox=ox, oy=oy))
        # start marker
        painter.setBrush(QBrush(QColor("#2ecc71")))
        painter.setPen(Qt.NoPen)
        s = self._to_px(*pts[0], scale=scale, ox=ox, oy=oy)
        painter.drawEllipse(s, 5, 5)

    def _draw_robot(self, painter, scale, ox, oy):
        if self.pose is None or not self.pose.marker_visible:
            return
        cx, cy = self.pose.x_mm, self.pose.y_mm
        heading = self.pose.heading_deg
        rw = self.robot_config.robot_width_mm
        rl = self.robot_config.robot_length_mm
        # rectangle corners in robot frame (x forward, y right)
        corners = [(rl / 2, -rw / 2), (rl / 2, rw / 2),
                   (-rl / 2, rw / 2), (-rl / 2, -rw / 2)]
        ca = math.cos(math.radians(heading))
        sa = math.sin(math.radians(heading))
        poly = QPolygonF()
        for fx, ry in corners:
            wx = cx + fx * ca - ry * sa
            wy = cy + fx * sa + ry * ca
            poly.append(self._to_px(wx, wy, scale, ox, oy))
        conf = self.pose.pose_confidence
        col = QColor("#e67e22") if conf < 0.5 else QColor("#e74c3c")
        painter.setBrush(QBrush(QColor(col.red(), col.green(), col.blue(), 120)))
        painter.setPen(QPen(col, 2))
        painter.drawPolygon(poly)
        # heading arrow
        nose = self._to_px(cx + (rl / 2 + 40) * ca, cy + (rl / 2 + 40) * sa,
                           scale, ox, oy)
        centre = self._to_px(cx, cy, scale, ox, oy)
        painter.setPen(QPen(QColor("#f39c12"), 3))
        painter.drawLine(centre, nose)
        # info text
        painter.setPen(QPen(QColor("#ecf0f1")))
        painter.setFont(QFont("Sans", 9))
        painter.drawText(
            QPointF(centre.x() + 8, centre.y() - 8),
            f"X={cx:.0f} Y={cy:.0f} θ={heading:.1f}°")

    def _draw_axes_labels(self, painter, scale, ox, oy):
        painter.setPen(QPen(QColor("#95a5a6")))
        painter.setFont(QFont("Sans", 8))
        origin = self._to_px(0, 0, scale, ox, oy)
        painter.setBrush(QBrush(QColor("#e74c3c")))
        painter.drawEllipse(origin, 4, 4)
        painter.drawText(QPointF(origin.x() + 6, origin.y() + 14),
                         "(0,0)  X→  Y↓")
