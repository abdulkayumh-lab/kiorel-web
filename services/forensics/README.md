# KIOREL Forensics Data Plane

This service is the forensic worker/data-plane foundation for KIOREL.

## Pipeline

1. Ingest and SHA-256 verification
2. C2PA + ExifTool provenance inspection
3. Signal-domain diagnostics: ELA, FFT, DCT, noise residual, CFA
4. Neural inference boundary
5. Evidence fusion
6. Report generation

## Neural inference

KIOREL keeps GPU inference separate from the Supabase polling worker.

The current adapter targets the official TruFor inference contract. TruFor documents image-level score, localization and confidence outputs, and provides a Docker inference path with pinned model weights.

KIOREL does not bundle third-party weights into the repository. Set TRUFOR_COMMAND in the GPU inference deployment to the approved, pinned runtime command and set TRUFOR_MODEL_VERSION to the exact model/checkpoint identifier.

A model may be registered in detector_models, but it must not be treated as calibrated evidence until an approved calibration row exists in detector_calibrations.

### Calibration contract

Supported calibration methods currently include:

- identity
- platt

Every approved calibration should record the dataset/version, validation metrics, operating points, and calibration version.

### Forensic limitation

TruFor is an image-forgery localization system, not universal proof that an image is AI-generated. KIOREL therefore stores its output as model evidence and keeps the final assessment separate from any single detector score.

Runtime, model and checkpoint versions are recorded because inference results can vary across software and CUDA environments.
