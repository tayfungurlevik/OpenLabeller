from __future__ import annotations

from pathlib import Path

from openlabeller.core.labels import LabelClassSet
from openlabeller.core.storage import load_json, save_json_atomic
from openlabeller.image.shapes import Shape

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".gif", ".webp", ".tif", ".tiff"}
LABELME_VERSION = "5.5.0"


def list_images(data_dir: Path) -> list[Path]:
    if not data_dir.is_dir():
        return []
    return sorted(
        p for p in data_dir.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
    )


def annotation_path_for(image_path: Path, output_dir: Path) -> Path:
    return output_dir / f"{image_path.stem}.json"


def save_annotation(
    image_path: Path,
    shapes: list[Shape],
    output_dir: Path,
    image_width: int,
    image_height: int,
) -> None:
    data = {
        "version": LABELME_VERSION,
        "flags": {},
        "shapes": [s.to_dict() for s in shapes],
        "imagePath": image_path.name,
        "imageData": None,
        "imageHeight": image_height,
        "imageWidth": image_width,
    }
    save_json_atomic(annotation_path_for(image_path, output_dir), data)


def load_annotation(image_path: Path, output_dir: Path, labels: LabelClassSet) -> list[Shape]:
    path = annotation_path_for(image_path, output_dir)
    if not path.exists():
        return []
    data = load_json(path)
    shapes = []
    for shape_data in data.get("shapes", []):
        name = shape_data["label"]
        if labels.get(name) is None:
            labels.add(name)
        shapes.append(Shape.from_dict(shape_data))
    return shapes


def has_annotation(image_path: Path, output_dir: Path) -> bool:
    path = annotation_path_for(image_path, output_dir)
    if not path.exists():
        return False
    data = load_json(path)
    return bool(data.get("shapes"))
