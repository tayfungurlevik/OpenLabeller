from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class AudioItem:
    """A single audio clip to classify."""

    id: str
    path: Path
    labels: list[str] = field(default_factory=list)

    @property
    def is_labeled(self) -> bool:
        return len(self.labels) > 0
