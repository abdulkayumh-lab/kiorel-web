import numpy as np
import pytest

from ml.dire_adapter import DIREAdapter
from ml.schema import Calibration, calibrated_probability
from ml.artifacts import map_to_png


def test_identity_calibration_clamps_score():
    calibration = Calibration(
        method="identity",
        parameters={},
        operating_points=[],
        validation_metrics={},
        approved=True,
    )
    assert calibrated_probability(1.4, calibration) == 1.0
    assert calibrated_probability(-0.2, calibration) == 0.0


def test_unapproved_calibration_is_not_usable():
    calibration = Calibration(
        method="identity",
        parameters={},
        operating_points=[],
        validation_metrics={},
        approved=False,
    )
    assert calibrated_probability(0.5, calibration) is None


def test_platt_calibration_is_bounded():
    calibration = Calibration(
        method="platt",
        parameters={"a": 1.0, "b": 0.0},
        operating_points=[],
        validation_metrics={},
        approved=True,
    )
    probability = calibrated_probability(0.0, calibration)
    assert probability == pytest.approx(0.5)


def test_dire_requires_deployment_runtime(monkeypatch):
    monkeypatch.delenv("DIRE_COMMAND", raising=False)
    assert DIREAdapter().available() is False
    with pytest.raises(RuntimeError, match="DIRE_RUNTIME_NOT_CONFIGURED"):
        DIREAdapter().infer("missing.jpg", "out")


def test_forensic_map_serializes_to_png():
    payload = map_to_png(np.array([[0.0, 1.0], [0.5, 0.25]], dtype=np.float32))
    assert payload.startswith(b"\x89PNG\r\n\x1a\n")
