from __future__ import annotations

from dataclasses import dataclass, field

SHAPE_TYPES = ("rectangle", "polygon", "circle", "line", "point")


@dataclass
class Shape:
    """A single annotation on an image.

    Points are plain (x, y) pixel coordinates, matching labelme's JSON
    schema directly -- rectangle/circle/line store 2 points, polygon
    stores N points, point stores 1. Rendering and interactive editing
    live entirely in the frontend (react-konva); this is just the
    serializable data model shared by save/load and the exporters.
    """

    shape_type: str
    label: str
    points: list[tuple[float, float]]
    group_id: int | None = None
    flags: dict = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.shape_type not in SHAPE_TYPES:
            raise ValueError(f"Unknown shape_type: {self.shape_type}")

    def to_dict(self) -> dict:
        return {
            "label": self.label,
            "points": [list(p) for p in self.points],
            "group_id": self.group_id,
            "shape_type": self.shape_type,
            "flags": self.flags,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Shape":
        return cls(
            shape_type=data.get("shape_type", "polygon"),
            label=data["label"],
            points=[tuple(p) for p in data["points"]],
            group_id=data.get("group_id"),
            flags=data.get("flags", {}),
        )
