from __future__ import annotations

import hashlib
import json
import math
from dataclasses import dataclass
from typing import Any

FUSION_VERSION = "2.0.0"

@dataclass(frozen=True)
class FusionResult:
    classification: str
    confidence: float | None
    evidence_snapshot_hash: str
    components: list[dict[str, Any]]
    limitations: list[str]
    decision_basis: dict[str, Any]

def _canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)

def snapshot_hash(evidence: list[dict], provenance: list[dict], detector_runs: list[dict]) -> str:
    payload = {
        "evidence": sorted(evidence, key=lambda x: (str(x.get("category")), str(x.get("detector")), str(x.get("finding")))),
        "provenance": sorted(provenance, key=lambda x: (str(x.get("source")), str(x.get("status")))),
        "detector_runs": sorted(detector_runs, key=lambda x: (str(x.get("detector_name")), str(x.get("created_at")))),
    }
    return hashlib.sha256(_canonical(payload).encode("utf-8")).hexdigest()

def _probability(value: Any) -> float | None:
    try:
        value = float(value)
    except (TypeError, ValueError):
        return None
    return value if math.isfinite(value) and 0 <= value <= 1 else None

def _weight(strength: str | None) -> float:
    return {"calibrated": 1.0, "strong": 0.8, "moderate": 0.5, "weak": 0.25, "informational": 0.0}.get((strength or "").lower(), 0.0)

def _component(category: str, detector: str, hypothesis: str, probability: float | None,
               reliability: float, finding: str, reason: str) -> dict[str, Any]:
    return {
        "category": category, "detector": detector, "hypothesis": hypothesis,
        "probability": probability, "reliability": reliability,
        "finding": finding, "reason": reason,
    }

def fuse(evidence: list[dict], provenance: list[dict], detector_runs: list[dict]) -> FusionResult:
    components: list[dict[str, Any]] = []
    limitations: list[str] = []
    calibrated: list[tuple[float, float, str]] = []

    manifest = any(p.get("source") == "c2pa" and p.get("status") == "manifest_found" for p in provenance)
    if manifest:
        components.append(_component("provenance", "c2pa", "authenticity_support", None, 0.8,
            "c2pa_manifest_present",
            "Verified provenance supports origin history; it does not prove every pixel is unmodified."))
    else:
        components.append(_component("provenance", "c2pa", "neutral", None, 0.0,
            "no_verified_c2pa_support",
            "Absence of C2PA provenance is neutral, not manipulation evidence."))
        limitations.append("No verified C2PA provenance support was available.")

    for run in detector_runs:
        meta = run.get("metadata") or {}
        if meta.get("calibration_approved") is not True:
            continue
        if meta.get("score_semantics") != "manipulation_probability":
            continue
        p = _probability(run.get("score"))
        if p is None:
            continue
        calibrated.append((p, 1.0, str(run.get("detector_name", "unknown"))))
        components.append(_component("ml", str(run.get("detector_name", "unknown")),
            "manipulation", p, 1.0, "calibrated_probability",
            "Approved calibration explicitly defines this score as manipulation probability."))

    if not calibrated:
        limitations.append("No approved detector output with explicit manipulation-probability semantics was available.")

    pixel = [e for e in evidence if e.get("category") == "pixel" and _weight(e.get("strength")) > 0]
    if pixel:
        names = sorted({str(e.get("detector")) for e in pixel})
        components.append(_component("pixel", "signal_ensemble", "anomaly_support", None,
            min(0.6, 0.2 * len(names)), "pixel_signal_anomalies_present",
            "Pixel-domain measurements are correlated diagnostics and are retained as corroboration, not converted into probability."))
    else:
        components.append(_component("pixel", "signal_ensemble", "neutral", None, 0.0,
            "no_pixel_anomaly_evidence", "No pixel-domain anomaly evidence was available."))

    fused: float | None = None
    if calibrated:
        log_odds = 0.0
        total = 0.0
        for p, reliability, _ in calibrated[:3]:
            p = min(max(p, 1e-6), 1 - 1e-6)
            log_odds += reliability * math.log(p / (1 - p))
            total += reliability
        if total:
            log_odds /= total
            fused = 1 / (1 + math.exp(-max(-20, min(20, log_odds))))

    if fused is None:
        classification = "AUTHENTICITY_UNDETERMINED" if evidence else "INSUFFICIENT_EVIDENCE"
        confidence = None
    elif fused >= 0.95 and len(calibrated) >= 2:
        classification, confidence = "MANIPULATION_EVIDENCE_DETECTED", fused
    elif fused >= 0.80:
        classification, confidence = "REVIEW_RECOMMENDED", (fused if len(calibrated) >= 2 else None)
    elif fused <= 0.20 and manifest:
        classification, confidence = "CONSISTENT_WITH_VERIFIED_PROVENANCE", 1 - fused
    else:
        classification, confidence = "AUTHENTICITY_UNDETERMINED", (max(fused, 1 - fused) if len(calibrated) >= 2 else None)
        limitations.append("Calibrated detector evidence did not cross a decision operating point.")

    return FusionResult(
        classification=classification,
        confidence=confidence,
        evidence_snapshot_hash=snapshot_hash(evidence, provenance, detector_runs),
        components=components,
        limitations=limitations,
        decision_basis={
            "fusion_version": FUSION_VERSION,
            "calibrated_detector_count": len(calibrated),
            "c2pa_manifest_present": manifest,
            "quantitative_score_used": fused is not None,
        },
    )

def assess(evidence: list[dict]) -> FusionResult:
    return fuse(evidence=evidence, provenance=[], detector_runs=[])
