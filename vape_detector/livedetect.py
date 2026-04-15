import cv2
from ultralytics import YOLO
import time

# ── Load model ────────────────────────────────────────────
print("🔄 Loading model...")
model = YOLO("best.pt")
print("✅ Model loaded!")

# ── Open webcam ───────────────────────────────────────────
cap = cv2.VideoCapture(0)  # 0 = default webcam

if not cap.isOpened():
    print("❌ Cannot open webcam! Try changing 0 to 1")
    exit()

print("✅ Webcam started!")
print("👉 Press Q to quit\n")

# ── FPS counter setup ─────────────────────────────────────
prev_time = 0

while True:
    ret, frame = cap.read()

    if not ret:
        print("❌ Failed to read frame!")
        break

    # ── Run detection ─────────────────────────────────────
    results = model.predict(
        source=frame,
        conf=0.4,
        verbose=False
    )

    # ── Draw detections ───────────────────────────────────
    vape_count = 0

    for result in results:
        for box in result.boxes:
            cls   = int(box.cls[0])
            conf  = float(box.conf[0])
            label = model.names[cls]

            # ── Only detect vape ──────────────────────────
            if label != "vape":
                continue

            vape_count += 1
            x1, y1, x2, y2 = map(int, box.xyxy[0])

            # Draw bounding box (red)
            cv2.rectangle(frame, (x1,y1), (x2,y2), (0,0,255), 2)

            # Draw label background
            cv2.rectangle(frame, (x1, y1-35), (x1+150, y1), (0,0,255), -1)

            # Draw label text
            text = f"VAPE {conf*100:.1f}%"
            cv2.putText(frame, text, (x1+5, y1-10),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.7, (255,255,255), 2)

    # ── Calculate FPS ─────────────────────────────────────
    curr_time = time.time()
    fps = 1 / (curr_time - prev_time + 0.001)
    prev_time = curr_time

    # ── Show FPS on screen ────────────────────────────────
    cv2.putText(frame, f"FPS: {int(fps)}", (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,255,0), 2)

    # ── Show vape count ───────────────────────────────────
    cv2.putText(frame, f"Vape Detected: {vape_count}", (10, 65),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,0,255) if vape_count > 0 else (255,255,255), 2)

    # ── Show alert if vape detected ───────────────────────
    if vape_count > 0:
        cv2.putText(frame, "⚠ ALERT: VAPE DETECTED!", (10, 110),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0,0,255), 3)

    # ── Show instructions ─────────────────────────────────
    cv2.putText(frame, "Press Q to quit", (10, frame.shape[0]-10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,255), 1)

    # ── Display frame ─────────────────────────────────────
    cv2.imshow("🔍 Live Vape Detection", frame)

    # ── Press Q to quit ───────────────────────────────────
    if cv2.waitKey(1) & 0xFF == ord('q'):
        print("\n👋 Quitting...")
        break

# ── Cleanup ───────────────────────────────────────────────
cap.release()
cv2.destroyAllWindows()
print("✅ Done!")