from pathlib import Path

import numpy as np
import soundfile as sf
from fastapi.testclient import TestClient
from PIL import Image

from openlabeller.server import app

client = TestClient(app)


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_project_lifecycle_and_labels(tmp_path: Path):
    data_dir = tmp_path / "proj"
    data_dir.mkdir()

    resp = client.post(
        "/api/projects", json={"task_type": "text", "data_dir": str(data_dir), "name": "My Project"}
    )
    assert resp.status_code == 200
    project = resp.json()
    assert project["task_type"] == "text"
    assert project["name"] == "My Project"
    assert project["labels"] == []

    resp = client.get("/api/projects", params={"dir": project["output_dir"]})
    assert resp.status_code == 200
    assert resp.json()["name"] == "My Project"

    resp = client.post("/api/projects/labels", json={"dir": project["output_dir"], "name": "cat"})
    assert resp.status_code == 200
    labels = resp.json()["labels"]
    assert labels[0]["name"] == "cat"
    assert labels[0]["shortcut"] == "1"

    resp = client.post("/api/projects/labels", json={"dir": project["output_dir"], "name": "cat"})
    assert resp.status_code == 400

    resp = client.delete("/api/projects/labels", params={"dir": project["output_dir"], "name": "cat"})
    assert resp.status_code == 200
    assert resp.json()["labels"] == []

    resp = client.patch("/api/projects", json={"dir": project["output_dir"], "multi_label": True})
    assert resp.status_code == 200
    assert resp.json()["multi_label"] is True


def test_image_annotation_and_export(tmp_path: Path):
    data_dir = tmp_path / "images"
    data_dir.mkdir()
    Image.new("RGB", (100, 80), color=(1, 2, 3)).save(data_dir / "sample.png")

    project = client.post(
        "/api/projects", json={"task_type": "image", "data_dir": str(data_dir), "name": "Img"}
    ).json()
    out_dir = project["output_dir"]

    resp = client.get("/api/image/files", params={"dir": out_dir})
    assert resp.status_code == 200
    files = resp.json()
    assert files == [{"name": "sample.png", "labeled": False}]

    resp = client.get("/api/image/file", params={"dir": out_dir, "name": "sample.png"})
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/png"

    resp = client.get("/api/image/annotation", params={"dir": out_dir, "name": "sample.png"})
    assert resp.status_code == 200
    assert resp.json() == {"shapes": [], "width": 100, "height": 80}

    shapes_payload = {
        "shapes": [
            {
                "label": "cat",
                "points": [[10, 10], [50, 40]],
                "group_id": None,
                "shape_type": "rectangle",
                "flags": {},
            }
        ]
    }
    resp = client.put(
        "/api/image/annotation", params={"dir": out_dir, "name": "sample.png"}, json=shapes_payload
    )
    assert resp.status_code == 200

    resp = client.get("/api/image/files", params={"dir": out_dir})
    assert resp.json() == [{"name": "sample.png", "labeled": True}]

    resp = client.get("/api/image/annotation", params={"dir": out_dir, "name": "sample.png"})
    data = resp.json()
    assert data["shapes"][0]["label"] == "cat"
    assert data["shapes"][0]["points"] == [[10, 10], [50, 40]]

    # unknown label from a hand-edited annotation should get auto-registered
    resp = client.get("/api/projects", params={"dir": out_dir})
    assert resp.json()["labels"][0]["name"] == "cat"

    coco_path = tmp_path / "coco.json"
    resp = client.post("/api/image/export/coco", json={"dir": out_dir, "path": str(coco_path)})
    assert resp.status_code == 200
    assert coco_path.exists()

    yolo_dir = tmp_path / "yolo"
    resp = client.post("/api/image/export/yolo", json={"dir": out_dir, "path": str(yolo_dir)})
    assert resp.status_code == 200
    assert (yolo_dir / "classes.txt").exists()


def test_text_items_and_export(tmp_path: Path):
    data_dir = tmp_path / "texts"
    data_dir.mkdir()
    (data_dir / "a.txt").write_text("hello there", encoding="utf-8")

    project = client.post(
        "/api/projects", json={"task_type": "text", "data_dir": str(data_dir), "name": "Txt"}
    ).json()
    out_dir = project["output_dir"]

    resp = client.get("/api/text/items", params={"dir": out_dir})
    items = resp.json()
    assert items == [{"id": "a", "text": "hello there", "labels": []}]

    resp = client.put(
        "/api/text/item", params={"dir": out_dir, "id": "a"}, json={"labels": ["greeting"]}
    )
    assert resp.status_code == 200

    resp = client.get("/api/text/items", params={"dir": out_dir})
    assert resp.json()[0]["labels"] == ["greeting"]

    csv_path = tmp_path / "out.csv"
    resp = client.post(
        "/api/text/export", params={"dir": out_dir, "format": "csv", "path": str(csv_path)}
    )
    assert resp.status_code == 200
    assert "greeting" in csv_path.read_text(encoding="utf-8")


def test_audio_items_peaks_and_export(tmp_path: Path):
    data_dir = tmp_path / "audio"
    data_dir.mkdir()
    sr = 16000
    t = np.linspace(0, 0.5, sr // 2, endpoint=False)
    wave = 0.2 * np.sin(2 * np.pi * 440 * t).astype(np.float32)
    sf.write(str(data_dir / "clip.wav"), wave, sr)

    project = client.post(
        "/api/projects", json={"task_type": "audio", "data_dir": str(data_dir), "name": "Aud"}
    ).json()
    out_dir = project["output_dir"]

    resp = client.get("/api/audio/files", params={"dir": out_dir})
    assert resp.json() == [{"id": "clip.wav", "labels": []}]

    resp = client.get("/api/audio/file", params={"dir": out_dir, "name": "clip.wav"})
    assert resp.status_code == 200

    resp = client.get("/api/audio/peaks", params={"dir": out_dir, "name": "clip.wav"})
    peaks = resp.json()["peaks"]
    assert peaks is not None and len(peaks) > 0

    resp = client.put(
        "/api/audio/item", params={"dir": out_dir, "id": "clip.wav"}, json={"labels": ["music"]}
    )
    assert resp.status_code == 200

    resp = client.get("/api/audio/files", params={"dir": out_dir})
    assert resp.json()[0]["labels"] == ["music"]


def test_audio_convert_mp3_to_wav_carries_over_labels(tmp_path: Path):
    data_dir = tmp_path / "audio"
    data_dir.mkdir()
    sr = 16000
    t = np.linspace(0, 0.3, int(sr * 0.3), endpoint=False)
    wave = (0.2 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
    sf.write(str(data_dir / "clip.mp3"), wave, sr, format="MP3")

    project = client.post(
        "/api/projects", json={"task_type": "audio", "data_dir": str(data_dir), "name": "Aud"}
    ).json()
    out_dir = project["output_dir"]

    resp = client.put(
        "/api/audio/item", params={"dir": out_dir, "id": "clip.mp3"}, json={"labels": ["music"]}
    )
    assert resp.status_code == 200

    resp = client.post("/api/audio/convert", json={"dir": out_dir})
    assert resp.status_code == 200
    body = resp.json()
    assert body["converted"] == ["clip.wav"]
    assert body["errors"] == []
    assert (data_dir / "clip.wav").is_file()
    assert (data_dir / "clip.mp3").is_file()  # original is kept

    resp = client.get("/api/audio/files", params={"dir": out_dir})
    files = {f["id"]: f["labels"] for f in resp.json()}
    assert files["clip.wav"] == ["music"]
    assert files["clip.mp3"] == ["music"]

    # a second run is a no-op since clip.wav already exists
    resp = client.post("/api/audio/convert", json={"dir": out_dir})
    assert resp.json()["converted"] == []
    assert resp.json()["skipped"] == ["clip.wav"]
