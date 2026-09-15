from __future__ import annotations

import json
import math
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image

from openlabeller.core.project import Project
from openlabeller.core.storage import load_json
from openlabeller.image import io as image_io


def _raw_shapes(image_path: Path, output_dir: Path) -> list[dict]:
    path = image_io.annotation_path_for(image_path, output_dir)
    if not path.exists():
        return []
    return load_json(path).get("shapes", [])


def _shape_bbox(shape_data: dict) -> tuple[float, float, float, float]:
    """Axis-aligned (x, y, width, height) bounding box for any shape type.

    YOLO/Pascal VOC are bounding-box formats, so non-rectangular shapes
    (polygon, circle, line, point) are exported as their enclosing box.
    """
    shape_type = shape_data["shape_type"]
    points = shape_data["points"]
    if shape_type == "circle":
        (cx, cy), (rx, ry) = points
        r = math.hypot(rx - cx, ry - cy)
        return cx - r, cy - r, 2 * r, 2 * r
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
    return x0, y0, max(x1 - x0, 1e-6), max(y1 - y0, 1e-6)


def export_coco(project: Project, output_path: Path) -> None:
    images = image_io.list_images(project.data_dir)
    categories = [{"id": i + 1, "name": label.name} for i, label in enumerate(project.labels)]
    category_ids = {c["name"]: c["id"] for c in categories}

    coco_images = []
    coco_annotations = []
    ann_id = 1
    for img_id, path in enumerate(images, start=1):
        with Image.open(path) as im:
            width, height = im.size
        coco_images.append({"id": img_id, "file_name": path.name, "width": width, "height": height})

        for shape_data in _raw_shapes(path, project.output_dir):
            category_id = category_ids.get(shape_data["label"])
            if category_id is None:
                continue
            x, y, w, h = _shape_bbox(shape_data)
            annotation = {
                "id": ann_id,
                "image_id": img_id,
                "category_id": category_id,
                "bbox": [x, y, w, h],
                "area": w * h,
                "iscrowd": 0,
            }
            if shape_data["shape_type"] == "polygon":
                annotation["segmentation"] = [[coord for point in shape_data["points"] for coord in point]]
            coco_annotations.append(annotation)
            ann_id += 1

    data = {"images": coco_images, "annotations": coco_annotations, "categories": categories}
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def export_yolo(project: Project, output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    images = image_io.list_images(project.data_dir)
    names = project.labels.names()
    (output_dir / "classes.txt").write_text("\n".join(names), encoding="utf-8")

    for path in images:
        with Image.open(path) as im:
            width, height = im.size
        lines = []
        for shape_data in _raw_shapes(path, project.output_dir):
            if shape_data["label"] not in names:
                continue
            class_id = names.index(shape_data["label"])
            x, y, w, h = _shape_bbox(shape_data)
            cx = (x + w / 2) / width
            cy = (y + h / 2) / height
            lines.append(f"{class_id} {cx:.6f} {cy:.6f} {w / width:.6f} {h / height:.6f}")
        (output_dir / f"{path.stem}.txt").write_text("\n".join(lines), encoding="utf-8")


def export_pascal_voc(project: Project, output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    images = image_io.list_images(project.data_dir)

    for path in images:
        with Image.open(path) as im:
            width, height = im.size

        root = ET.Element("annotation")
        ET.SubElement(root, "filename").text = path.name
        size = ET.SubElement(root, "size")
        ET.SubElement(size, "width").text = str(width)
        ET.SubElement(size, "height").text = str(height)
        ET.SubElement(size, "depth").text = "3"

        for shape_data in _raw_shapes(path, project.output_dir):
            x, y, w, h = _shape_bbox(shape_data)
            obj = ET.SubElement(root, "object")
            ET.SubElement(obj, "name").text = shape_data["label"]
            bndbox = ET.SubElement(obj, "bndbox")
            ET.SubElement(bndbox, "xmin").text = str(int(x))
            ET.SubElement(bndbox, "ymin").text = str(int(y))
            ET.SubElement(bndbox, "xmax").text = str(int(x + w))
            ET.SubElement(bndbox, "ymax").text = str(int(y + h))

        tree = ET.ElementTree(root)
        ET.indent(tree, space="  ")
        tree.write(output_dir / f"{path.stem}.xml", encoding="utf-8", xml_declaration=True)
