from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from openlabeller.audio import io as audio_io
from openlabeller.core.project import PROJECT_FILENAME, Project, TaskType
from openlabeller.image import exporters as image_exporters
from openlabeller.image import io as image_io
from openlabeller.image.shapes import Shape
from openlabeller.text import io as text_io

app = FastAPI(title="OpenLabeller backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---- helpers --------------------------------------------------------------
def _load_project(dir_: str) -> Project:
    output_dir = Path(dir_)
    project_file = output_dir / PROJECT_FILENAME
    if not project_file.exists():
        raise HTTPException(status_code=404, detail=f"No project found at {output_dir}")
    return Project.load(project_file)


def _project_json(project: Project) -> dict[str, Any]:
    return {
        "name": project.name,
        "task_type": project.task_type.value,
        "data_dir": str(project.data_dir),
        "output_dir": str(project.output_dir),
        "multi_label": project.multi_label,
        "labels": project.labels.to_list(),
    }


def _image_size(path: Path) -> tuple[int, int]:
    from PIL import Image

    with Image.open(path) as im:
        return im.size


# ---- schemas ----------------------------------------------------------------
class CreateProjectRequest(BaseModel):
    task_type: str
    data_dir: str
    name: str | None = None


class UpdateProjectRequest(BaseModel):
    dir: str
    name: str | None = None
    multi_label: bool | None = None


class AddLabelRequest(BaseModel):
    dir: str
    name: str


class ShapesPayload(BaseModel):
    shapes: list[dict]


class ItemLabelsRequest(BaseModel):
    labels: list[str]


class ExportRequest(BaseModel):
    dir: str
    path: str


# ---- health -----------------------------------------------------------------
@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


# ---- projects -----------------------------------------------------------------
@app.post("/api/projects")
def create_project(req: CreateProjectRequest) -> dict:
    project = Project.create(
        TaskType(req.task_type),
        data_dir=Path(req.data_dir),
        name=req.name,
    )
    return _project_json(project)


@app.get("/api/projects")
def get_project(dir: str) -> dict:
    return _project_json(_load_project(dir))


@app.patch("/api/projects")
def update_project(req: UpdateProjectRequest) -> dict:
    project = _load_project(req.dir)
    if req.name is not None:
        project.name = req.name
    if req.multi_label is not None:
        project.multi_label = req.multi_label
    project.save()
    return _project_json(project)


@app.post("/api/projects/labels")
def add_label(req: AddLabelRequest) -> dict:
    project = _load_project(req.dir)
    if project.labels.get(req.name) is not None:
        raise HTTPException(status_code=400, detail=f"Label '{req.name}' already exists")
    project.labels.add(req.name)
    project.save()
    return _project_json(project)


@app.delete("/api/projects/labels")
def remove_label(dir: str, name: str) -> dict:
    project = _load_project(dir)
    project.labels.remove(name)
    project.save()
    return _project_json(project)


# ---- image ------------------------------------------------------------------
@app.get("/api/image/files")
def list_image_files(dir: str) -> list[dict]:
    project = _load_project(dir)
    images = image_io.list_images(project.data_dir)
    return [
        {"name": p.name, "labeled": image_io.has_annotation(p, project.output_dir)}
        for p in images
    ]


@app.get("/api/image/file")
def get_image_file(dir: str, name: str) -> FileResponse:
    project = _load_project(dir)
    path = project.data_dir / name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(path)


@app.get("/api/image/annotation")
def get_image_annotation(dir: str, name: str) -> dict:
    project = _load_project(dir)
    path = project.data_dir / name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Image not found")

    before = project.labels.names()
    shapes = image_io.load_annotation(path, project.output_dir, project.labels)
    if project.labels.names() != before:
        project.save()

    width, height = _image_size(path)
    return {"shapes": [s.to_dict() for s in shapes], "width": width, "height": height}


@app.put("/api/image/annotation")
def put_image_annotation(dir: str, name: str, payload: ShapesPayload) -> dict:
    project = _load_project(dir)
    path = project.data_dir / name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Image not found")

    width, height = _image_size(path)
    shapes = [Shape.from_dict(s) for s in payload.shapes]
    image_io.save_annotation(path, shapes, project.output_dir, width, height)
    return {"status": "ok"}


@app.post("/api/image/export/coco")
def export_coco(req: ExportRequest) -> dict:
    project = _load_project(req.dir)
    image_exporters.export_coco(project, Path(req.path))
    return {"status": "ok", "path": req.path}


@app.post("/api/image/export/yolo")
def export_yolo(req: ExportRequest) -> dict:
    project = _load_project(req.dir)
    image_exporters.export_yolo(project, Path(req.path))
    return {"status": "ok", "path": req.path}


@app.post("/api/image/export/voc")
def export_voc(req: ExportRequest) -> dict:
    project = _load_project(req.dir)
    image_exporters.export_pascal_voc(project, Path(req.path))
    return {"status": "ok", "path": req.path}


# ---- text -------------------------------------------------------------------
@app.get("/api/text/items")
def list_text_items(dir: str) -> list[dict]:
    project = _load_project(dir)
    items = text_io.load_dataset(project)
    return [{"id": i.id, "text": i.text, "labels": i.labels} for i in items]


@app.put("/api/text/item")
def put_text_item(dir: str, id: str, payload: ItemLabelsRequest) -> dict:
    project = _load_project(dir)
    items = text_io.load_dataset(project)
    item = next((i for i in items if i.id == id), None)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    item.labels = payload.labels
    text_io.save_annotations(project, items)
    return {"status": "ok"}


@app.post("/api/text/export")
def export_text(dir: str, format: str, path: str) -> dict:
    project = _load_project(dir)
    items = text_io.load_dataset(project)
    if format == "jsonl":
        text_io.export_jsonl(items, Path(path))
    else:
        text_io.export_csv(items, Path(path))
    return {"status": "ok", "path": path}


# ---- audio ------------------------------------------------------------------
@app.get("/api/audio/files")
def list_audio_files(dir: str) -> list[dict]:
    project = _load_project(dir)
    items = audio_io.load_dataset(project)
    return [{"id": i.id, "labels": i.labels} for i in items]


@app.get("/api/audio/file")
def get_audio_file(dir: str, name: str) -> FileResponse:
    project = _load_project(dir)
    path = project.data_dir / name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(path)


@app.get("/api/audio/peaks")
def get_audio_peaks(dir: str, name: str) -> dict:
    project = _load_project(dir)
    path = project.data_dir / name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Audio file not found")
    peaks = audio_io.compute_peaks(path)
    return {"peaks": peaks.tolist() if peaks is not None else None}


@app.put("/api/audio/item")
def put_audio_item(dir: str, id: str, payload: ItemLabelsRequest) -> dict:
    project = _load_project(dir)
    items = audio_io.load_dataset(project)
    item = next((i for i in items if i.id == id), None)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    item.labels = payload.labels
    audio_io.save_annotations(project, items)
    return {"status": "ok"}


@app.post("/api/audio/export")
def export_audio(dir: str, format: str, path: str) -> dict:
    project = _load_project(dir)
    items = audio_io.load_dataset(project)
    if format == "jsonl":
        audio_io.export_jsonl(items, Path(path))
    else:
        audio_io.export_csv(items, Path(path))
    return {"status": "ok", "path": path}


def main() -> None:
    import uvicorn

    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=int(os.environ.get("OPENLABELLER_PORT", 8756)))
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args()

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
