from __future__ import annotations

from dataclasses import dataclass, field

# A palette of visually distinct, vivid colors -- legible against the app's
# dark UI -- auto-assigned to new label classes in order so that adjacent
# classes are easy to tell apart.
DEFAULT_PALETTE = [
    "#7C6CFF", "#FF6B5C", "#4CD98A", "#4FD1F7", "#FFB84C",
    "#FF6CC9", "#5C8CFF", "#B6E24C", "#C26CFF", "#4CD9C0",
]


@dataclass
class LabelClass:
    """A single label/category that can be assigned to annotations."""

    name: str
    color: str
    shortcut: str | None = None

    def to_dict(self) -> dict:
        return {"name": self.name, "color": self.color, "shortcut": self.shortcut}

    @classmethod
    def from_dict(cls, data: dict) -> "LabelClass":
        return cls(
            name=data["name"],
            color=data.get("color", DEFAULT_PALETTE[0]),
            shortcut=data.get("shortcut"),
        )


@dataclass
class LabelClassSet:
    """An ordered collection of label classes, with auto color/shortcut assignment."""

    classes: list[LabelClass] = field(default_factory=list)

    def __len__(self) -> int:
        return len(self.classes)

    def __iter__(self):
        return iter(self.classes)

    def names(self) -> list[str]:
        return [c.name for c in self.classes]

    def get(self, name: str) -> LabelClass | None:
        for c in self.classes:
            if c.name == name:
                return c
        return None

    def next_color(self) -> str:
        return DEFAULT_PALETTE[len(self.classes) % len(DEFAULT_PALETTE)]

    def next_shortcut(self) -> str | None:
        used = {c.shortcut for c in self.classes if c.shortcut}
        for digit in "123456789":
            if digit not in used:
                return digit
        return None

    def add(self, name: str, color: str | None = None, shortcut: str | None = None) -> LabelClass:
        if self.get(name) is not None:
            raise ValueError(f"Label class '{name}' already exists")
        label = LabelClass(
            name=name,
            color=color or self.next_color(),
            shortcut=shortcut if shortcut is not None else self.next_shortcut(),
        )
        self.classes.append(label)
        return label

    def remove(self, name: str) -> None:
        self.classes = [c for c in self.classes if c.name != name]

    def to_list(self) -> list[dict]:
        return [c.to_dict() for c in self.classes]

    @classmethod
    def from_list(cls, data: list[dict]) -> "LabelClassSet":
        return cls(classes=[LabelClass.from_dict(d) for d in data])
