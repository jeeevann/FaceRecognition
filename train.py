import os
import cv2
import face_recognition
import pickle
import pandas as pd
import numpy as np

# ----------------------------
# Paths
# ----------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STUDENTS_DIR = os.path.join(BASE_DIR, "Students")
STUDENTS_CSV = os.path.join(BASE_DIR, "students.csv")
ENCODINGS_PATH = os.path.join(BASE_DIR, "encodings.pkl")

# ----------------------------
# Load Student Data
# ----------------------------
students_df = pd.read_csv(STUDENTS_CSV)
valid_names = set(students_df["Name"].values)

# ----------------------------
# Prepare Encodings
# ----------------------------
known_encodings = []
known_names = []
baseline_encodings = {}  # store average encoding per student

print("[INFO] Training started...")

for student_name in os.listdir(STUDENTS_DIR):
    student_path = os.path.join(STUDENTS_DIR, student_name)

    if not os.path.isdir(student_path):
        continue

    # Check if student name exists in CSV
    if student_name not in valid_names:
        print(f"[WARNING] '{student_name}' folder does not match any Name in students.csv!")
        continue

    print(f"[PROCESSING] {student_name}...")

    student_encodings = []

    for img_name in os.listdir(student_path):
        img_path = os.path.join(student_path, img_name)
        img = cv2.imread(img_path)
        if img is None:
            print(f"[SKIPPED] {img_name} (invalid image)")
            continue

        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        boxes = face_recognition.face_locations(rgb_img)
        encodings = face_recognition.face_encodings(rgb_img, boxes)

        for enc in encodings:
            known_encodings.append(enc)
            known_names.append(student_name)
            student_encodings.append(enc)

    if student_encodings:
        # Compute average encoding for fuzzy baseline
        baseline_encodings[student_name] = np.mean(student_encodings, axis=0)
        print(f"[INFO] Baseline encoding computed for {student_name}")

print(f"[INFO] Training completed. Encoded {len(known_names)} faces.")

# ----------------------------
# Save Encodings + Baseline
# ----------------------------
with open(ENCODINGS_PATH, "wb") as f:
    pickle.dump((known_encodings, known_names, baseline_encodings), f)

print(f"[INFO] Encodings saved to {ENCODINGS_PATH}")
