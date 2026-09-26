from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class InferenceResult:
    model_name: str
    model_version: str
    score: float | None
    localization_map: str | None
    confidence_map: str | None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Calibration:
    method: str
    parameters: dict[str, Any]
    operating_points: list[dict[str, Any]]
    validation_metrics: dict[str, Any]
    approved: bool


def calibrated_probability(raw_score: float, calibration: Calibration) -> float | None:
    if not calibration.approved:
        return None
    if calibration.method == "identity":
        return max(0.0, min(1.0, raw_score))
    if calibration.method == "platt":
        import math
        a = float(calibration.parameters["a"])
        b = float(calibration.parameters["b"])
        z = max(-60.0, min(60.0, a * raw_score + b))
        return 1.0 / (1.0 + math.exp(-z))
    raise ValueError(f"Unsupported calibration method: {calibration.method}")
