from __future__ import annotations

import base64
import hashlib
import io
import json
import os
import socket
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx
from PIL import Image, ImageChops, ImageEnhance

from detectors.signal import cfa_diagnostics, dct_diagnostics, fft_diagnostics, noise_residual
from provenance import collect_provenance
from ml.schema import Calibration, calibrated_probability


SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
BUCKET = os.getenv("FORENSICS_BUCKET", "kiorel-media")
POLL_SECONDS = float(os.getenv("FORENSICS_POLL_SECONDS", "3"))
MAX_ATTEMPTS = int(os.getenv("FORENSICS_MAX_ATTEMPTS", "3"))
WORKER_ID = os.getenv("FORENSICS_WORKER_ID", socket.gethostname())
ML_SERVICE_URL = os.getenv("FORENSICS_ML_URL", "").rstrip("/")
ML_ENABLE_DIRE = os.getenv("FORENSICS_ML_ENABLE_DIRE", "false").lower() == "true"

HEADERS = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
}


def rest(method: str, path: str, **kwargs):
    with httpx.Client(timeout=120) as client:
        response = client.request(method, f"{SUPABASE_URL}/rest/v1/{path}", headers=HEADERS, **kwargs)
        response.raise_for_status()
        return response.json() if response.content else None


def storage_get(key: str) -> bytes:
    with httpx.Client(timeout=120) as client:
        response = client.get(
            f"{SUPABASE_URL}/storage/v1/object/authenticated/{BUCKET}/{key}",
            headers=HEADERS,
        )
        response.raise_for_status()
        return response.content


def storage_put(key: str, data: bytes, content_type: str) -> None:
    headers = {**HEADERS, "Content-Type": content_type, "x-upsert": "false"}
    with httpx.Client(timeout=120) as client:
        response = client.post(
            f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{key}",
            headers=headers,
            content=data,
        )
        if response.status_code != 409:
            response.raise_for_status()


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def claim_job():
    jobs = rest("POST", "rpc/claim_forensics_job", json={
        "p_worker_id": WORKER_ID,
        "p_stale_after_seconds": 900,
    })
    return jobs[0] if jobs else None


def set_analysis(analysis_id: str, **fields) -> None:
    rest("PATCH", f"analyses?id=eq.{analysis_id}", json=fields)


def complete_job(job_id: str) -> None:
    rest("PATCH", f"analysis_jobs?id=eq.{job_id}", json={
        "status": "complete",
        "progress": 100,
        "completed_at": now(),
    })


def fail_job(job: dict, exc: Exception) -> None:
    message = str(exc)[:1000]
    if int(job["attempts"]) < MAX_ATTEMPTS:
        rest("PATCH", f"analysis_jobs?id=eq.{job['id']}", json={
            "status": "queued",
            "error_message": message,
        })
    else:
        rest("PATCH", f"analysis_jobs?id=eq.{job['id']}", json={
            "status": "failed",
            "error_message": message,
        })
        set_analysis(
            job["analysis_id"],
            status="failed",
            error_code="WORKER_ERROR",
            error_message=message,
        )


def add_artifact(analysis_id: str, artifact_type: str, key: str, mime_type: str, metadata: dict) -> None:
    existing = rest(
        "GET",
        "forensic_artifacts"
        f"?analysis_id=eq.{analysis_id}&artifact_type=eq.{artifact_type}&storage_key=eq.{key}&select=id&limit=1",
    )
    if not existing:
        rest("POST", "forensic_artifacts", json={
            "analysis_id": analysis_id,
            "artifact_type": artifact_type,
            "storage_key": key,
            "mime_type": mime_type,
            "metadata": metadata,
        })


def add_evidence(analysis_id: str, category: str, detector: str, finding: str, score, strength: str, details: dict) -> None:
    rest("POST", "evidence_items", json={
        "analysis_id": analysis_id,
        "category": category,
        "detector": detector,
        "finding": finding,
        "score": score,
        "strength": strength,
        "details": details,
    })


def add_detector_run(analysis_id: str, detector, score, findings, artifacts, metadata) -> None:
    rest("POST", "detector_runs", json={
        "analysis_id": analysis_id,
        "detector_name": detector,
        "status": "complete",
        "score": score,
        "findings": findings,
        "artifacts": artifacts,
        "metadata": metadata,
    })


def process_job(job: dict) -> None:
    analysis_id = job["analysis_id"]
    analysis = rest("GET", f"analyses?id=eq.{analysis_id}&select=id,media_id")[0]
    media = rest(
        "GET",
        f"media?id=eq.{analysis['media_id']}"
        "&select=id,organization_id,storage_key,filename,mime_type,sha256,width,height",
    )[0]

    if job["job_type"] == "ingest":
        data = storage_get(media["storage_key"])
        digest = hashlib.sha256(data).hexdigest()
        if digest != media["sha256"]:
            raise ValueError("MEDIA_HASH_MISMATCH")
        with Image.open(io.BytesIO(data)) as image:
            image.verify()
        with Image.open(io.BytesIO(data)) as image:
            set_analysis(analysis_id, started_at=now())
            rest("PATCH", f"media?id=eq.{media['id']}", json={
                "width": image.width,
                "height": image.height,
            })
        complete_job(job["id"])
        set_analysis(analysis_id, status="provenance")
        return

    if job["job_type"] == "provenance":
        data = storage_get(media["storage_key"])
        with tempfile.NamedTemporaryFile(suffix=Path(media["filename"] or "image.jpg").suffix or ".jpg") as tmp:
            tmp.write(data)
            tmp.flush()
            provenance = collect_provenance(tmp.name)

        c2pa = provenance["c2pa"]
        exif = provenance["exiftool"]
        rest("POST", "metadata_records", json={
            "analysis_id": analysis_id,
            "source": "exiftool+c2pa",
            "metadata": provenance,
        })
        rest("POST", "provenance_records", json={
            "analysis_id": analysis_id,
            "source": "c2pa",
            "status": c2pa.get("status", "unavailable"),
            "details": c2pa,
        })
        rest("POST", "provenance_records", json={
            "analysis_id": analysis_id,
            "source": "exiftool",
            "status": "inspected" if exif.get("available") else "unavailable",
            "details": exif,
        })
        if c2pa.get("status") == "manifest_found":
            add_evidence(analysis_id, "provenance", "c2pa", "c2pa_manifest_present", None, "strong", {
                "status": c2pa.get("status"),
            })
        elif c2pa.get("status") == "no_manifest":
            add_evidence(analysis_id, "provenance", "c2pa", "no_c2pa_manifest_found", None, "informational", {})
        complete_job(job["id"])
        set_analysis(analysis_id, status="pixel_analysis")
        return

    if job["job_type"] == "pixel_analysis":
        data = storage_get(media["storage_key"])
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / (Path(media["filename"] or "image.jpg").name)
            source.write_bytes(data)

            image = Image.open(io.BytesIO(data)).convert("RGB")
            buffer = io.BytesIO()
            image.save(buffer, "JPEG", quality=90)
            recompressed = Image.open(io.BytesIO(buffer.getvalue())).convert("RGB")
            diff = ImageChops.difference(image, recompressed)
            max_diff = max(channel[1] for channel in diff.getextrema())
            mean_diff = float(sum(sum(channel) for channel in diff.getdata()) / (image.width * image.height * 3))
            scale = 255.0 / max(max_diff, 1)
            heatmap = ImageEnhance.Brightness(diff).enhance(scale)
            ela_path = Path(directory) / "ela.png"
            heatmap.save(ela_path, "PNG")

            detectors = [
                ("ela", float(mean_diff), ["recompression_delta_available"],
                 {"mean_absolute_difference": mean_diff, "max_channel_difference": max_diff}, ela_path),
            ]

            fft_path = Path(directory) / "fft.png"
            fft = fft_diagnostics(str(source), str(fft_path))
            detectors.append(("fft", fft.score, fft.findings, fft.metadata, fft_path))

            dct_path = Path(directory) / "dct.png"
            dct = dct_diagnostics(str(source), str(dct_path))
            detectors.append(("dct", dct.score, dct.findings, dct.metadata, dct_path))

            noise_path = Path(directory) / "noise_residual.png"
            noise = noise_residual(str(source), str(noise_path))
            detectors.append(("noise_residual", noise.score, noise.findings, noise.metadata, noise_path))

            cfa = cfa_diagnostics(str(source))
            detectors.append(("cfa", cfa.score, cfa.findings, cfa.metadata, None))

            for detector, score, findings, metadata, artifact in detectors:
                artifact_key = None
                artifact_refs = []
                if artifact is not None and artifact.exists():
                    artifact_key = (
                        f"org/{media['organization_id']}/media/{media['id']}/"
                        f"forensic/{detector}.png"
                    )
                    storage_put(artifact_key, artifact.read_bytes(), "image/png")
                    add_artifact(analysis_id, detector, artifact_key, "image/png", metadata)
                    artifact_refs.append(artifact_key)
                add_detector_run(analysis_id, detector, score, findings, artifact_refs, {
                    "version": "1.0.0",
                    **metadata,
                })
                add_evidence(
                    analysis_id,
                    "pixel",
                    detector,
                    findings[0] if findings else "measurement_complete",
                    score,
                    "informational",
                    metadata,
                )

        complete_job(job["id"])
        set_analysis(analysis_id, status="ml_analysis")
        return

    if job["job_type"] == "ml_analysis":
        data = storage_get(media["storage_key"])

        if not ML_SERVICE_URL:
            add_evidence(
                analysis_id,
                "ml",
                "model_registry",
                "neural_detector_stage_not_enabled",
                None,
                "informational",
                {"reason": "GPU inference service is not configured"},
            )
        else:
            endpoints = [("trufor", "/v1/infer/trufor")]
            if ML_ENABLE_DIRE:
                endpoints.append(("dire", "/v1/infer/dire"))

            for requested_model, endpoint in endpoints:
                try:
                    with httpx.Client(timeout=360) as client:
                        response = client.post(
                            f"{ML_SERVICE_URL}{endpoint}",
                            files={"file": (media["filename"] or "image.jpg", data, media["mime_type"])},
                        )
                        response.raise_for_status()
                        result = response.json()
                except httpx.HTTPError as exc:
                    add_evidence(
                        analysis_id,
                        "ml",
                        requested_model,
                        "neural_detector_unavailable",
                        None,
                        "informational",
                        {"error": str(exc)[:500]},
                    )
                    continue

                model_name = result.get("model_name", requested_model)
                model_version = result.get("model_version", "unknown")
                raw_score = result.get("score")
                models = rest(
                    "GET",
                    f"detector_models?name=eq.{model_name}&version=eq.{model_version}&limit=1",
                ) or []
                model_id = models[0]["id"] if models else None
                calibration = None
                calibrated = None

                if model_id:
                    rows = rest(
                        "GET",
                        f"detector_calibrations?detector_model_id=eq.{model_id}"
                        "&approved=eq.true&order=created_at.desc&limit=1",
                    ) or []
                    if rows:
                        candidate = rows[0]
                        try:
                            calibration_obj = Calibration(
                                method=candidate["method"],
                                parameters=candidate.get("parameters") or {},
                                operating_points=candidate.get("operating_points") or [],
                                validation_metrics=candidate.get("validation_metrics") or {},
                                approved=bool(candidate.get("approved")),
                            )
                            if raw_score is not None:
                                calibrated = calibrated_probability(float(raw_score), calibration_obj)
                                calibration = candidate
                        except (KeyError, TypeError, ValueError):
                            calibration = None
                            calibrated = None

                metadata = {
                    "model_name": model_name,
                    "model_version": model_version,
                    "raw_score": raw_score,
                    "calibration_id": calibration.get("id") if calibration else None,
                    "calibration_approved": bool(calibration) if calibration else False,
                    "score_semantics": calibration.get("score_semantics", "unknown") if calibration else "unknown",
                    **(result.get("metadata") or {}),
                }

                artifact_refs = []
                for map_name, artifact_type in (
                    ("localization_map_b64", f"{model_name}_localization_map"),
                    ("confidence_map_b64", f"{model_name}_confidence_map"),
                ):
                    encoded = result.get(map_name)
                    if encoded:
                        payload = base64.b64decode(encoded, validate=True)
                        artifact_key = (
                            f"org/{media['organization_id']}/media/{media['id']}/"
                            f"forensic/{artifact_type}.npy"
                        )
                        storage_put(artifact_key, payload, "application/octet-stream")
                        add_artifact(
                            analysis_id,
                            artifact_type,
                            artifact_key,
                            "application/octet-stream",
                            {"model_name": model_name, "model_version": model_version},
                        )
                        artifact_refs.append(artifact_key)

                rest("POST", "detector_runs", json={
                    "analysis_id": analysis_id,
                    "detector_model_id": model_id,
                    "detector_name": model_name,
                    "status": "complete",
                    "score": calibrated,
                    "findings": ["neural_inference_complete"],
                    "artifacts": artifact_refs,
                    "metadata": metadata,
                })
                add_evidence(
                    analysis_id,
                    "ml",
                    model_name,
                    "calibrated_neural_score_available" if calibrated is not None else "neural_score_uncalibrated",
                    calibrated,
                    "calibrated" if calibrated is not None else "informational",
                    metadata,
                )

        complete_job(job["id"])
        set_analysis(analysis_id, status="evidence_fusion")
        return

    if job["job_type"] == "evidence_fusion":
        from evidence.fusion import FUSION_VERSION, fuse

        evidence = rest(
            "GET",
            f"evidence_items?analysis_id=eq.{analysis_id}"
            "&select=category,detector,finding,score,strength,details,created_at",
        ) or []
        provenance = rest(
            "GET",
            f"provenance_records?analysis_id=eq.{analysis_id}"
            "&select=source,status,details,created_at",
        ) or []
        detector_runs = rest(
            "GET",
            f"detector_runs?analysis_id=eq.{analysis_id}"
            "&select=detector_name,status,score,findings,artifacts,metadata,created_at",
        ) or []

        result = fuse(
            evidence=evidence,
            provenance=provenance,
            detector_runs=detector_runs,
        )

        rest("POST", "fusion_runs", json={
            "analysis_id": analysis_id,
            "fusion_version": FUSION_VERSION,
            "evidence_snapshot_hash": result.evidence_snapshot_hash,
            "classification": result.classification,
            "confidence": result.confidence,
            "components": result.components,
            "limitations": result.limitations,
            "decision_basis": result.decision_basis,
        })

        rest("POST", "reports", json={
            "analysis_id": analysis_id,
            "format": "json",
            "report": {
                "pipeline_version": "2.0.0",
                "fusion_version": FUSION_VERSION,
                "assessment": result.classification,
                "confidence": result.confidence,
                "evidence_snapshot_hash": result.evidence_snapshot_hash,
                "decision_basis": result.decision_basis,
                "components": result.components,
                "limitations": result.limitations,
            },
        })

        set_analysis(
            analysis_id,
            status="reporting",
            assessment=result.classification,
            confidence=result.confidence,
        )
        complete_job(job["id"])
        return

    if job["job_type"] == "reporting":
        set_analysis(analysis_id, status="complete", completed_at=now())
        complete_job(job["id"])
        return

    raise ValueError(f"Unsupported job type: {job['job_type']}")


def main():
    while True:
        job = None
        try:
            job = claim_job()
            if job:
                process_job(job)
            else:
                time.sleep(POLL_SECONDS)
        except Exception as exc:
            if job:
                fail_job(job, exc)
            else:
                time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
