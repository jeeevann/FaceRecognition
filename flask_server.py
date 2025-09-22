import os
import base64
import io
from datetime import datetime

import numpy as np
import cv2
from flask import Flask, request, jsonify
from flask_cors import CORS
from sklearn.metrics.pairwise import cosine_similarity
import tensorflow as tf
from tensorflow.keras.models import load_model

import mysql.connector as mysql
import skfuzzy as fuzz

app = Flask(__name__)
CORS(app)

# Config via env vars (or defaults)
MODEL_PATH = os.environ.get('FR_MODEL_PATH', './models/embedding_model.h5')
GALLERY_VECS = os.environ.get('FR_GALLERY_VECS', './models/gallery_embeddings.npy')
GALLERY_NAMES = os.environ.get('FR_GALLERY_NAMES', './models/gallery_embeddings.npy.names.npy')

DB_HOST = os.environ.get('DB_HOST', 'localhost')
DB_NAME = os.environ.get('DB_NAME', 'smart_attendance')
DB_USER = os.environ.get('DB_USER', 'root')
DB_PASS = os.environ.get('DB_PASS', '')

# Face detector
face_detector = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')


def build_fuzzy_system():
    x_sim = np.linspace(-1.0, 1.0, 201)
    low = fuzz.trapmf(x_sim, [-1.0, -1.0, 0.0, 0.4])
    med = fuzz.trimf(x_sim, [0.2, 0.5, 0.8])
    high = fuzz.trapmf(x_sim, [0.6, 0.75, 1.0, 1.0])
    return { 'x_sim': x_sim, 'low': low, 'med': med, 'high': high }


def fuzzy_decide_attendance(similarity: float, fuzzy):
    x = similarity
    deg_low = fuzz.interp_membership(fuzzy['x_sim'], fuzzy['low'], x)
    deg_med = fuzz.interp_membership(fuzzy['x_sim'], fuzzy['med'], x)
    deg_high = fuzz.interp_membership(fuzzy['x_sim'], fuzzy['high'], x)
    numerator = deg_high * 1.0 + deg_med * 0.6 + deg_low * 0.0
    denom = deg_high + deg_med + deg_low + 1e-8
    score = numerator / denom
    decision = 'present' if score >= 0.8 else ('uncertain' if score >= 0.4 else 'absent')
    return decision, float(score)


def preprocess_face_b64(data_url: str, target_size=(96,96)):
    # data_url like "data:image/jpeg;base64,..."
    if ',' in data_url:
        b64 = data_url.split(',')[1]
    else:
        b64 = data_url
    img_bytes = base64.b64decode(b64)
    buf = np.frombuffer(img_bytes, dtype=np.uint8)
    img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError('Invalid image data')
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = face_detector.detectMultiScale(gray, 1.1, 5)
    if len(faces) == 0:
        roi = cv2.resize(img, target_size)
    else:
        faces = sorted(faces, key=lambda f: f[2]*f[3], reverse=True)
        x,y,w,h = faces[0]
        roi = img[y:y+h, x:x+w]
        roi = cv2.resize(roi, target_size)
    roi = cv2.cvtColor(roi, cv2.COLOR_BGR2RGB)
    roi = roi.astype('float32')/255.0
    return roi


def load_gallery(vec_path: str, names_path: str):
    vecs = np.load(vec_path)
    names = np.load(names_path, allow_pickle=True)
    return { str(names[i]): vecs[i] for i in range(len(names)) }


def recognize_embedding(embedding: np.ndarray, gallery):
    names = list(gallery.keys())
    mat = np.stack([gallery[n] for n in names], axis=0)
    sims = cosine_similarity([embedding], mat)[0]
    bi = int(np.argmax(sims))
    return names[bi], float(sims[bi]), sims.tolist(), names


# Lazy globals
MODEL = None
GALLERY = None
FUZZY = build_fuzzy_system()


def ensure_loaded():
    global MODEL, GALLERY
    if MODEL is None:
        MODEL = load_model(MODEL_PATH, compile=False)
    if GALLERY is None:
        GALLERY = load_gallery(GALLERY_VECS, GALLERY_NAMES)


def get_db():
    return mysql.connect(host=DB_HOST, user=DB_USER, password=DB_PASS, database=DB_NAME)


def get_student_id_by_name(cur, name: str):
    cur.execute("SELECT id FROM students WHERE name=%s LIMIT 1", (name,))
    row = cur.fetchone()
    return int(row[0]) if row else None


@app.route('/health', methods=['GET'])
def health():
    try:
        ensure_loaded()
        return jsonify({'ok': True, 'classes': len(GALLERY)}), 200
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@app.route('/recognize', methods=['POST'])
def recognize():
    try:
        ensure_loaded()
        payload = request.get_json(force=True)
        image_data = payload.get('image_data')
        meta = payload.get('meta', {})
        teacher_id = int(meta.get('teacher_id') or 1)
        department = meta.get('department') or 'Computer'
        year = meta.get('year') or 'FY'
        division = meta.get('division') or 'A'
        time_slot = meta.get('time_slot') or '9:00 - 10:00'

        face = preprocess_face_b64(image_data)
        emb = MODEL.predict(np.expand_dims(face, 0))[0]
        name, sim, sims, names = recognize_embedding(emb, GALLERY)
        decision, score = fuzzy_decide_attendance(sim, FUZZY)

        # Insert attendance only if present
        inserted = False
        student_id = None
        if decision == 'present':
            db = get_db()
            cur = db.cursor()
            try:
                student_id = get_student_id_by_name(cur, name)
                if student_id:
                    cur.execute(
                        """
                        INSERT INTO attendance (student_id, teacher_id, department, year, division, time_slot, attendance_date)
                        VALUES (%s,%s,%s,%s,%s,%s,%s)
                        """,
                        (student_id, teacher_id, department, year, division, time_slot, datetime.now().strftime('%Y-%m-%d'))
                    )
                    db.commit()
                    inserted = True
            finally:
                cur.close()
                db.close()

        return jsonify({
            'success': True,
            'name': name,
            'similarity': sim,
            'decision': decision,
            'attendance_score': score,
            'student_id': student_id,
            'inserted': inserted,
            'all_similarities': dict(zip(names, sims))
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
