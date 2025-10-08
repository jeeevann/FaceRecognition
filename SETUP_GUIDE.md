# Face Recognition Attendance System - Setup Guide

## Overview
This system integrates face recognition with your web-based attendance system. Students' faces are recognized automatically and attendance is marked in real-time.

## Prerequisites
1. Python 3.7 or higher
2. Webcam/Camera access
3. XAMPP or similar web server
4. Student photos for training

## Installation Steps

### 1. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 2. Prepare Student Data
1. Create student folders in the `Students/` directory:
   ```
   Students/
   ├── Student Name 1/
   │   ├── 1.jpg
   │   ├── 2.jpg
   │   └── 3.jpg
   ├── Student Name 2/
   │   ├── 1.jpg
   │   ├── 2.jpg
   │   └── 3.jpg
   ```

2. Update `students.csv` with student information:
   ```csv
   RollNo,Name,Email,Phone,Department,Year,Division
   CS001,Student Name 1,student1@email.com,1234567890,Computer,FY,A
   CS002,Student Name 2,student2@email.com,0987654321,Computer,FY,A
   ```

### 3. Train the Face Recognition Model
```bash
python train.py
```
This will create `encodings.pkl` file with face encodings.

### 4. Start the Face Recognition Server
```bash
python face_recognition_server.py
```
The server will start on `http://127.0.0.1:5001`

### 5. Access the Web Interface
1. Start your web server (XAMPP)
2. Navigate to the project directory in your browser
3. Login as a teacher
4. Go to "Take Attendance" section
5. Fill in the lecture details and click "Start Attendance"

## Usage Instructions

### For Teachers:
1. **Login** to the teacher dashboard
2. **Navigate** to "Take Attendance"
3. **Select** Department, Year, Division, Subject, and Time Slot
4. **Click** "Start Attendance" - this will redirect to the attendance page
5. **Allow** camera access when prompted
6. The system will **automatically start** face recognition
7. **Students** should look at the camera for attendance marking
8. **Monitor** the live attendance log on the right side

### For Students:
1. Look directly at the camera
2. Wait for the green checkmark and confirmation message
3. Attendance is marked automatically when face is recognized with high confidence

## System Features

### Face Recognition:
- **High Accuracy**: Uses face_recognition library with dlib
- **Fuzzy Logic**: Confidence thresholds (85%+ = Present, 70-85% = Uncertain, <70% = Absent)
- **Duplicate Prevention**: Students can't mark attendance twice on the same day
- **Real-time Processing**: Live camera feed with instant recognition

### Web Interface:
- **Teacher Dashboard**: Complete attendance management
- **Live Log**: Real-time attendance marking display
- **Student Management**: Add/edit student information with photos
- **Reports**: View attendance history and statistics

### File Structure:
```
FaceRecognition/
├── Students/                    # Student photos for training
├── AttendanceFiles/            # Daily attendance CSV files
├── encodings.pkl               # Trained face encodings
├── students.csv               # Student database
├── train.py                   # Training script
├── recognize.py               # Face recognition module
├── face_recognition_server.py # Flask API server
├── teacher-dashboard.html     # Teacher interface
├── attendance.html           # Attendance marking page
├── main.js                   # Frontend JavaScript
└── requirements.txt          # Python dependencies
```

## Troubleshooting

### Common Issues:

1. **"Face recognition server is not running"**
   - Make sure `face_recognition_server.py` is running
   - Check if port 5001 is available
   - Verify the server URL in `main.js` (FLASK_BASE)

2. **"No face detected"**
   - Ensure good lighting
   - Look directly at the camera
   - Make sure face is clearly visible

3. **"System not initialized"**
   - Run `train.py` first to create encodings.pkl
   - Ensure students.csv exists and has correct format
   - Check if Students/ folder has student photos

4. **Camera access denied**
   - Allow camera permissions in browser
   - Use HTTPS or localhost for camera access
   - Check if camera is being used by another application

### Performance Tips:
- Use good lighting for better recognition
- Ensure student photos are clear and well-lit
- Retrain the model when adding new students
- Use at least 3-5 photos per student for better accuracy

## API Endpoints

### Face Recognition Server (Port 5001):
- `GET /health` - Check server status
- `POST /recognize` - Recognize face from image
- `POST /reload` - Reload face encodings
- `GET /attendance/today` - Get today's attendance records

## Security Notes
- The system only stores face encodings, not actual photos
- Attendance data is stored locally in CSV files
- Camera access is required only during attendance marking
- No face data is transmitted over the network except for recognition

## Support
If you encounter any issues:
1. Check the console logs in your browser
2. Verify the Flask server is running and accessible
3. Ensure all dependencies are installed correctly
4. Make sure student photos and data are properly formatted
