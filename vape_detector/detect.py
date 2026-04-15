import cv2
import os
import glob
from ultralytics import YOLO

# ── Load your trained model ───────────────────────────────
model = YOLO("best.pt")  # make sure best.pt is in same folder

# ── Class colors ──────────────────────────────────────────
COLORS = {
    "battery": (255, 150, 0),   # orange
    "vape":    (0, 0, 255),     # red
}

# ── Get all unseen images ─────────────────────────────────
image_folder = "test_images"
images = glob.glob(f"{image_folder}/*")
images = [i for i in images if i.endswith(('image1.jpg'))]

if len(images) == 0:
    print("❌ No images found in test_images folder!")
    exit()

print(f"📸 Found {len(images)} images to test\n")

# ── Create output folder ──────────────────────────────────
os.makedirs("output_predictions", exist_ok=True)

# ── Process each image ────────────────────────────────────
for img_path in images:
    img_name = os.path.basename(img_path)
    frame    = cv2.imread(img_path)

    if frame is None:
        print(f"⚠️  Could not read: {img_name}")
        continue

    # Run prediction
    results = model.predict(
        source=frame,
        conf=0.4,
        verbose=False
    )

    print(f"\n🖼️  Image: {img_name}")
    print(f"{'='*40}")

    # Draw boxes
    detected = False
    for result in results:
        if len(result.boxes) == 0:
            print("   ⚠️  Nothing detected!")
            continue

        for box in result.boxes:
            cls   = int(box.cls[0])
            conf  = float(box.conf[0])
            label = model.names[cls]
            color = COLORS.get(label, (0,255,0))
            x1, y1, x2, y2 = map(int, box.xyxy[0])

            # Draw box
            cv2.rectangle(frame, (x1,y1), (x2,y2), color, 2)

            # Draw label
            text = f"{label} {conf*100:.1f}%"
            cv2.putText(frame, text, (x1, y1-10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

            print(f"   ✅ {label} → {conf*100:.1f}% confidence")
            detected = True

    # Save output image
    out_path = f"output_predictions/{img_name}"
    cv2.imwrite(out_path, frame)
    print(f"   💾 Saved → {out_path}")

print(f"\n✅ All done! Check 'output_predictions/' folder")