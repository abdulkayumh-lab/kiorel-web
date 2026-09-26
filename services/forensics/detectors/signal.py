from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.fft import fft2, fftshift
from scipy.fftpack import dct


@dataclass
class SignalFinding:
    detector: str
    version: str
    score: float | None
    findings: list[str]
    metadata: dict
    artifact: str | None = None


VERSION = "1.0.0"


def _gray(path: str) -> np.ndarray:
    return np.asarray(Image.open(path).convert("L"), dtype=np.float32) / 255.0


def _save_heatmap(arr: np.ndarray, path: str) -> None:
    arr = np.asarray(arr, dtype=np.float32)
    lo, hi = np.percentile(arr, [1, 99])
    normalized = np.clip((arr - lo) / max(hi - lo, 1e-8), 0, 1)
    Image.fromarray((normalized * 255).astype(np.uint8)).save(path, "PNG")


def fft_diagnostics(path: str, artifact_path: str | None = None) -> SignalFinding:
    image = _gray(path)
    spectrum = np.log1p(np.abs(fftshift(fft2(image))))
    h, w = spectrum.shape
    yy, xx = np.ogrid[:h, :w]
    radius = np.sqrt((yy - h / 2) ** 2 + (xx - w / 2) ** 2)
    high = spectrum[radius > min(h, w) * 0.30]
    low = spectrum[radius < min(h, w) * 0.08]
    ratio = float(np.mean(high) / max(np.mean(low), 1e-8))
    if artifact_path:
        _save_heatmap(spectrum, artifact_path)
    return SignalFinding(
        detector="fft",
        version=VERSION,
        score=ratio,
        findings=["high_frequency_spectrum_measured"],
        metadata={"high_to_low_frequency_ratio": ratio},
        artifact=artifact_path,
    )


def dct_diagnostics(path: str, artifact_path: str | None = None) -> SignalFinding:
    image = _gray(path)
    h, w = image.shape
    h -= h % 8
    w -= w % 8
    image = image[:h, :w]
    blocks = image.reshape(h // 8, 8, w // 8, 8).transpose(0, 2, 1, 3)
    coeff = dct(dct(blocks, axis=-1, norm="ortho"), axis=-2, norm="ortho")
    ac = np.abs(coeff[:, :, 1:, 1:])
    energy = float(np.mean(ac))
    artifact = None
    if artifact_path:
        block_map = np.mean(ac, axis=(2, 3))
        _save_heatmap(block_map, artifact_path)
        artifact = artifact_path
    return SignalFinding(
        detector="dct",
        version=VERSION,
        score=energy,
        findings=["block_frequency_statistics_measured"],
        metadata={"mean_ac_energy": energy, "block_size": 8},
        artifact=artifact,
    )


def noise_residual(path: str, artifact_path: str | None = None) -> SignalFinding:
    image = _gray(path)
    smooth = Image.fromarray((image * 255).astype(np.uint8)).filter(Image.Filter.MedianFilter(3)) if False else None
    padded = np.pad(image, 1, mode="reflect")
    center = padded[1:-1, 1:-1]
    neighborhood = (
        padded[:-2, :-2] + padded[:-2, 1:-1] + padded[:-2, 2:] +
        padded[1:-1, :-2] + padded[1:-1, 2:] +
        padded[2:, :-2] + padded[2:, 1:-1] + padded[2:, 2:]
    ) / 8.0
    residual = np.abs(center - neighborhood)
    rms = float(np.sqrt(np.mean(residual ** 2)))
    if artifact_path:
        _save_heatmap(residual, artifact_path)
    return SignalFinding(
        detector="noise_residual",
        version=VERSION,
        score=rms,
        findings=["noise_residual_measured"],
        metadata={"residual_rms": rms},
        artifact=artifact_path,
    )


def cfa_diagnostics(path: str) -> SignalFinding:
    rgb = np.asarray(Image.open(path).convert("RGB"), dtype=np.float32) / 255.0
    if rgb.shape[0] < 4 or rgb.shape[1] < 4:
        return SignalFinding("cfa", VERSION, None, ["image_too_small"], {}, None)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    rg = float(np.mean(np.abs(r[::2, ::2] - r[1::2, 1::2])))
    bg = float(np.mean(np.abs(b[::2, ::2] - b[1::2, 1::2])))
    score = float((rg + bg) / 2)
    return SignalFinding(
        detector="cfa",
        version=VERSION,
        score=score,
        findings=["channel_sampling_consistency_measured"],
        metadata={"red_diagonal_delta": rg, "blue_diagonal_delta": bg},
    )
