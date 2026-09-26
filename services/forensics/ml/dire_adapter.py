from __future__ import annotations

import os
import shlex
import subprocess
from pathlib import Path

import numpy as np

from .schema import InferenceResult


class DIREAdapter:
    """Deployment-controlled boundary for an external DIRE inference runtime."""

    name = "dire"

    def __init__(self) -> None:
        self.version = os.getenv("DIRE_MODEL_VERSION", "unconfigured")
        self.command = os.getenv("DIRE_COMMAND", "").strip()

    def available(self) -> bool:
        return bool(self.command)

    def infer(self, image_path: str, output_dir: str) -> InferenceResult:
        if not self.available():
            raise RuntimeError("DIRE_RUNTIME_NOT_CONFIGURED")

        output = Path(output_dir)
        output.mkdir(parents=True, exist_ok=True)

        command = self.command.format(
            image=str(Path(image_path)),
            output=str(output),
        )
        subprocess.run(
            shlex.split(command),
            check=True,
            timeout=300,
            cwd=str(output),
        )

        candidates = sorted(output.glob("*.npz"))
        if not candidates:
            raise RuntimeError("DIRE_OUTPUT_NOT_FOUND")

        with np.load(candidates[-1], allow_pickle=False) as data:
            if "score" not in data:
                raise RuntimeError("DIRE_SCORE_NOT_FOUND")
            score = float(np.asarray(data["score"]).reshape(-1)[0])

        return InferenceResult(
            model_name=self.name,
            model_version=self.version,
            score=score,
            localization_map=None,
            confidence_map=None,
            metadata={"runtime": "dire_subprocess"},
        )
