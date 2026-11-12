import sys
import os
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from robot_heatmap.field_config import (
    create_default,
    load_yaml,
    resolve_image_path,
    save_yaml,
    validate,
    FieldConfig,
)


def test_create_default_structure():
    config = create_default("arena_test", "Arena Teste", "assets/arenas/test.png")
    assert "field" in config
    assert config["field"]["id"] == "arena_test"
    assert config["field"]["name"] == "Arena Teste"
    assert config["field"]["unit"] == "normalized"
    assert config["field"]["width"] == 1000
    assert config["field"]["height"] == 1000
    assert "reference_points" in config
    assert "zones" in config


def test_create_default_accepts_real_dimensions():
    config = create_default(
        "decode",
        "Decode",
        "assets/arenas/decode_topdown.png",
        unit="cm",
        width=365.76,
        height=365.76,
    )
    assert config["field"]["unit"] == "cm"
    assert config["field"]["width"] == 365.76
    assert config["field"]["height"] == 365.76


def test_validate_valid():
    config = create_default()
    assert validate(config) is True


def test_validate_missing_field_key():
    config = create_default()
    del config["field"]["id"]
    assert validate(config) is False


def test_validate_missing_field_section():
    assert validate({}) is False


def test_save_and_load_roundtrip():
    config = create_default("roundtrip", "Roundtrip Test", "img.png")
    config["zones"]["center"] = {
        "label": "Centro",
        "type": "polygon",
        "points": [[400, 400], [600, 400], [600, 600], [400, 600]],
    }
    config["reference_points"]["top_left"] = {
        "label": "Canto superior esquerdo",
        "point": [0, 0],
    }
    with tempfile.NamedTemporaryFile(suffix=".yaml", delete=False) as tmp:
        path = tmp.name
    try:
        save_yaml(config, path)
        loaded = load_yaml(path)
        assert loaded["field"]["id"] == "roundtrip"
        assert loaded["field"]["name"] == "Roundtrip Test"
        assert "center" in loaded["zones"]
        assert loaded["zones"]["center"]["points"][0] == [400, 400]
        assert "top_left" in loaded["reference_points"]
        assert loaded["reference_points"]["top_left"]["point"] == [0, 0]
    finally:
        os.unlink(path)


def test_field_config_class_save_load():
    fc = FieldConfig("test_id", "Test Name", "some_image.png")
    fc.add_zone("zone1", "Zona Um", [[0, 0], [100, 0], [100, 100]])
    fc.add_reference_point("ref1", "Ref Um", [500, 500])
    assert fc.is_valid()
    assert "zone1" in fc.zones
    assert "ref1" in fc.reference_points

    with tempfile.NamedTemporaryFile(suffix=".yaml", delete=False) as tmp:
        path = tmp.name
    try:
        fc.save(path)
        fc2 = FieldConfig.from_file(path)
        assert fc2.field["id"] == "test_id"
        assert "zone1" in fc2.zones
        assert "ref1" in fc2.reference_points
    finally:
        os.unlink(path)


def test_resolve_image_path_searches_yaml_ancestors():
    with tempfile.TemporaryDirectory() as tmpdir:
        project = os.path.join(tmpdir, "robot-heatmap-scout")
        image_dir = os.path.join(project, "assets", "arenas")
        yaml_dir = os.path.join(project, "configs", "fields")
        os.makedirs(image_dir)
        os.makedirs(yaml_dir)
        image_path = os.path.join(image_dir, "decode_topdown.png")
        yaml_path = os.path.join(yaml_dir, "decode.yaml")
        with open(image_path, "wb") as f:
            f.write(b"fake")
        resolved = resolve_image_path(yaml_path, ".\\assets\\arenas\\decode_topdown.png", cwd=tmpdir)
        assert resolved == image_path


def test_field_config_from_file_invalid_raises():
    with tempfile.NamedTemporaryFile(suffix=".yaml", delete=False, mode="w") as tmp:
        tmp.write("not_a_field: true\n")
        path = tmp.name
    try:
        try:
            FieldConfig.from_file(path)
            assert False, "Deveria ter levantado ValueError"
        except ValueError:
            pass
    finally:
        os.unlink(path)
