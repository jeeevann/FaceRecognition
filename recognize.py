import cv2
import face_recognition
import pickle
import pandas as pd
from datetime import datetime
import os
import numpy as np
import base64

class FaceRecognitionSystem:
    def __init__(self):
        # ----------------------------
        # Paths
        # ----------------------------
        self.BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        self.ENCODINGS_PATH = os.path.join(self.BASE_DIR, "encodings.pkl")
        self.STUDENTS_CSV = os.path.join(self.BASE_DIR, "students.csv")
        self.ATTENDANCE_DIR = os.path.join(self.BASE_DIR, "AttendanceFiles")
        
        # Create attendance folder if it doesn't exist
        if not os.path.exists(self.ATTENDANCE_DIR):
            os.makedirs(self.ATTENDANCE_DIR)
        
        # Load encodings and students data
        self.load_data()
        
        # Prepare today's attendance file
        self.setup_attendance_file()
    
    def load_data(self):
        """Load face encodings and student data"""
        try:
            with open(self.ENCODINGS_PATH, "rb") as f:
                self.known_encodings, self.known_names, self.baseline_encodings = pickle.load(f)
            
            self.students_df = pd.read_csv(self.STUDENTS_CSV)
            self.students_df["Name"] = self.students_df["Name"].str.strip()
            self.students_df["RollNo"] = self.students_df["RollNo"].astype(str).str.strip()
            
            print(f"[INFO] Loaded {len(self.known_names)} face encodings")
            print(f"[INFO] Loaded {len(self.students_df)} student records")
        except Exception as e:
            print(f"[ERROR] Failed to load data: {e}")
            raise
    
    def setup_attendance_file(self):
        """Setup today's attendance file"""
        today_date = datetime.now().date()
        self.attendance_file = os.path.join(self.ATTENDANCE_DIR, f"attendance_{today_date}.csv")
        
        if not os.path.exists(self.attendance_file):
            with open(self.attendance_file, "w") as f:
                f.write("RollNo,Name,Time,Confidence,Status\n")
        
        # Load already marked students
        try:
            existing_df = pd.read_csv(self.attendance_file)
            self.marked_students = set(existing_df["RollNo"].astype(str).str.strip())
        except:
            self.marked_students = set()
    
    def decode_base64_image(self, image_data):
        """Decode base64 image data to OpenCV format"""
        try:
            # Remove data URL prefix if present
            if ',' in image_data:
                image_data = image_data.split(',')[1]
            
            # Decode base64
            img_bytes = base64.b64decode(image_data)
            nparr = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            return frame
        except Exception as e:
            print(f"[ERROR] Failed to decode image: {e}")
            return None
    
    def recognize_face_from_image(self, image_data):
        """Recognize face from base64 image data"""
        frame = self.decode_base64_image(image_data)
        if frame is None:
            return {"success": False, "error": "Invalid image data"}
        
        try:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            face_locations = face_recognition.face_locations(rgb_frame)
            face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)
            
            if not face_encodings:
                return {"success": False, "error": "No face detected"}
            
            # Process the first detected face
            face_encoding = face_encodings[0]
            best_confidence = 0
            best_name = "Unknown"
            
            # Compare to baseline encodings
            for student_name, baseline_enc in self.baseline_encodings.items():
                dist = np.linalg.norm(face_encoding - baseline_enc)
                confidence = round((1 - dist) * 100, 2)  # 0-100%
                if confidence > best_confidence:
                    best_confidence = confidence
                    best_name = student_name
            
            # Apply fuzzy logic thresholds
            if best_confidence >= 85:
                status = "Accepted"
                decision = "present"
            elif 60 <= best_confidence < 85:
                status = "Uncertain"
                decision = "uncertain"
            else:
                status = "Rejected"
                decision = "absent"
                best_name = "Unknown"
            
            # Lookup RollNo and mark attendance if recognized
            roll_no = ""
            attendance_marked = False
            
            if best_name != "Unknown":
                row = self.students_df.loc[self.students_df["Name"] == best_name]
                if not row.empty:
                    roll_no = str(row["RollNo"].values[0]).strip()
                    
                    # Mark attendance if not already marked and status is accepted
                    if roll_no not in self.marked_students and status == "Accepted":
                        time_now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        with open(self.attendance_file, "a") as f:
                            f.write(f"{roll_no},{best_name},{time_now},{best_confidence}%,{status}\n")
                        self.marked_students.add(roll_no)
                        attendance_marked = True
                        print(f"[MARKED] {roll_no} - {best_name} ({best_confidence}% - {status})")
            
            return {
                "success": True,
                "name": best_name,
                "roll_no": roll_no,
                "confidence": best_confidence,
                "status": status,
                "decision": decision,
                "attendance_marked": attendance_marked,
                "already_marked": roll_no in self.marked_students if roll_no else False
            }
            
        except Exception as e:
            print(f"[ERROR] Recognition failed: {e}")
            return {"success": False, "error": str(e)}

# For standalone usage
def main():
    """Original standalone functionality"""
    system = FaceRecognitionSystem()
    
    cap = cv2.VideoCapture(0)
    print("[INFO] Starting face recognition... Press 'q' to quit.")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        face_locations = face_recognition.face_locations(rgb_frame)
        face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)
        
        for face_encoding, face_loc in zip(face_encodings, face_locations):
            best_confidence = 0
            best_name = "Unknown"
            
            # Compare to baseline encodings
            for student_name, baseline_enc in system.baseline_encodings.items():
                dist = np.linalg.norm(face_encoding - baseline_enc)
                confidence = round((1 - dist) * 100, 2)  # 0-100%
                if confidence > best_confidence:
                    best_confidence = confidence
                    best_name = student_name
            
            # Apply fuzzy logic thresholds
            if best_confidence >= 85:
                status = "Accepted"
            elif 60 <= best_confidence < 85:
                status = "Uncertain"
            else:
                status = "Rejected"
                best_name = "Unknown"
            
            # Lookup RollNo if recognized
            roll_no = ""
            if best_name != "Unknown":
                row = system.students_df.loc[system.students_df["Name"] == best_name]
                if not row.empty:
                    roll_no = str(row["RollNo"].values[0]).strip()
                    
                    # Mark attendance if not already marked
                    if roll_no not in system.marked_students:
                        time_now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        with open(system.attendance_file, "a") as f:
                            f.write(f"{roll_no},{best_name},{time_now},{best_confidence}%,{status}\n")
                        system.marked_students.add(roll_no)
                        print(f"[MARKED] {roll_no} - {best_name} ({best_confidence}% - {status})")
            
            # Draw rectangle + label on webcam
            top, right, bottom, left = face_loc
            cv2.rectangle(frame, (left, top), (right, bottom), (0, 255, 0), 2)
            cv2.putText(frame, f"{best_name} ({best_confidence}%)", (left, top - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        
        cv2.imshow("Face Recognition Attendance", frame)
        
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    cap.release()
    cv2.destroyAllWindows()
    print("[INFO] Attendance marking stopped.")

if __name__ == "__main__":
    main()
