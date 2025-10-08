import cv2

cap = cv2.VideoCapture(0)  # try 1 if 0 doesn't work

if not cap.isOpened():
    print("ERROR: Could not open webcam")
else:
    print("Webcam opened successfully")

while True:
    ret, frame = cap.read()
    if not ret:
        print("Failed to grab frame")
        break

    cv2.imshow("Webcam Test", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
