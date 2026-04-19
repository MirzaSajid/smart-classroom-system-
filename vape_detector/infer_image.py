import json
import sys
from pathlib import Path

from ultralytics import YOLO


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "Usage: python infer_image.py <image_path> [confidence]"}))
        return 1

    image_path = Path(sys.argv[1]).resolve()
    confidence = 0.4
    if len(sys.argv) >= 3:
        try:
            confidence = float(sys.argv[2])
        except Exception:
            confidence = 0.4

    if not image_path.exists():
        print(json.dumps({"ok": False, "error": f"Image not found: {image_path}"}))
        return 1

    model_path = Path(__file__).resolve().parent / "best.pt"
    if not model_path.exists():
        print(json.dumps({"ok": False, "error": f"Model not found: {model_path}"}))
        return 1

    model = YOLO(str(model_path))
    results = model.predict(source=str(image_path), conf=confidence, verbose=False)

    detections = []
    for result in results:
        for box in result.boxes:
            cls = int(box.cls[0])
            conf = float(box.conf[0])
            label = model.names.get(cls, str(cls))
            x1, y1, x2, y2 = [float(v) for v in box.xyxy[0]]
            detections.append(
                {
                    "label": label,
                    "confidence": conf,
                    "bbox": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
                }
            )

    vape_detections = [d for d in detections if str(d.get("label", "")).lower() == "vape"]

    print(
        json.dumps(
            {
                "ok": True,
                "totalDetections": len(detections),
                "vapeDetections": len(vape_detections),
                "hasVape": len(vape_detections) > 0,
                "detections": detections,
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
