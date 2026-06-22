from fastapi import FastAPI, File, UploadFile

from .detector import detect_potholes

app = FastAPI(title="PotholeNet ML Service")


@app.get("/health")
def health():
    return {"status": "ok", "model": "placeholder"}


@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    image_bytes = await file.read()
    return detect_potholes(image_bytes)
