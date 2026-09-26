from dataclasses import dataclass


@dataclass
class Assessment:
    classification: str
    confidence: float | None
    limitations: list[str]


def assess(evidence: list[dict]) -> Assessment:
    # Initial foundation: no automatic high-confidence verdicts.
    # Real calibration requires validation datasets and per-detector operating points.
    if not evidence:
        return Assessment(
            classification="INSUFFICIENT_EVIDENCE",
            confidence=None,
            limitations=["No forensic evidence was produced."],
        )

    return Assessment(
        classification="AUTHENTICITY_UNDETERMINED",
        confidence=None,
        limitations=[
            "Detector evidence is not independently sufficient to establish media origin.",
            "Assessment calibration will be added after validated detector datasets are available.",
        ],
    )
