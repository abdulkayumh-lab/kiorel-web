# KIOREL Forensics Service

This service is the compute plane for media provenance and forensic analysis.

The Next.js application remains the control plane. It creates media and analysis records, then a worker runtime consumes analysis jobs.

## Pipeline

ingest -> provenance -> pixel analysis -> ML analysis -> evidence fusion -> reporting

The first implementation should remain evidence-first. Detector output is probabilistic and must not be represented as proof of authenticity or AI generation.

## Runtime

- Python 3.12+
- FastAPI for service health/control endpoints
- Redis-compatible queue for jobs
- Supabase/PostgreSQL for durable state
- S3-compatible object storage for media/artifacts
- CPU workers for metadata/classical analysis
- GPU workers for neural detectors
