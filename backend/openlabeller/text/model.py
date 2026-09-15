from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class TextItem:
    """A single unit of text to classify (a file, or a row from a CSV/JSONL)."""

    id: str
    text: str
    labels: list[str] = field(default_factory=list)

    @property
    def is_labeled(self) -> bool:
        return len(self.labels) > 0

    def preview(self, length: int = 60) -> str:
        flat = " ".join(self.text.split())
        return flat if len(flat) <= length else flat[: length - 1] + "…"
