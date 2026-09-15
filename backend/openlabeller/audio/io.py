from __future__ import annotations

import csv
import json
from pathlib import Path

import numpy as np

from openlabeller.core.project import Project
from openlabeller.core.storage import load_json, save_json_atomic
from openlabeller.audio.model import AudioItem

ANNOTATIONS_FILENAME = "annotations.json"
AUDIO_EXTENSIONS = {".wav", ".flac", ".ogg", ".mp3", ".m4a", ".aiff", ".aif"}
WAVEFORM_EXTENSIONS = {".wav", ".flac", ".ogg", ".aiff", ".aif"}


def list_audio_files(data_dir: Path) -> list[Path]:
    if not data_dir.is_dir():
        return []
    return sorted(
        p for p in data_dir.iterdir() if p.is_file() and p.suffix.lower() in AUDIO_EXTENSIONS
    )


def annotations_path(project: Project) -> Path:
    return project.output_dir / ANNOTATIONS_FILENAME


def load_annotations(project: Project) -> dict[str, list[str]]:
    path = annotations_path(project)
    if not path.exists():
        return {}
    return load_json(path)


def save_annotations(project: Project, items: list[AudioItem]) -> None:
    mapping = {item.id: item.labels for item in items if item.is_labeled}
    save_json_atomic(annotations_path(project), mapping)


def load_dataset(project: Project) -> list[AudioItem]:
    files = list_audio_files(project.data_dir)
    annotations = load_annotations(project)
    items = []
    for path in files:
        item_id = path.name
        items.append(AudioItem(id=item_id, path=path, labels=list(annotations.get(item_id, []))))
    return items


def compute_peaks(path: Path, num_buckets: int = 800) -> np.ndarray | None:
    """Return an array of shape (num_buckets, 2) with (min, max) amplitude
    per bucket, normalized to [-1, 1]. Returns None if the file couldn't be
    decoded for waveform display (e.g. some mp3 files without codec support)."""
    if path.suffix.lower() not in WAVEFORM_EXTENSIONS:
        return None
    try:
        import soundfile as sf

        data, _samplerate = sf.read(str(path), always_2d=True, dtype="float32")
    except Exception:
        return None

    mono = data.mean(axis=1)
    n = len(mono)
    if n == 0:
        return None

    bucket_size = max(1, n // num_buckets)
    usable = (n // bucket_size) * bucket_size
    trimmed = mono[:usable].reshape(-1, bucket_size)
    mins = trimmed.min(axis=1)
    maxs = trimmed.max(axis=1)
    return np.stack([mins, maxs], axis=1)


def export_csv(items: list[AudioItem], path: Path) -> None:
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["file", "label"])
        for item in items:
            writer.writerow([item.id, "|".join(item.labels)])


def export_jsonl(items: list[AudioItem], path: Path) -> None:
    with open(path, "w", encoding="utf-8") as f:
        for item in items:
            f.write(json.dumps({"file": item.id, "labels": item.labels}, ensure_ascii=False))
            f.write("\n")
