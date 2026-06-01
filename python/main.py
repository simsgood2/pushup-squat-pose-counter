from datetime import datetime

import cv2

from counter import MotionCounter
from pose_engine import PoseEngine
from session_logger import SessionSummary, save_session


def draw_overlay(frame, status) -> None:
    pushup = status["pushup"]
    squat = status["squat"]

    lines = [
        f"Activity: {status['activity']}",
        f"Push-ups: {pushup.count}  ",
        f"Squats:   {squat.count} ",
        "press q or ESC to quit",
    ]

    y = 34
    for line in lines:
        cv2.putText(
            frame,
            line,
            (20, y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            (0, 255, 0),
            2,
            cv2.LINE_AA,
        )
        y += 30


def _format_angle(angle: float | None) -> str:
    if angle is None:
        return "--"
    return f"{angle:.0f}"


def main() -> None:
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise RuntimeError("Cannot open camera 0. Check webcam connection and permissions.")

    print("camera started: press q to quit")
    pose_engine = PoseEngine()
    motion_counter = MotionCounter()
    started_at = datetime.now()

    try:
        while True:
            ok, frame = cap.read()

            if not ok:
                print("Could not read frame.")
                break

            frame = cv2.flip(frame, 1)
            landmarks, points = pose_engine.detect_landmarks(frame)
            status = motion_counter.update(landmarks)

            pose_engine.draw_points(frame, points)
            draw_overlay(frame, status)

            cv2.imshow("Pose Motion Counter", frame)

            key = cv2.waitKey(1) & 0xFF
            if key in (ord("q"), 27):
                break
    finally:
        ended_at = datetime.now()
        summary = SessionSummary(
            started_at=started_at,
            ended_at=ended_at,
            pushups=motion_counter.pushup.state.count,
            squats=motion_counter.squat.state.count,
        )
        record_path = save_session(summary)
        print(f"session saved: {record_path}")

        cap.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
