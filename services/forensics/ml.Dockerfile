FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY ml-requirements.txt .
RUN pip3 install --no-cache-dir -r ml-requirements.txt

COPY ml_service.py .
COPY ml ./ml

EXPOSE 8080
CMD ["uvicorn", "ml_service:app", "--host", "0.0.0.0", "--port", "8080"]
