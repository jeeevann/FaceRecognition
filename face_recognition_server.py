import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from recognize import FaceRecognitionSystem
import logging

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global face recognition system instance
face_recognition_system = None

def initialize_system():
    """Initialize the face recognition system"""
    global face_recognition_system
    try:
        face_recognition_system = FaceRecognitionSystem()
        logger.info("Face recognition system initialized successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize face recognition system: {e}")
        return False

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    try:
        if face_recognition_system is None:
            if not initialize_system():
                return jsonify({'ok': False, 'error': 'System not initialized'}), 500
        
        return jsonify({
            'ok': True, 
            'message': 'Face Recognition Server is running',
            'students_loaded': len(face_recognition_system.students_df),
            'encodings_loaded': len(face_recognition_system.known_names)
        }), 200
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500

@app.route('/recognize', methods=['POST'])
def recognize():
    """Face recognition endpoint"""
    try:
        # Initialize system if not already done
        if face_recognition_system is None:
            if not initialize_system():
                return jsonify({'success': False, 'error': 'System not initialized'}), 500
        
        # Get request data
        data = request.get_json()
        if not data or 'image_data' not in data:
            return jsonify({'success': False, 'error': 'No image data provided'}), 400
        
        image_data = data['image_data']
        meta = data.get('meta', {})
        
        # Perform face recognition
        result = face_recognition_system.recognize_face_from_image(image_data)
        
        if not result['success']:
            return jsonify(result), 400
        
        # Format response to match expected frontend format
        response = {
            'success': True,
            'name': result['name'],
            'roll_no': result['roll_no'],
            'similarity': result['confidence'] / 100.0,  # Convert to 0-1 scale
            'confidence': result['confidence'],
            'decision': result['decision'],
            'status': result['status'],
            'attendance_marked': result['attendance_marked'],
            'already_marked': result['already_marked'],
            'meta': meta
        }
        
        logger.info(f"Recognition result: {result['name']} ({result['confidence']}%) - {result['status']}")
        
        return jsonify(response), 200
        
    except Exception as e:
        logger.error(f"Recognition error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/reload', methods=['POST'])
def reload_system():
    """Reload the face recognition system (useful after training new faces)"""
    try:
        global face_recognition_system
        face_recognition_system = None
        
        if initialize_system():
            return jsonify({'success': True, 'message': 'System reloaded successfully'}), 200
        else:
            return jsonify({'success': False, 'error': 'Failed to reload system'}), 500
            
    except Exception as e:
        logger.error(f"Reload error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/attendance/today', methods=['GET'])
def get_today_attendance():
    """Get today's attendance records"""
    try:
        if face_recognition_system is None:
            if not initialize_system():
                return jsonify({'success': False, 'error': 'System not initialized'}), 500
        
        import pandas as pd
        from datetime import datetime
        
        today_date = datetime.now().date()
        attendance_file = os.path.join(face_recognition_system.ATTENDANCE_DIR, f"attendance_{today_date}.csv")
        
        if not os.path.exists(attendance_file):
            return jsonify({'success': True, 'records': []}), 200
        
        df = pd.read_csv(attendance_file)
        records = df.to_dict('records')
        
        return jsonify({'success': True, 'records': records}), 200
        
    except Exception as e:
        logger.error(f"Error fetching attendance: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    # Initialize the system on startup
    if initialize_system():
        print("[INFO] Starting Face Recognition Server on http://127.0.0.1:5001")
        app.run(host='127.0.0.1', port=5001, debug=True)
    else:
        print("[ERROR] Failed to initialize face recognition system")
        print("[INFO] Make sure you have:")
        print("  1. encodings.pkl file (run train.py first)")
        print("  2. students.csv file with student data")
        exit(1)
