from fastapi import FastAPI

app = FastAPI(title="KIOREL Forensics", version="1.0.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "kiorel-forensics"}


@app.get("/ready")
def ready() -> dict[str, str]:
    return {"status": "ready", "service": "kiorel-forensics"}
