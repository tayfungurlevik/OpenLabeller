from pathlib import Path

import pytest

from openlabeller.core.labels import LabelClassSet
from openlabeller.core.project import Project, TaskType


def test_label_class_set_auto_color_and_shortcut():
    labels = LabelClassSet()
    cat = labels.add("cat")
    dog = labels.add("dog")

    assert cat.color != dog.color
    assert cat.shortcut == "1"
    assert dog.shortcut == "2"


def test_label_class_set_rejects_duplicate_names():
    labels = LabelClassSet()
    labels.add("cat")
    with pytest.raises(ValueError):
        labels.add("cat")


def test_project_create_save_and_load(tmp_path: Path):
    data_dir = tmp_path / "images"
    data_dir.mkdir()

    project = Project.create(TaskType.IMAGE, data_dir=data_dir, name="My Project")
    project.labels.add("cat")
    project.labels.add("dog")
    project.save()

    loaded = Project.load(project.project_file)

    assert loaded.task_type == TaskType.IMAGE
    assert loaded.name == "My Project"
    assert loaded.data_dir == data_dir
    assert loaded.labels.names() == ["cat", "dog"]
