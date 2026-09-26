from __future__ import annotations

import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile

from ml.trufor_adapter import TruForAdapter

app = FastAPI(title="KIOREL Forensics Inference", version="1.0.0")
adapter = TruForAdapter()


@app.get("/health")
def health():
    return {"status": "ok", "model": adapter.name, "model_version": adapter.version, "configured": adapter.available()}


@app.post("/v1/infer/trufor")
async def infer_trufor(file: UploadFile = File(...)):
    if not adapter.available():
        raise HTTPException(status_code=503, detail="TRUFOR_RUNTIME_NOT_CONFIGURED")
    suffix = Path(file.filename or "image.bin").suffix or ".bin"
    with tempfile.TemporaryDirectory() as directory:
        image_path = Path(directory) / f"input{suffix}"
        output_dir = Path(directory) / "output"
        image_path.write_bytes(await file.read())
        try:
            result = adapter.infer(str(image_path), str(output_dir))
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)[:500]) from exc
        return {
            "model_name": result.model_name,
            "model_version": result.model_version,
            "score": result.score,
            "metadata": result.metadata,
        }
