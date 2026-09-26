from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
from pathlib import Path

try:
    import c2pa
except ImportError:  # optional at development time
    c2pa = None


def exiftool_metadata(path: str) -> dict:
    binary = shutil.which("exiftool")
    if not binary:
        return {"available": False, "error": "exiftool_not_installed"}
    result = subprocess.run(
        [binary, "-j", "-G1", "-n", path],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    if result.returncode != 0:
        return {"available": False, "error": result.stderr[:500]}
    try:
        payload = json.loads(result.stdout)
        return {"available": True, "data": payload[0] if payload else {}}
    except json.JSONDecodeError:
        return {"available": False, "error": "invalid_exiftool_output"}


def c2pa_metadata(path: str) -> dict:
    if c2pa is None:
        return {"available": False, "status": "sdk_not_installed"}
    try:
        reader = c2pa.Reader.try_create(path)
        if reader is None:
            return {"available": True, "status": "no_manifest"}
        with reader:
            payload = json.loads(reader.json())
            return {
                "available": True,
                "status": "manifest_found",
                "manifest_store": payload,
            }
    except Exception as exc:
        return {"available": True, "status": "verification_error", "error": str(exc)[:1000]}


def collect_provenance(path: str) -> dict:
    return {
        "c2pa": c2pa_metadata(path),
        "exiftool": exiftool_metadata(path),
    }
