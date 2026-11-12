"""Arena definition, zones and coordinate conventions.

Arena coordinate system (the canonical space everything is expressed in):

* origin at the top-left corner by default
* X increases to the right
* Y increases downwards
* units are millimetres

The origin corner and axis directions are configurable so the same code can
match a physical arena whose datum differs.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

import numpy as np

from .models import Zone


@dataclass
class ArenaConfig:
    """Physical arena description."""

    name: str = "Arena"
    width_mm: float = 2000.0
    height_mm: float = 1000.0
    origin: str = "top-left"  # top-left | top-right | bottom-left | bottom-right
    x_axis: str = "right"  # right | left
    y_axis: str = "down"  # down | up
    background_image: str = ""  # optional top-down image path
    zones: List[Zone] = field(default_factory=list)

    # ------------------------------------------------------------------
    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "width_mm": self.width_mm,
            "height_mm": self.height_mm,
            "origin": self.origin,
            "x_axis": self.x_axis,
            "y_axis": self.y_axis,
            "background_image": self.background_image,
            "zones": [z.to_dict() for z in self.zones],
        }

    @classmethod
    def from_dict(cls, d: dict) -> "ArenaConfig":
        zones = [Zone.from_dict(z) for z in (d or {}).get("zones", [])]
        return cls(
            name=d.get("name", "Arena"),
            width_mm=float(d.get("width_mm", 2000.0)),
            height_mm=float(d.get("height_mm", 1000.0)),
            origin=d.get("origin", "top-left"),
            x_axis=d.get("x_axis", "right"),
            y_axis=d.get("y_axis", "down"),
            background_image=d.get("background_image", ""),
            zones=zones,
        )

    # ------------------------------------------------------------------
    def has_background(self) -> bool:
        return bool(self.background_image) and os.path.exists(
            self.background_image)

    def contains_point(self, x_mm: float, y_mm: float) -> bool:
        """Whether a point lies within the arena rectangle."""
        return (0.0 <= x_mm <= self.width_mm and
                0.0 <= y_mm <= self.height_mm)

    # ------------------------------------------------------------------
    def zone_at(self, x_mm: float, y_mm: float) -> Optional[Zone]:
        """Return the first zone whose polygon contains the point."""
        for zone in self.zones:
            if point_in_polygon(x_mm, y_mm, zone.polygon):
                return zone
        return None

    def zones_at(self, x_mm: float, y_mm: float) -> List[Zone]:
        return [z for z in self.zones
                if point_in_polygon(x_mm, y_mm, z.polygon)]

    def get_zone(self, zone_id: str) -> Optional[Zone]:
        for z in self.zones:
            if z.id == zone_id:
                return z
        return None


def point_in_polygon(x: float, y: float,
                     polygon: List[Tuple[float, float]]) -> bool:
    """Ray-casting point-in-polygon test (works for any simple polygon)."""
    poly = np.asarray(polygon, dtype=float)
    if poly.shape[0] < 3:
        return False
    n = poly.shape[0]
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        intersect = ((yi > y) != (yj > y)) and (
            x < (xj - xi) * (y - yi) / ((yj - yi) + 1e-12) + xi)
        if intersect:
            inside = not inside
        j = i
    return inside
