#!/usr/bin/env python3
"""
Simple script to reload the face recognition system
Run this after making changes to recognize.py or training new faces
"""

import requests
import sys

def reload_system():
    """Reload the face recognition system via API"""
    try:
        print("🔄 Reloading face recognition system...")
        response = requests.post('http://127.0.0.1:5001/reload', timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print("✅ System reloaded successfully!")
                print("   The new confidence thresholds are now active.")
                return True
            else:
                print("❌ Failed to reload system:", result.get('error'))
                return False
        else:
            print(f"❌ Server returned status code: {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to connect to face recognition server: {e}")
        print("   Make sure face_recognition_server.py is running")
        return False

def check_server_status():
    """Check if the server is running"""
    try:
        response = requests.get('http://127.0.0.1:5001/health', timeout=5)
        if response.status_code == 200:
            data = response.json()
            print("📊 Server Status:")
            print(f"   - Students loaded: {data.get('students_loaded', 0)}")
            print(f"   - Face encodings: {data.get('encodings_loaded', 0)}")
            return True
        else:
            print("❌ Server health check failed")
            return False
    except requests.exceptions.RequestException:
        print("❌ Face recognition server is not running")
        print("   Please start it with: python face_recognition_server.py")
        return False

if __name__ == "__main__":
    print("🚀 Face Recognition System Reload")
    print("=" * 40)
    
    # Check server status first
    if not check_server_status():
        sys.exit(1)
    
    # Reload the system
    if reload_system():
        print("\n🎉 System successfully reloaded!")
        print("\nNew confidence thresholds:")
        print("   - ≥85%: Accepted (attendance marked)")
        print("   - 60-84%: Uncertain (shown but not marked)")
        print("   - <60%: Rejected")
        print("\nYou can now test the face recognition with the new settings.")
    else:
        print("\n⚠️  Reload failed. Please check the error messages above.")
        sys.exit(1)
