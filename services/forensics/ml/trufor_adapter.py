from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path

import numpy as np

from .schema import InferenceResult


class TruForAdapter:
    """
    Adapter for the official TruFor inference runtime.

    The official implementation emits an NPZ containing map, conf, score and
    image size. KIOREL deliberately treats the model runtime as an external
    GPU component so the control-plane worker never downloads model weights.
    """

    name = "trufor"

    def __init__(self) -> None:
        self.version = os.getenv("TRUFOR_MODEL_VERSION", "unconfigured")
        self.command = os.getenv("TRUFOR_COMMAND", "").strip()

    def available(self) -> bool:
        return bool(self.command)

    def infer(self, image_path: str, output_dir: str) -> InferenceResult:
        if not self.available():
            raise RuntimeError("TRUFOR_RUNTIME_NOT_CONFIGURED")

        output = Path(output_dir)
        output.mkdir(parents=True, exist_ok=True)
        command = self.command.format(
            image=Path(image_path),
            output=output,
        )
        subprocess.run(command, shell=True, check=True, timeout=300)

        npz_files = sorted(output.glob("*.npz"))
        if not npz_files:
            raise RuntimeError("TRUFOR_OUTPUT_NOT_FOUND")

        with np.load(npz_files[-1], allow_pickle=False) as data:
            score = float(np.asarray(data["score"]).reshape(-1)[0])
            map_path = None
            conf_path = None
            if "map" in data:
                map_path = str(output / "map.npy")
                np.save(map_path, np.asarray(data["map"]))
            if "conf" in data:
                conf_path = str(output / "conf.npy")
                np.save(conf_path, np.asarray(data["conf"]))

        return InferenceResult(
            model_name=self.name,
            model_version=self.version,
            score=score,
            localization_map=map_path,
            confidence_map=conf_path,
            metadata={"runtime": "trufor_subprocess"},
        )
