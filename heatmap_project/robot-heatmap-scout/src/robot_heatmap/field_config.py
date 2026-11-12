import yaml
import os
from pathlib import Path


DEFAULT_FIELD = {
    "field": {
        "id": "arena",
        "name": "Arena",
        "image": "",
        "unit": "normalized",
        "width": 1000,
        "height": 1000,
        "coordinate_system": {
            "origin": "top_left",
            "x_axis": "right",
            "y_axis": "down",
        },
    },
    "reference_points": {},
    "zones": {},
}

REQUIRED_FIELD_KEYS = {"id", "name", "unit", "width", "height"}


def create_default(
    field_id: str = "arena",
    name: str = "Arena",
    image: str = "",
    unit: str = "normalized",
    width: float = 1000,
    height: float = 1000,
) -> dict:
    config = {
        "field": {
            "id": field_id,
            "name": name,
            "image": image,
            "unit": unit,
            "width": width,
            "height": height,
            "coordinate_system": {
                "origin": "top_left",
                "x_axis": "right",
                "y_axis": "down",
            },
        },
        "reference_points": {},
        "zones": {},
    }
    return config


def load_yaml(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def save_yaml(config: dict, path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True) if os.path.dirname(path) else None
    with open(path, "w", encoding="utf-8") as f:
        yaml.dump(config, f, allow_unicode=True, default_flow_style=False, sort_keys=False)


def validate(config: dict) -> bool:
    if "field" not in config:
        return False
    field = config["field"]
    return REQUIRED_FIELD_KEYS.issubset(field.keys())


def resolve_image_path(config_path: str, image_path: str, cwd: str = None) -> str:
    if not image_path:
        raise ValueError("YAML nao possui field.image")

    image = Path(image_path)
    if image.is_absolute() and image.is_file():
        return str(image)

    search_roots = []
    if cwd:
        search_roots.append(Path(cwd))

    config_file = Path(config_path)
    if config_file.parent:
        search_roots.extend(config_file.resolve().parents)

    for root in search_roots:
        candidate = root / image_path
        if candidate.is_file():
            return str(candidate)

    raise FileNotFoundError(f"Imagem referenciada no YAML nao encontrada: {image_path}")


class FieldConfig:
    def __init__(
        self,
        field_id: str = "arena",
        name: str = "Arena",
        image: str = "",
        unit: str = "normalized",
        width: float = 1000,
        height: float = 1000,
    ):
        self._data = create_default(field_id, name, image, unit, width, height)

    @classmethod
    def from_file(cls, path: str) -> "FieldConfig":
        data = load_yaml(path)
        if not validate(data):
            raise ValueError(f"YAML invalido: campos obrigatorios ausentes em {path}")
        instance = cls.__new__(cls)
        instance._data = data
        return instance

    def save(self, path: str) -> None:
        save_yaml(self._data, path)

    def is_valid(self) -> bool:
        return validate(self._data)

    @property
    def data(self) -> dict:
        return self._data

    @property
    def field(self) -> dict:
        return self._data["field"]

    @property
    def zones(self) -> dict:
        return self._data.get("zones", {})

    @property
    def reference_points(self) -> dict:
        return self._data.get("reference_points", {})

    def add_zone(self, zone_id: str, label: str, points: list) -> None:
        self._data.setdefault("zones", {})[zone_id] = {
            "label": label,
            "type": "polygon",
            "points": points,
        }

    def add_reference_point(self, point_id: str, label: str, point: list) -> None:
        self._data.setdefault("reference_points", {})[point_id] = {
            "label": label,
            "point": point,
        }
