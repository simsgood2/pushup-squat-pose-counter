import cv2

from pose_engine import PoseEngine


def main() -> None:
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    if not cap.isOpened():
        raise RuntimeError("Cannot open camera 0. Check permission, connection, and in-use state.")

    pose_engine = PoseEngine()

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Failed to read frame from camera.")
            if cv2.waitKey(500) & 0xFF == ord("q"):
                break
            continue

        _, points = pose_engine.detect_landmarks(frame)
        pose_engine.draw_points(frame, points)

        cv2.imshow("Pose Landmarker", frame)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
