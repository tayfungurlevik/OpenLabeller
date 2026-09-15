from __future__ import annotations

import csv
import json
from pathlib import Path

from openlabeller.core.project import Project
from openlabeller.core.storage import load_json, save_json_atomic
from openlabeller.text.model import TextItem

ANNOTATIONS_FILENAME = "annotations.json"


def _find_tabular_file(data_dir: Path) -> Path | None:
    for ext in (".csv", ".jsonl"):
        candidates = sorted(
            p for p in data_dir.iterdir() if p.is_file() and p.suffix.lower() == ext
        )
        if candidates:
            return candidates[0]
    return None


def _load_txt_folder(data_dir: Path) -> list[TextItem]:
    files = sorted(p for p in data_dir.iterdir() if p.is_file() and p.suffix.lower() == ".txt")
    items = []
    for path in files:
        text = path.read_text(encoding="utf-8", errors="replace")
        items.append(TextItem(id=path.stem, text=text))
    return items


def _load_csv(path: Path) -> list[TextItem]:
    items = []
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames or []
        text_col = next((c for c in fieldnames if c.lower() == "text"), fieldnames[0] if fieldnames else None)
        id_col = next((c for c in fieldnames if c.lower() == "id"), None)
        for i, row in enumerate(reader):
            text = row.get(text_col, "") if text_col else ""
            item_id = row.get(id_col) if id_col else str(i)
            items.append(TextItem(id=item_id or str(i), text=text))
    return items


def _load_jsonl(path: Path) -> list[TextItem]:
    items = []
    with open(path, "r", encoding="utf-8") as f:
        for i, line in enumerate(f):
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            item_id = str(row.get("id", i))
            items.append(TextItem(id=item_id, text=row.get("text", "")))
    return items


def load_dataset(project: Project) -> list[TextItem]:
    tabular = _find_tabular_file(project.data_dir)
    if tabular is not None:
        items = _load_csv(tabular) if tabular.suffix.lower() == ".csv" else _load_jsonl(tabular)
    else:
        items = _load_txt_folder(project.data_dir)

    annotations = load_annotations(project)
    for item in items:
        if item.id in annotations:
            item.labels = list(annotations[item.id])
    return items


def annotations_path(project: Project) -> Path:
    return project.output_dir / ANNOTATIONS_FILENAME


def load_annotations(project: Project) -> dict[str, list[str]]:
    path = annotations_path(project)
    if not path.exists():
        return {}
    return load_json(path)


def save_annotations(project: Project, items: list[TextItem]) -> None:
    mapping = {item.id: item.labels for item in items if item.is_labeled}
    save_json_atomic(annotations_path(project), mapping)


def export_csv(items: list[TextItem], path: Path) -> None:
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["id", "text", "label"])
        for item in items:
            writer.writerow([item.id, item.text, "|".join(item.labels)])


def export_jsonl(items: list[TextItem], path: Path) -> None:
    with open(path, "w", encoding="utf-8") as f:
        for item in items:
            f.write(json.dumps({"id": item.id, "text": item.text, "labels": item.labels}, ensure_ascii=False))
            f.write("\n")
