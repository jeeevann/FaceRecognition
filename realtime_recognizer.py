import os
import time
import cv2
import numpy as np
import mysql.connector as mysql
from datetime import datetime
from typing import Dict

import tensorflow as tf
from tensorflow.keras.models import load_model
from sklearn.metrics.pairwise import cosine_similarity

# Reuse fuzzy logic from the training script (inlined here for convenience)
import skfuzzy as fuzz


def build_fuzzy_system():
    x_sim = np.linspace(-1.0, 1.0, 201)
    low = fuzz.trapmf(x_sim, [-1.0, -1.0, 0.0, 0.4])
    med = fuzz.trimf(x_sim, [0.2, 0.5, 0.8])
    high = fuzz.trapmf(x_sim, [0.6, 0.75, 1.0, 1.0])
    return { 'x_sim': x_sim, 'low': low, 'med': med, 'high': high }


def fuzzy_decide_attendance(similarity: float, fuzzy: Dict[str, np.ndarray]):
    x = similarity
    deg_low = fuzz.interp_membership(fuzzy['x_sim'], fuzzy['low'], x)
    deg_med = fuzz.interp_membership(fuzzy['x_sim'], fuzzy['med'], x)
    deg_high = fuzz.interp_membership(fuzzy['x_sim'], fuzzy['high'], x)
    numerator = deg_high * 1.0 + deg_med * 0.6 + deg_low * 0.0
    denom = deg_high + deg_med + deg_low + 1e-8
    score = numerator / denom
    decision = 'present' if score >= 0.8 else ('uncertain' if score >= 0.4 else 'absent')
    return decision, float(score)


# Face detector
face_detector = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')


def preprocess_face(frame_bgr, target_size=(96,96)):
    gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    faces = face_detector.detectMultiScale(gray, 1.1, 5)
    if len(faces) == 0:
        roi = cv2.resize(frame_bgr, target_size)
    else:
        faces = sorted(faces, key=lambda f: f[2]*f[3], reverse=True)
        x,y,w,h = faces[0]
        roi = frame_bgr[y:y+h, x:x+w]
        roi = cv2.resize(roi, target_size)
    roi = cv2.cvtColor(roi, cv2.COLOR_BGR2RGB)
    roi = roi.astype('float32')/255.0
    return roi


def load_gallery(gallery_vec_path: str, names_path: str):
    vecs = np.load(gallery_vec_path)
    names = np.load(names_path, allow_pickle=True)
    return { str(names[i]): vecs[i] for i in range(len(names)) }


def recognize_embedding(embedding: np.ndarray, gallery: Dict[str, np.ndarray]):
    names = list(gallery.keys())
    mat = np.stack([gallery[n] for n in names], axis=0)
    sims = cosine_similarity([embedding], mat)[0]
    bi = int(np.argmax(sims))
    return names[bi], float(sims[bi])


def insert_attendance(db, student_id: int, teacher_id: int, department: str, year: str, division: str, time_slot: str):
    cur = db.cursor()
    cur.execute(
        """
        INSERT INTO attendance (student_id, teacher_id, department, year, division, time_slot, attendance_date)
        VALUES (%s,%s,%s,%s,%s,%s,%s)
        """,
        (student_id, teacher_id, department, year, division, time_slot, datetime.now().strftime('%Y-%m-%d'))
    )
    db.commit()
    cur.close()


def get_student_id_by_name(db, name: str):
    cur = db.cursor()
    cur.execute("SELECT id FROM students WHERE name=%s LIMIT 1", (name,))
    row = cur.fetchone()
    cur.close()
    return int(row[0]) if row else None


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--model_path', default='./models/embedding_model.h5')
    ap.add_argument('--gallery_vecs', default='./models/gallery_embeddings.npy')
    ap.add_argument('--gallery_names', default='./models/gallery_embeddings.npy.names.npy')
    ap.add_argument('--camera', type=int, default=0)
    ap.add_argument('--teacher_id', type=int, default=1)
    ap.add_argument('--department', default='Computer')
    ap.add_argument('--year', default='FY')
    ap.add_argument('--division', default='A')
    ap.add_argument('--time_slot', default='9:00 - 10:00')
    ap.add_argument('--mysql_host', default='localhost')
    ap.add_argument('--mysql_db', default='smart_attendance')
    ap.add_argument('--mysql_user', default='root')
    ap.add_argument('--mysql_pass', default='')
    args = ap.parse_args()

    # Load model and gallery
    model = load_model(args.model_path, compile=False)
    gallery = load_gallery(args.gallery_vecs, args.gallery_names)
    fuzzy = build_fuzzy_system()

    # MySQL connection
    db = mysql.connect(host=args.mysql_host, user=args.mysql_user, password=args.mysql_pass, database=args.mysql_db)

    cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        raise RuntimeError('Cannot open camera')

    try:
        last_marked = {}
        cooldown_sec = 30
        while True:
            ok, frame = cap.read()
            if not ok:
                break

            face = preprocess_face(frame)
            emb = model.predict(np.expand_dims(face, 0))[0]
            name, sim = recognize_embedding(emb, gallery)
            decision, score = fuzzy_decide_attendance(sim, fuzzy)

            # Draw UI
            h, w = frame.shape[:2]
            cv2.putText(frame, f"{name} sim={sim:.2f} dec={decision} score={score:.2f}", (10, h-10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,255,0) if decision=='present' else (0,255,255) if decision=='uncertain' else (0,0,255), 2)
            cv2.imshow('Realtime Face Recognition', frame)

            # Auto-insert attendance when confident and cooldown passed
            now = time.time()
            if decision == 'present' and (name not in last_marked or now - last_marked[name] > cooldown_sec):
                student_id = get_student_id_by_name(db, name)
                if student_id:
                    insert_attendance(db, student_id, args.teacher_id, args.department, args.year, args.division, args.time_slot)
                    last_marked[name] = now
                    print(f"Attendance marked for {name}")

            key = cv2.waitKey(1) & 0xFF
            if key == 27 or key == ord('q'):
                break
    finally:
        cap.release()
        cv2.destroyAllWindows()
        db.close()


if __name__ == '__main__':
    main()
