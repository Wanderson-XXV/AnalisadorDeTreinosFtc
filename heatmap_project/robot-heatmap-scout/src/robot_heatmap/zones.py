ALLOWED_ZONE_ROLES = {
    "collect",
    "score",
    "transit",
    "base",
    "traffic",
    "risk",
    "neutral",
    "unknown",
}

ALLOWED_ALLIANCES = {"red", "blue", "neutral"}

DEFAULT_ZONE_VISUAL = {
    "color": "neutral",
    "opacity": 0.14,
    "border": True,
    "label": True,
}

DEFAULT_ZONE_ANALYSIS = {
    "count_time": True,
    "detect_stops": True,
    "important": False,
}


def is_valid_polygon(points: list) -> bool:
    if not isinstance(points, list):
        return False
    if len(points) < 3:
        return False
    for pt in points:
        if not (isinstance(pt, (list, tuple)) and len(pt) == 2):
            return False
    return True


def normalize_zone(zone_id: str, label: str, points: list) -> dict:
    return {
        zone_id: {
            "label": label,
            "type": "polygon",
            "points": [[int(p[0]), int(p[1])] for p in points],
        }
    }


def normalize_field_zones(zones: dict | list | None) -> list[dict]:
    if not zones:
        return []
    if isinstance(zones, list):
        items = [
            (str(zone.get("id", f"zone_{index + 1}")), zone)
            for index, zone in enumerate(zones)
        ]
    else:
        items = list(zones.items())

    normalized = []
    for zone_id, zone in items:
        points = zone.get("points", zone.get("polygon", []))
        if not is_valid_polygon(points):
            continue
        role = zone.get("role", "unknown")
        alliance = zone.get("alliance", "neutral")
        visual = {**DEFAULT_ZONE_VISUAL, **(zone.get("visual") or {})}
        analysis = {**DEFAULT_ZONE_ANALYSIS, **(zone.get("analysis") or {})}
        if role not in ALLOWED_ZONE_ROLES:
            role = "unknown"
        if alliance not in ALLOWED_ALLIANCES:
            alliance = "neutral"
        if visual.get("color") not in ALLOWED_ZONE_ROLES and visual.get("color") not in {
            "red_alliance",
            "blue_alliance",
        }:
            visual["color"] = role if role != "unknown" else "neutral"

        normalized.append(
            {
                "id": str(zone_id),
                "label": str(zone.get("label", zone_id)),
                "type": "polygon",
                "role": role,
                "alliance": alliance,
                "polygon": [[float(point[0]), float(point[1])] for point in points],
                "visual": visual,
                "analysis": analysis,
            }
        )
    return normalized


def point_in_polygon(x: float, y: float, polygon: list[list[float]]) -> bool:
    inside = False
    point_count = len(polygon)
    if point_count < 3:
        return False

    j = point_count - 1
    for i in range(point_count):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if _point_on_segment(x, y, xi, yi, xj, yj):
            return True
        intersects = ((yi > y) != (yj > y)) and (
            x <= (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi
        )
        if intersects:
            inside = not inside
        j = i
    return inside


def _point_on_segment(
    px: float,
    py: float,
    ax: float,
    ay: float,
    bx: float,
    by: float,
    epsilon: float = 1e-9,
) -> bool:
    cross = (py - ay) * (bx - ax) - (px - ax) * (by - ay)
    if abs(cross) > epsilon:
        return False
    dot = (px - ax) * (bx - ax) + (py - ay) * (by - ay)
    if dot < -epsilon:
        return False
    squared_length = (bx - ax) ** 2 + (by - ay) ** 2
    return dot <= squared_length + epsilon


class Zones:
    @staticmethod
    def is_valid(points: list) -> bool:
        return is_valid_polygon(points)

    @staticmethod
    def normalize(zone_id: str, label: str, points: list) -> dict:
        return normalize_zone(zone_id, label, points)
