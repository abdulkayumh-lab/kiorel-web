from dataclasses import dataclass, field
from typing import Any


@dataclass
class DetectorResult:
    detector: str
    version: str
    status: str
    score: float | None = None
    findings: list[dict[str, Any]] = field(default_factory=list)
    artifacts: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


class Detector:
    name = "base"
    version = "1.0.0"

    def analyze(self, image_path: str) -> DetectorResult:
        raise NotImplementedError
