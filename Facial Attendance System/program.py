import sys
import argparse

try:
    import face_recognition
except ModuleNotFoundError as e:
    raise ModuleNotFoundError(
        "Missing dependency: face_recognition.\n\n"
        "Install (Windows):\n"
        "  1) Install 'Visual Studio Build Tools' with 'Desktop development with C++'\n"
        "  2) Then run:\n"
        "     python -m pip install --upgrade pip\n"
        "     python -m pip install cmake face-recognition\n\n"
        "Verify:\n"
        "  python -c \"import face_recognition; print('OK')\"\n"
    ) from e

import cv2
import numpy as np
import csv
import os
from pathlib import Path
from datetime import datetime
import re
import pickle

# Ensure Windows console can print unicode symbols like ✓
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

print("✓ Loading Face Recognition System...")

# Ensure the program always runs relative to this file's folder (double-click safe)
BASE_DIR = Path(__file__).resolve().parent
os.chdir(BASE_DIR)

parser = argparse.ArgumentParser(add_help=False)
parser.add_argument("--class-id", default=None)
parser.add_argument("--class-name", default=None)
_args, _unknown = parser.parse_known_args()

# Dictionaries to store encodings and metadata
known_face_encodings = []
known_face_names = []
known_face_rolls = []

ENCODINGS_FILE = str(BASE_DIR / "face_encodings.pkl")
IMAGES_DIR = str(BASE_DIR / "images")
ATTENDANCE_DIR = str(BASE_DIR / "attendance")
os.makedirs(ATTENDANCE_DIR, exist_ok=True)

def extract_roll_number(filename):
    """Extract roll number from filename (e.g., 001_john.jpg -> 001)"""
    match = re.search(r'(\d+)', filename)
    return match.group(1) if match else "N/A"

def extract_student_name(filename):
    """Extract student name from filename (e.g., 001_john.jpg -> john)"""
    # Remove extension
    name = os.path.splitext(filename)[0]
    # Split by underscore and take the part after it
    parts = name.split('_')
    if len(parts) > 1:
        # Return everything after the first underscore
        return '_'.join(parts[1:])
    return name

def save_encodings():
    """Save encodings to file for faster loading next time"""
    data = {
        'encodings': known_face_encodings,
        'names': known_face_names,
        'rolls': known_face_rolls
    }
    with open(ENCODINGS_FILE, 'wb') as f:
        pickle.dump(data, f)
    print(f"✓ Encodings cached to {ENCODINGS_FILE}")

def load_encodings_from_cache():
    """Load encodings from cache file if it exists"""
    if os.path.exists(ENCODINGS_FILE):
        try:
            with open(ENCODINGS_FILE, 'rb') as f:
                data = pickle.load(f)
            global known_face_encodings, known_face_names, known_face_rolls
            known_face_encodings = data['encodings']
            known_face_names = data['names']
            known_face_rolls = data['rolls']
            print(f"✓ Loaded {len(known_face_names)} faces from cache")
            return True
        except:
            print("⚠ Cache corrupted, regenerating...")
            return False
    return False

def check_for_new_images(images_folder):
    """Check if there are new images not in cache"""
    image_files = []
    for filename in sorted(os.listdir(images_folder)):
        if filename.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp')):
            student_name = extract_student_name(filename)
            image_files.append(student_name)
    
    # Find new images not in cache
    new_images = []
    for name in image_files:
        if name not in known_face_names:
            new_images.append(name)
    
    return new_images

def check_for_deleted_images(images_folder):
    """Check if any cached images have been deleted"""
    image_files = []
    for filename in sorted(os.listdir(images_folder)):
        if filename.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp')):
            student_name = extract_student_name(filename)
            image_files.append(student_name)
    
    # Find deleted images (in cache but not in folder)
    deleted_images = []
    for name in known_face_names:
        if name not in image_files:
            deleted_images.append(name)
    
    return deleted_images

def remove_deleted_images(deleted_images):
    """Remove deleted images from encoding cache"""
    if not deleted_images:
        return
    
    print(f"\n🗑️  Found {len(deleted_images)} deleted image(s)! Removing from cache...")
    
    for name in deleted_images:
        try:
            index = known_face_names.index(name)
            known_face_names.pop(index)
            known_face_encodings.pop(index)
            known_face_rolls.pop(index)
            print(f"  ✓ REMOVED: {name}")
        except:
            pass
    
    save_encodings()
    print(f"✓ Cache cleaned: removed {len(deleted_images)} image(s)")

def add_new_images(images_folder, new_images):
    """Add new images to encoding cache"""
    if not new_images:
        return
    
    print(f"\n📂 Found {len(new_images)} new image(s)! Encoding them...")
    
    for filename in sorted(os.listdir(images_folder)):
        if filename.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp')):
            student_name = extract_student_name(filename)
            
            if student_name in new_images:
                roll_no = extract_roll_number(filename)
                filepath = os.path.join(images_folder, filename)
                
                try:
                    image = face_recognition.load_image_file(filepath)
                    face_encodings = face_recognition.face_encodings(image)
                    
                    if face_encodings:
                        known_face_encodings.append(face_encodings[0])
                        known_face_names.append(student_name)
                        known_face_rolls.append(roll_no)
                        print(f"  ✓ NEW: {student_name} (Roll: {roll_no})")
                    else:
                        print(f"  ✗ No face in {filename}")
                except Exception as e:
                    print(f"  ✗ Error: {str(e)[:60]}")
    
    save_encodings()
    print(f"✓ Cache updated with {len(new_images)} new image(s)")

def load_and_encode_faces(images_folder):
    """Load images and create face encodings"""
    print(f"\n📂 Loading images from {images_folder}/...")
    count = 0
    
    for filename in sorted(os.listdir(images_folder)):
        if filename.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp')):
            student_name = extract_student_name(filename)
            roll_no = extract_roll_number(filename)
            filepath = os.path.join(images_folder, filename)
            
            try:
                # Load image file
                image = face_recognition.load_image_file(filepath)
                
                # Get face encodings from image
                face_encodings = face_recognition.face_encodings(image)
                
                if face_encodings:
                    # Store the encoding and name
                    known_face_encodings.append(face_encodings[0])
                    known_face_names.append(student_name)
                    known_face_rolls.append(roll_no)
                    count += 1
                    print(f"  ✓ Encoded: {student_name} (Roll: {roll_no})")
                else:
                    print(f"  ✗ No face found in {filename}")
                    
            except Exception as e:
                print(f"  ✗ Error with {filename}: {str(e)[:60]}")
    
    if count > 0:
        save_encodings()

# Try loading cached encodings first (instant)
if not load_encodings_from_cache():
    # If no cache, generate encodings (first time only)
    load_and_encode_faces(IMAGES_DIR)
else:
    # Cache loaded, check for changes
    deleted_images = check_for_deleted_images(IMAGES_DIR)
    if deleted_images:
        remove_deleted_images(deleted_images)
    
    new_images = check_for_new_images(IMAGES_DIR)
    if new_images:
        add_new_images(IMAGES_DIR, new_images)
    else:
        if not deleted_images:
            print("✓ No changes in images")

if len(known_face_names) == 0:
    print("❌ No faces loaded! Check your images folder.")
    exit()

print(f"\n✓ Total students loaded: {len(known_face_names)}")

# Open webcam
video_capture = cv2.VideoCapture(0)
video_capture.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
video_capture.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
print("✓ Camera started")

# Create CSV file with timestamp (new file for every run)
safe_class = ""
if _args.class_id or _args.class_name:
    raw = (_args.class_name or _args.class_id or "").strip()
    safe = re.sub(r"[^a-zA-Z0-9 _-]+", "", raw).strip().replace(" ", "_")
    safe_class = f"_{safe}" if safe else ""
csv_filename = os.path.join(ATTENDANCE_DIR, datetime.now().strftime("%Y-%m-%d_%H-%M-%S") + safe_class + ".csv")
csv_file = open(csv_filename, 'w+', newline='')
csv_writer = csv.writer(csv_file)
csv_writer.writerow(['Roll No', 'Name', 'Time', 'Confidence'])

# Track marked students
marked_students = {}
DUPLICATE_THRESHOLD = 3600  # 1 hour - prevent same person marking multiple times

print(f"✓ Output: {csv_filename}")
print("\n🎥 Starting... Press 'q' to quit\n")

frame_count = 0
process_this_frame = True
face_locations = []
face_names = []
face_confidences = []

try:
    while True:
        ret, frame = video_capture.read()
        if not ret:
            print("Error reading frame")
            break
        
        frame_count += 1
        process_this_frame = (frame_count % 3 == 0)  # Process every 3rd frame for speed
        
        # Process every 3rd frame for speed
        if process_this_frame:
            # Resize frame for faster processing
            small_frame = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)
            rgb_small_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
            
            # Find all faces and face encodings in current frame (using HOG for speed)
            try:
                face_locations = face_recognition.face_locations(rgb_small_frame, model='hog')
                face_encodings = face_recognition.face_encodings(rgb_small_frame, face_locations, num_jitters=0)
            except Exception as e:
                face_locations = []
                face_encodings = []
                continue
            
            face_names = []
            face_confidences = []
            
            # Compare faces
            for face_encoding in face_encodings:
                try:
                    # Compare with known faces
                    matches = face_recognition.compare_faces(
                        known_face_encodings, 
                        face_encoding,
                        tolerance=0.65  # Higher = faster, more lenient (0.6 is default)
                    )
                    name = "Unknown"
                    confidence = 0.0
                    roll_no = "N/A"
                    
                    # Calculate face distances
                    face_distances = face_recognition.face_distance(known_face_encodings, face_encoding)
                    
                    if len(face_distances) > 0:
                        best_match_index = np.argmin(face_distances)
                        
                        if matches[best_match_index]:
                            name = known_face_names[best_match_index]
                            roll_no = known_face_rolls[best_match_index]
                            confidence = 1 - face_distances[best_match_index]
                    
                    face_names.append(name)
                    face_confidences.append(confidence)
                    
                    # Mark attendance if high confidence
                    if name != "Unknown" and confidence > 0.5:
                        current_time = datetime.now()
                        
                        if name not in marked_students:
                            # First time marking this person
                            marked_students[name] = current_time
                            time_str = current_time.strftime("%H:%M:%S")
                            csv_writer.writerow([roll_no, name, time_str, f"{confidence:.2f}"])
                            csv_file.flush()
                            print(f"✓ MARKED: {roll_no} - {name} (Confidence: {confidence:.2f})")
                        else:
                            # Check if enough time has passed (1 hour)
                            time_diff = (current_time - marked_students[name]).total_seconds()
                            if time_diff > DUPLICATE_THRESHOLD:
                                # More than 1 hour passed, mark again
                                marked_students[name] = current_time
                                time_str = current_time.strftime("%H:%M:%S")
                                csv_writer.writerow([roll_no, name, time_str, f"{confidence:.2f}"])
                                csv_file.flush()
                                print(f"✓ RE-MARKED: {roll_no} - {name} (Confidence: {confidence:.2f})")
                            # else: Already marked recently, skip
                                
                except Exception as e:
                    face_names.append("Unknown")
                    face_confidences.append(0.0)
                    continue
        
        # Display results
        for (top, right, bottom, left), name, confidence in zip(face_locations, face_names, face_confidences):
            # Scale back up face locations
            top *= 4
            right *= 4
            bottom *= 4
            left *= 4
            
            # Draw box
            if name == "Unknown":
                color = (0, 0, 255)
                label = f"Unknown ({confidence:.2f})"
            else:
                color = (0, 255, 0)
                label = f"{name}"
            
            cv2.rectangle(frame, (left, top), (right, bottom), color, 2)
            
            # Draw label
            cv2.rectangle(frame, (left, bottom - 35), (right, bottom), color, cv2.FILLED)
            cv2.putText(frame, label, (left + 6, bottom - 6), cv2.FONT_HERSHEY_DUPLEX, 0.8, (255, 255, 255), 1)
        
        # Display status
        cv2.putText(frame, f"Marked: {len(marked_students)}", (10, 35), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        cv2.putText(frame, "Press 'q' to quit", (10, frame.shape[0] - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 1)
        
        cv2.imshow('Attendance System', frame)
        
        # Exit on 'q'
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

except KeyboardInterrupt:
    print("\nInterrupted...")

finally:
    print("\n✓ Saving attendance...")
    video_capture.release()
    cv2.destroyAllWindows()
    csv_file.close()
    
    print(f"✓ Attendance saved to: {csv_filename}")
    print(f"✓ Total students marked: {len(marked_students)}")
    print("✓ Done!")
