from __future__ import annotations

import io
from pathlib import Path
from typing import Callable

import numpy as np
from PIL import Image


def _normalize_map(values: np.ndarray) -> np.ndarray:
    array = np.asarray(values, dtype=np.float32)
    array = np.squeeze(array)
    if array.ndim != 2:
        raise ValueError("FORENSIC_MAP_MUST_BE_2D")
    finite = np.nan_to_num(array, nan=0.0, posinf=1.0, neginf=0.0)
    lo = float(finite.min())
    hi = float(finite.max())
    if hi > lo:
        finite = (finite - lo) / (hi - lo)
    else:
        finite = np.zeros_like(finite)
    return finite


def map_to_png(values: np.ndarray) -> bytes:
    normalized = (_normalize_map(values) * 255.0).clip(0, 255).astype(np.uint8)
    image = Image.fromarray(normalized, mode="L")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def load_npy_map(path: str | None) -> np.ndarray | None:
    if not path:
        return None
    return np.load(Path(path), allow_pickle=False)


def persist_map(
    path: str | None,
    artifact_type: str,
    storage_key: str,
    upload: Callable[[str, bytes, str], None],
) -> dict[str, str] | None:
    values = load_npy_map(path)
    if values is None:
        return None
    payload = map_to_png(values)
    upload(storage_key, payload, "image/png")
    return {"artifact_type": artifact_type, "storage_key": storage_key}
