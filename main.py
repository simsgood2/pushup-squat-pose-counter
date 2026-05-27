import cv2

from pose_engine import PoseEngine


def main() -> None:
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise RuntimeError("Cannot open camera 0. Check webcam connection and permissions.")

    print("camera started: press q to quit")
    pose_engine = PoseEngine()

    while True:
        ok, frame = cap.read()

        if not ok:
            print("Could not read frame.")
            break

        frame = cv2.flip(frame, 1)
        _, points = pose_engine.detect_landmarks(frame)
        pose_engine.draw_points(frame, points)

        cv2.putText(
            frame,
            "camera test - press q to quit",
            (20, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 255, 0),
            2,
            cv2.LINE_AA,
        )

        cv2.imshow("Pose Motion Counter", frame)

        key = cv2.waitKey(1) & 0xFF
        if key in (ord("q"), 27):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
