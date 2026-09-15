from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path

from openlabeller.core.labels import LabelClassSet
from openlabeller.core.storage import load_json, save_json_atomic

PROJECT_FILENAME = "openlabeller_project.json"


class TaskType(str, Enum):
    IMAGE = "image"
    TEXT = "text"
    AUDIO = "audio"


@dataclass
class Project:
    """Ties together a task type, its source/output folders, and label classes."""

    task_type: TaskType
    data_dir: Path
    output_dir: Path
    name: str = "Untitled project"
    labels: LabelClassSet = field(default_factory=LabelClassSet)
    multi_label: bool = False

    @property
    def project_file(self) -> Path:
        return self.output_dir / PROJECT_FILENAME

    def save(self) -> None:
        data = {
            "name": self.name,
            "task_type": self.task_type.value,
            "data_dir": str(self.data_dir),
            "output_dir": str(self.output_dir),
            "multi_label": self.multi_label,
            "labels": self.labels.to_list(),
        }
        save_json_atomic(self.project_file, data)

    @classmethod
    def load(cls, project_file: Path) -> "Project":
        data = load_json(project_file)
        return cls(
            task_type=TaskType(data["task_type"]),
            data_dir=Path(data["data_dir"]),
            output_dir=Path(data["output_dir"]),
            name=data.get("name", "Untitled project"),
            labels=LabelClassSet.from_list(data.get("labels", [])),
            multi_label=data.get("multi_label", False),
        )

    @classmethod
    def create(
        cls,
        task_type: TaskType,
        data_dir: Path,
        output_dir: Path | None = None,
        name: str | None = None,
        multi_label: bool = False,
    ) -> "Project":
        data_dir = Path(data_dir)
        output_dir = Path(output_dir) if output_dir else data_dir
        project = cls(
            task_type=task_type,
            data_dir=data_dir,
            output_dir=output_dir,
            name=name or data_dir.name,
            multi_label=multi_label,
        )
        project.save()
        return project
