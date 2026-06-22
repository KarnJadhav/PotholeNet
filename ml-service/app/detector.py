import os
from io import BytesIO

from PIL import Image

MODEL_PATH = os.getenv("YOLO_MODEL_PATH", "models/pothole-yolov8n.pt")
_model = None


def get_model():
    global _model

    if _model is not None:
        return _model

    if not os.path.exists(MODEL_PATH):
        return None

    from ultralytics import YOLO

    _model = YOLO(MODEL_PATH)
    return _model


def estimate_severity(confidence: float, bbox):
    width = max(0, bbox[2] - bbox[0])
    height = max(0, bbox[3] - bbox[1])
    area = width * height

    if confidence >= 0.85 or area >= 0.18:
        return "severe"
    if confidence >= 0.65 or area >= 0.08:
        return "medium"
    return "minor"


def bbox_area(bbox):
    width = max(0, bbox[2] - bbox[0])
    height = max(0, bbox[3] - bbox[1])
    return round(width * height, 4)


def detect_potholes(image_bytes: bytes):
    image = Image.open(BytesIO(image_bytes)).convert("RGB")
    model = get_model()

    if model is not None:
        results = model.predict(image, conf=0.35, verbose=False)
        detections = []

        for result in results:
            names = result.names
            width, height = image.size

            for box in result.boxes:
                class_name = names[int(box.cls[0])]
                confidence = float(box.conf[0])

                if class_name.lower() not in {"pothole", "road_damage", "crack"}:
                    continue

                x1, y1, x2, y2 = [float(value) for value in box.xyxy[0]]
                bbox = [x1 / width, y1 / height, x2 / width, y2 / height]
                detections.append(
                    {
                        "class": "pothole" if class_name.lower() != "crack" else "crack",
                        "confidence": confidence,
                        "severity": estimate_severity(confidence, bbox),
                        "area": bbox_area(bbox),
                        "bbox": bbox,
                    }
                )

        return {"detections": detections, "model": os.path.basename(MODEL_PATH)}

    return {
        "detections": [
            {
                "class": "pothole",
                "confidence": 0.88,
                "severity": "medium",
                "area": 0.0952,
                "bbox": [0.32, 0.42, 0.61, 0.74],
            }
        ],
        "model": "placeholder-yolo-no-model-file",
    }
