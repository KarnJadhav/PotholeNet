from io import BytesIO

from PIL import Image


def detect_potholes(image_bytes: bytes):
    Image.open(BytesIO(image_bytes)).verify()

    return {
        "detections": [
            {
                "class": "pothole",
                "confidence": 0.88,
                "severity": "medium",
                "bbox": [0.32, 0.42, 0.61, 0.74],
            }
        ],
        "model": "placeholder-yolo",
    }
