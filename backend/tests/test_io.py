import json
from pathlib import Path

from PIL import Image

from openlabeller.audio import io as audio_io
from openlabeller.audio.model import AudioItem
from openlabeller.core.project import Project, TaskType
from openlabeller.image import exporters
from openlabeller.image import io as image_io
from openlabeller.text import io as text_io


def _make_image(path: Path, size=(100, 80)) -> None:
    Image.new("RGB", size, color=(10, 20, 30)).save(path)


def _rectangle_annotation(label="cat"):
    return {
        "version": "5.5.0",
        "flags": {},
        "shapes": [
            {
                "label": label,
                "points": [[10.0, 10.0], [50.0, 40.0]],
                "group_id": None,
                "shape_type": "rectangle",
                "flags": {},
            }
        ],
        "imagePath": "sample.png",
        "imageData": None,
        "imageHeight": 80,
        "imageWidth": 100,
    }


def test_image_list_images_filters_by_extension(tmp_path: Path):
    _make_image(tmp_path / "a.png")
    _make_image(tmp_path / "b.jpg")
    (tmp_path / "notes.txt").write_text("not an image")

    images = image_io.list_images(tmp_path)

    assert [p.name for p in images] == ["a.png", "b.jpg"]


def test_image_save_load_roundtrip_registers_new_labels(tmp_path: Path):
    from openlabeller.core.labels import LabelClassSet

    image_path = tmp_path / "sample.png"
    _make_image(image_path)
    ann_path = image_io.annotation_path_for(image_path, tmp_path)
    ann_path.write_text(json.dumps(_rectangle_annotation()), encoding="utf-8")

    labels = LabelClassSet()
    shapes = image_io.load_annotation(image_path, tmp_path, labels)

    assert len(shapes) == 1
    assert shapes[0].label == "cat"
    assert shapes[0].shape_type == "rectangle"
    assert labels.get("cat") is not None, "unknown label should be auto-registered"
    assert image_io.has_annotation(image_path, tmp_path) is True


def test_export_coco_yolo_voc(tmp_path: Path):
    image_path = tmp_path / "sample.png"
    _make_image(image_path)
    ann_path = image_io.annotation_path_for(image_path, tmp_path)
    ann_path.write_text(json.dumps(_rectangle_annotation()), encoding="utf-8")

    project = Project.create(TaskType.IMAGE, data_dir=tmp_path, name="Export Test")
    project.labels.add("cat")
    project.save()

    coco_path = tmp_path / "coco.json"
    exporters.export_coco(project, coco_path)
    coco = json.loads(coco_path.read_text(encoding="utf-8"))
    assert len(coco["images"]) == 1
    assert coco["annotations"][0]["bbox"] == [10.0, 10.0, 40.0, 30.0]
    assert coco["categories"][0]["name"] == "cat"

    yolo_dir = tmp_path / "yolo"
    exporters.export_yolo(project, yolo_dir)
    classes = (yolo_dir / "classes.txt").read_text(encoding="utf-8").splitlines()
    assert classes == ["cat"]
    label_lines = (yolo_dir / "sample.txt").read_text(encoding="utf-8").splitlines()
    assert len(label_lines) == 1
    class_id, cx, cy, w, h = label_lines[0].split()
    assert class_id == "0"
    assert 0 < float(cx) < 1 and 0 < float(cy) < 1

    voc_dir = tmp_path / "voc"
    exporters.export_pascal_voc(project, voc_dir)
    xml_text = (voc_dir / "sample.xml").read_text(encoding="utf-8")
    assert "<name>cat</name>" in xml_text
    assert "<xmin>10</xmin>" in xml_text


def test_text_load_dataset_from_txt_folder_and_annotations(tmp_path: Path):
    (tmp_path / "a.txt").write_text("hello", encoding="utf-8")
    (tmp_path / "b.txt").write_text("world", encoding="utf-8")

    project = Project.create(TaskType.TEXT, data_dir=tmp_path, name="Text Test")
    items = text_io.load_dataset(project)
    assert {i.id for i in items} == {"a", "b"}

    items[0].labels = ["greeting"]
    text_io.save_annotations(project, items)

    reloaded = text_io.load_dataset(project)
    reloaded_by_id = {i.id: i.labels for i in reloaded}
    assert reloaded_by_id["a"] == ["greeting"]
    assert reloaded_by_id["b"] == []


def test_text_load_dataset_from_csv(tmp_path: Path):
    (tmp_path / "data.csv").write_text("id,text\nrow1,First document\nrow2,Second document\n", encoding="utf-8")

    project = Project.create(TaskType.TEXT, data_dir=tmp_path, name="CSV Test")
    items = text_io.load_dataset(project)

    assert [i.id for i in items] == ["row1", "row2"]
    assert items[0].text == "First document"


def test_audio_list_and_annotations_roundtrip(tmp_path: Path):
    (tmp_path / "clip1.wav").write_bytes(b"RIFF....WAVEfmt ")
    (tmp_path / "clip2.mp3").write_bytes(b"ID3")
    (tmp_path / "readme.txt").write_text("not audio")

    project = Project.create(TaskType.AUDIO, data_dir=tmp_path, name="Audio Test")
    items = audio_io.load_dataset(project)
    assert {i.id for i in items} == {"clip1.wav", "clip2.mp3"}

    items[0].labels = ["speech"]
    audio_io.save_annotations(project, items)

    reloaded = audio_io.load_dataset(project)
    reloaded_by_id = {i.id: i.labels for i in reloaded}
    assert reloaded_by_id["clip1.wav"] == ["speech"]
    assert reloaded_by_id["clip2.mp3"] == []


def test_audio_convert_to_wav_and_carry_over_annotation(tmp_path: Path):
    import numpy as np
    import soundfile as sf

    sr = 16000
    t = np.linspace(0, 0.3, int(sr * 0.3), endpoint=False)
    wave = (0.2 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
    mp3_path = tmp_path / "clip.mp3"
    sf.write(str(mp3_path), wave, sr, format="MP3")

    wav_path = audio_io.convert_to_wav(mp3_path)
    assert wav_path == tmp_path / "clip.wav"
    assert wav_path.is_file()
    data, samplerate = sf.read(str(wav_path))
    assert samplerate == sr
    assert len(data) > 0

    project = Project.create(TaskType.AUDIO, data_dir=tmp_path, name="Audio Convert Test")
    audio_io.save_annotations(project, [AudioItem(id="clip.mp3", path=mp3_path, labels=["speech"])])
    audio_io.carry_over_annotation(project, "clip.mp3", "clip.wav")
    annotations = audio_io.load_annotations(project)
    assert annotations["clip.wav"] == ["speech"]
