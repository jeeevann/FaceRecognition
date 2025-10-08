#!/usr/bin/env python3
"""
Test script to verify the face recognition integration
"""

import os
import sys
import requests
import json
from datetime import datetime

def test_server_health():
    """Test if the face recognition server is running"""
    try:
        response = requests.get('http://127.0.0.1:5001/health', timeout=5)
        if response.status_code == 200:
            data = response.json()
            print("✅ Server Health Check: PASSED")
            print(f"   - Students loaded: {data.get('students_loaded', 0)}")
            print(f"   - Encodings loaded: {data.get('encodings_loaded', 0)}")
            return True
        else:
            print("❌ Server Health Check: FAILED")
            print(f"   - Status Code: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print("❌ Server Health Check: FAILED")
        print(f"   - Error: {e}")
        print("   - Make sure face_recognition_server.py is running")
        return False

def test_file_structure():
    """Test if required files exist"""
    print("\n📁 File Structure Check:")
    
    required_files = [
        'encodings.pkl',
        'students.csv',
        'recognize.py',
        'face_recognition_server.py',
        'attendance.html',
        'teacher-dashboard.html',
        'main.js'
    ]
    
    required_dirs = [
        'Students',
        'AttendanceFiles'
    ]
    
    all_good = True
    
    for file in required_files:
        if os.path.exists(file):
            print(f"   ✅ {file}")
        else:
            print(f"   ❌ {file} - Missing!")
            all_good = False
    
    for dir in required_dirs:
        if os.path.exists(dir):
            print(f"   ✅ {dir}/")
        else:
            print(f"   ❌ {dir}/ - Missing!")
            all_good = False
    
    return all_good

def test_students_data():
    """Test if student data is properly formatted"""
    print("\n👥 Student Data Check:")
    
    try:
        import pandas as pd
        df = pd.read_csv('students.csv')
        print(f"   ✅ students.csv loaded - {len(df)} students found")
        
        required_columns = ['RollNo', 'Name']
        missing_cols = [col for col in required_columns if col not in df.columns]
        
        if missing_cols:
            print(f"   ❌ Missing columns: {missing_cols}")
            return False
        else:
            print(f"   ✅ Required columns present")
        
        # Check Students folder
        students_dir = 'Students'
        if os.path.exists(students_dir):
            student_folders = [d for d in os.listdir(students_dir) if os.path.isdir(os.path.join(students_dir, d))]
            print(f"   ✅ Student folders: {len(student_folders)} found")
            
            # Check if student names match folders
            csv_names = set(df['Name'].str.strip())
            folder_names = set(student_folders)
            
            missing_folders = csv_names - folder_names
            extra_folders = folder_names - csv_names
            
            if missing_folders:
                print(f"   ⚠️  Students in CSV but no folder: {missing_folders}")
            
            if extra_folders:
                print(f"   ⚠️  Folders without CSV entry: {extra_folders}")
            
            return True
        else:
            print(f"   ❌ Students directory not found")
            return False
            
    except Exception as e:
        print(f"   ❌ Error reading student data: {e}")
        return False

def test_encodings():
    """Test if face encodings are available"""
    print("\n🧠 Face Encodings Check:")
    
    try:
        import pickle
        with open('encodings.pkl', 'rb') as f:
            known_encodings, known_names, baseline_encodings = pickle.load(f)
        
        print(f"   ✅ Encodings loaded successfully")
        print(f"   - Total encodings: {len(known_encodings)}")
        print(f"   - Unique students: {len(set(known_names))}")
        print(f"   - Baseline encodings: {len(baseline_encodings)}")
        
        return True
        
    except Exception as e:
        print(f"   ❌ Error loading encodings: {e}")
        print("   - Run train.py to generate encodings.pkl")
        return False

def main():
    """Run all tests"""
    print("🚀 Face Recognition Integration Test")
    print("=" * 50)
    
    tests = [
        ("File Structure", test_file_structure),
        ("Student Data", test_students_data),
        ("Face Encodings", test_encodings),
        ("Server Health", test_server_health)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"   ❌ {test_name} test failed with error: {e}")
            results.append((test_name, False))
    
    print("\n" + "=" * 50)
    print("📊 Test Summary:")
    
    passed = 0
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"   {test_name}: {status}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{len(results)} tests passed")
    
    if passed == len(results):
        print("\n🎉 All tests passed! Your system is ready to use.")
        print("\nNext steps:")
        print("1. Start face_recognition_server.py")
        print("2. Open teacher-dashboard.html in your browser")
        print("3. Navigate to 'Take Attendance' and test with a student")
    else:
        print("\n⚠️  Some tests failed. Please fix the issues above before proceeding.")
    
    return passed == len(results)

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
