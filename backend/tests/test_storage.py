from pathlib import Path

from openlabeller.core.storage import load_json, save_json_atomic


def test_save_and_load_roundtrip(tmp_path: Path):
    target = tmp_path / "nested" / "data.json"
    payload = {"a": 1, "b": [1, 2, 3], "c": {"d": "e"}}

    save_json_atomic(target, payload)

    assert target.exists()
    assert load_json(target) == payload


def test_save_overwrites_existing_file(tmp_path: Path):
    target = tmp_path / "data.json"
    save_json_atomic(target, {"v": 1})
    save_json_atomic(target, {"v": 2})

    assert load_json(target) == {"v": 2}
    # no leftover temp files
    assert list(tmp_path.iterdir()) == [target]
