import io
import os
import tempfile
import time
from datetime import datetime, timezone

import httpx
from PIL import Image, ImageChops, ImageEnhance


SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
BUCKET = os.getenv("FORENSICS_BUCKET", "kiorel-media")
POLL_SECONDS = float(os.getenv("FORENSICS_POLL_SECONDS", "3"))

HEADERS = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
}


def rest(method: str, path: str, **kwargs):
    with httpx.Client(timeout=60) as client:
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
        if response.status_code == 409:
            return
        response.raise_for_status()


def now():
    return datetime.now(timezone.utc).isoformat()


def process_job(job):
    job_id = job["id"]
    analysis_id = job["analysis_id"]
    job_type = job["job_type"]

    rest("PATCH", f"analysis_jobs?id=eq.{job_id}", json={
        "status": "running",
        "attempts": job["attempts"] + 1,
        "started_at": now(),
    })

    try:
        analysis = rest(
            "GET",
            f"analyses?id=eq.{analysis_id}&select=id,media_id",
        )[0]
        media = rest(
            "GET",
            f"media?id=eq.{analysis['media_id']}&select=id,storage_key,filename,mime_type",
        )[0]

        if job_type == "ingest":
            data = storage_get(media["storage_key"])
            image = Image.open(io.BytesIO(data))
            rest("PATCH", f"media?id=eq.{media['id']}", json={
                "width": image.width,
                "height": image.height,
            })
            complete_job(job_id)
            advance_analysis(analysis_id, "provenance")
            return

        if job_type == "provenance":
            data = storage_get(media["storage_key"])
            image = Image.open(io.BytesIO(data))
            metadata = {
                "format": image.format,
                "mode": image.mode,
                "size": list(image.size),
                "has_exif": bool(image.getexif()),
            }
            rest("POST", "metadata_records", json={
                "analysis_id": analysis_id,
                "source": "pillow",
                "metadata": metadata,
            })
            rest("POST", "provenance_records", json={
                "analysis_id": analysis_id,
                "source": "metadata",
                "status": "inspected",
                "details": {"c2pa": "not_checked_by_worker"},
            })
            complete_job(job_id)
            advance_analysis(analysis_id, "pixel_analysis")
            return

        if job_type == "pixel_analysis":
            data = storage_get(media["storage_key"])
            image = Image.open(io.BytesIO(data)).convert("RGB")
            buffer = io.BytesIO()
            image.save(buffer, "JPEG", quality=90)
            recompressed = Image.open(io.BytesIO(buffer.getvalue())).convert("RGB")
            diff = ImageChops.difference(image, recompressed)
            max_diff = max(channel[1] for channel in diff.getextrema())
            scale = 255.0 / max(max_diff, 1)
            heatmap = ImageEnhance.Brightness(diff).enhance(scale)

            output = io.BytesIO()
            heatmap.save(output, "PNG")
            artifact_key = f"org/unknown/analysis/{analysis_id}/ela.png"
            storage_put(artifact_key, output.getvalue(), "image/png")

            rest("POST", "forensic_artifacts", json={
                "analysis_id": analysis_id,
                "artifact_type": "ela",
                "storage_key": artifact_key,
                "mime_type": "image/png",
                "metadata": {"quality": 90, "max_channel_difference": max_diff},
            })
            rest("POST", "evidence_items", json={
                "analysis_id": analysis_id,
                "category": "pixel",
                "detector": "ela",
                "finding": "recompression_delta_available",
                "strength": "informational",
                "details": {"max_channel_difference": max_diff},
            })
            complete_job(job_id)
            advance_analysis(analysis_id, "ml_analysis")
            return

        # ML/evidence/reporting are intentionally explicit placeholders until
        # calibrated models and a real queue are deployed.
        if job_type == "ml_analysis":
            complete_job(job_id)
            advance_analysis(analysis_id, "evidence_fusion")
            return

        if job_type == "evidence_fusion":
            rest("PATCH", f"analyses?id=eq.{analysis_id}", json={
                "status": "reporting",
                "assessment": "AUTHENTICITY_UNDETERMINED",
                "confidence": None,
            })
            complete_job(job_id)
            return

        if job_type == "reporting":
            rest("PATCH", f"analyses?id=eq.{analysis_id}", json={
                "status": "complete",
                "completed_at": now(),
            })
            complete_job(job_id)
            return

        raise ValueError(f"Unsupported job type: {job_type}")

    except Exception as exc:
        rest("PATCH", f"analysis_jobs?id=eq.{job_id}", json={
            "status": "failed",
            "error_message": str(exc)[:1000],
        })
        rest("PATCH", f"analyses?id=eq.{analysis_id}", json={
            "status": "failed",
            "error_code": "WORKER_ERROR",
            "error_message": str(exc)[:1000],
        })


def complete_job(job_id: str):
    rest("PATCH", f"analysis_jobs?id=eq.{job_id}", json={
        "status": "complete",
        "progress": 100,
        "completed_at": now(),
    })


def advance_analysis(analysis_id: str, status: str):
    rest("PATCH", f"analyses?id=eq.{analysis_id}", json={"status": status})


def main():
    while True:
        jobs = rest(
            "GET",
            "analysis_jobs?status=eq.queued&select=id,analysis_id,job_type,attempts,created_at&order=created_at.asc&limit=1",
        )
        if jobs:
            process_job(jobs[0])
        else:
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
