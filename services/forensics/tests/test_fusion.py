from evidence.fusion import FUSION_VERSION, fuse


def test_no_evidence_is_insufficient():
    result = fuse([], [], [])
    assert result.classification == "INSUFFICIENT_EVIDENCE"
    assert result.confidence is None


def test_pixel_signals_do_not_become_probability():
    evidence = [{
        "category": "pixel",
        "detector": "ela",
        "finding": "recompression_delta_available",
        "score": 0.99,
        "strength": "strong",
    }]
    result = fuse(evidence, [], [])
    assert result.classification == "AUTHENTICITY_UNDETERMINED"
    assert result.confidence is None
    assert result.decision_basis["quantitative_score_used"] is False


def test_single_calibrated_detector_can_recommend_review_without_confidence():
    detector_runs = [{
        "detector_name": "trufor",
        "status": "complete",
        "score": 0.91,
        "metadata": {
            "calibration_approved": True,
            "score_semantics": "manipulation_probability",
        },
    }]
    result = fuse([], [], detector_runs)
    assert result.classification == "REVIEW_RECOMMENDED"
    assert result.confidence is None


def test_two_calibrated_detectors_can_trigger_high_confidence_manipulation_evidence():
    detector_runs = [
        {
            "detector_name": "trufor",
            "status": "complete",
            "score": 0.99,
            "metadata": {
                "calibration_approved": True,
                "score_semantics": "manipulation_probability",
            },
        },
        {
            "detector_name": "dire",
            "status": "complete",
            "score": 0.98,
            "metadata": {
                "calibration_approved": True,
                "score_semantics": "manipulation_probability",
            },
        },
    ]
    result = fuse([], [], detector_runs)
    assert result.classification == "MANIPULATION_EVIDENCE_DETECTED"
    assert result.confidence is not None
    assert result.confidence >= 0.95


def test_unapproved_or_wrong_semantics_are_excluded():
    detector_runs = [
        {
            "detector_name": "unapproved",
            "score": 0.99,
            "metadata": {
                "calibration_approved": False,
                "score_semantics": "manipulation_probability",
            },
        },
        {
            "detector_name": "auth-score",
            "score": 0.99,
            "metadata": {
                "calibration_approved": True,
                "score_semantics": "authenticity_probability",
            },
        },
    ]
    result = fuse([], [], detector_runs)
    assert result.decision_basis["calibrated_detector_count"] == 0
    assert result.confidence is None


def test_c2pa_absence_is_neutral():
    result = fuse(
        [{"category": "pixel", "detector": "ela", "finding": "measurement_complete", "score": 0.1, "strength": "informational"}],
        [{"source": "c2pa", "status": "no_manifest"}],
        [],
    )
    assert result.classification == "AUTHENTICITY_UNDETERMINED"
    assert any("absence of C2PA" in c.lower() or "no verified c2pa" in c.lower() for c in result.limitations)


def test_snapshot_hash_is_reproducible():
    result_a = fuse(
        [{"category": "pixel", "detector": "ela", "finding": "x", "score": 0.1, "strength": "informational"}],
        [],
        [],
    )
    result_b = fuse(
        [{"category": "pixel", "detector": "ela", "finding": "x", "score": 0.1, "strength": "informational"}],
        [],
        [],
    )
    assert result_a.evidence_snapshot_hash == result_b.evidence_snapshot_hash
    assert result_a.decision_basis["fusion_version"] == FUSION_VERSION
