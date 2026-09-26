FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends exiftool \
    && rm -rf /var/lib/apt/lists/*

COPY worker-requirements.txt .
RUN pip install --no-cache-dir -r worker-requirements.txt

COPY worker.py .
COPY provenance.py .
COPY detectors ./detectors

CMD ["python", "worker.py"]
