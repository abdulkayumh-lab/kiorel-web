from io import BytesIO

import numpy as np
from PIL import Image, ImageChops, ImageEnhance

from .base import Detector, DetectorResult


class ElaDetector(Detector):
    name = "ela"
    version = "1.0.0"

    def analyze(self, image_path: str) -> DetectorResult:
        image = Image.open(image_path).convert("RGB")
        buffer = BytesIO()
        image.save(buffer, "JPEG", quality=90)
        buffer.seek(0)
        recompressed = Image.open(buffer).convert("RGB")
        diff = ImageChops.difference(image, recompressed)
        extrema = diff.getextrema()
        max_diff = max(channel[1] for channel in extrema)
        scale = 255.0 / max(max_diff, 1)
        heatmap = ImageEnhance.Brightness(diff).enhance(scale)
        artifact = image_path + ".ela.png"
        heatmap.save(artifact, "PNG")
        mean_delta = float(np.asarray(diff, dtype=np.float32).mean())
        return DetectorResult(
            detector=self.name,
            version=self.version,
            status="complete",
            metadata={"mean_absolute_difference": mean_delta, "max_channel_difference": max_diff},
            artifacts=[artifact],
        )
