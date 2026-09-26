FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1     PYTHONUNBUFFERED=1

WORKDIR /app

COPY worker-requirements.txt .
RUN pip install --no-cache-dir -r worker-requirements.txt

COPY worker.py .

CMD ["python", "worker.py"]
