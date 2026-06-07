from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import cv2

from counter import MotionCounter
from pose_engine import PoseEngine
from session_logger import SessionSummary, save_session


BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "pose_landmarker_lite.task"
RECORDS_DIR = BASE_DIR / "records"
WINDOW_NAME = "Pose Motion Counter"


@dataclass(frozen=True)
class WorkoutConfig:
    mode: str
    pushup_goal: int = 0
    squat_goal: int = 0

    @property
    def enabled_exercises(self) -> set[str]:
        if self.mode == "pushup":
            return {"pushup"}
        if self.mode == "squat":
            return {"squat"}
        return {"pushup", "squat"}


MODE_LABELS = {
    "pushup": "Push-up",
    "squat": "Squat",
    "both": "Push-up + Squat",
}


def prompt_workout_config() -> WorkoutConfig:
    print("Select workout mode:")
    print("  1. Push-up")
    print("  2. Squat")
    print("  3. Push-up + Squat")

    mode = _prompt_mode()
    pushup_goal = _prompt_goal("Push-up target reps (0 = no target): ") if mode in ("pushup", "both") else 0
    squat_goal = _prompt_goal("Squat target reps (0 = no target): ") if mode in ("squat", "both") else 0

    return WorkoutConfig(mode=mode, pushup_goal=pushup_goal, squat_goal=squat_goal)


def _prompt_mode() -> str:
    choices = {
        "1": "pushup",
        "pushup": "pushup",
        "p": "pushup",
        "2": "squat",
        "squat": "squat",
        "s": "squat",
        "3": "both",
        "both": "both",
        "b": "both",
        "": "both",
    }

    while True:
        try:
            answer = input("Mode [1/2/3, default 3]: ").strip().lower()
        except EOFError:
            return "both"

        if answer in choices:
            return choices[answer]

        print("Please enter 1, 2, or 3.")


def _prompt_goal(prompt: str) -> int:
    while True:
        try:
            answer = input(prompt).strip()
        except EOFError:
            return 0

        if answer == "":
            return 0

        try:
            goal = int(answer)
        except ValueError:
            print("Please enter a whole number.")
            continue

        if goal >= 0:
            return goal

        print("Target reps cannot be negative.")


def draw_overlay(frame, status, config: WorkoutConfig, elapsed_seconds: int, completed: bool) -> None:
    pushup = status["pushup"]
    squat = status["squat"]

    lines = [f"Time: {format_duration(elapsed_seconds)}"]

    if "pushup" in config.enabled_exercises:
        lines.append(f"Push-ups: {format_count(pushup.count, config.pushup_goal)}")

    if "squat" in config.enabled_exercises:
        lines.append(f"Squats: {format_count(squat.count, config.squat_goal)}")

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


def format_count(count: int, goal: int) -> str:
    if goal > 0:
        return f"{count}/{goal}"
    return str(count)


def format_duration(seconds: int) -> str:
    minutes, remaining_seconds = divmod(seconds, 60)
    return f"{minutes:02d}:{remaining_seconds:02d}"


def workout_complete(config: WorkoutConfig, status) -> bool:
    goals = []

    if "pushup" in config.enabled_exercises and config.pushup_goal > 0:
        goals.append(status["pushup"].count >= config.pushup_goal)

    if "squat" in config.enabled_exercises and config.squat_goal > 0:
        goals.append(status["squat"].count >= config.squat_goal)

    return bool(goals) and all(goals)


def print_session_summary(summary: SessionSummary, record_path: Path) -> None:
    print("")
    print("Session summary")
    print(f"  mode: {MODE_LABELS.get(summary.mode, summary.mode)}")
    print(f"  duration: {format_duration(summary.duration_seconds)}")
    print(f"  push-ups: {format_count(summary.pushups, summary.pushup_goal)}")
    print(f"  squats: {format_count(summary.squats, summary.squat_goal)}")
    print(f"  reps/min: {summary.reps_per_minute:.1f}")
    print(f"  completed: {'yes' if summary.completed else 'no'}")
    print(f"  saved: {record_path}")


def set_fullscreen(enabled: bool) -> None:
    mode = cv2.WINDOW_FULLSCREEN if enabled else cv2.WINDOW_NORMAL
    cv2.setWindowProperty(WINDOW_NAME, cv2.WND_PROP_FULLSCREEN, mode)


def main() -> None:
    config = prompt_workout_config()
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise RuntimeError("Cannot open camera 0. Check webcam connection and permissions.")

    fullscreen = True
    cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_NORMAL)
    set_fullscreen(fullscreen)

    print(f"camera started: {MODE_LABELS[config.mode]} mode, press f for fullscreen/windowed, q to quit")
    pose_engine = PoseEngine(model_path=str(MODEL_PATH))
    motion_counter = MotionCounter(enabled_exercises=config.enabled_exercises)
    started_at = datetime.now()
    completed = False
    completed_at = None

    try:
        while True:
            ok, frame = cap.read()

            if not ok:
                print("Could not read frame.")
                break

            frame = cv2.flip(frame, 1)
            landmarks, points = pose_engine.detect_landmarks(frame)
            status = motion_counter.update(landmarks)
            elapsed_seconds = int((datetime.now() - started_at).total_seconds())

            if workout_complete(config, status):
                completed = True
                if completed_at is None:
                    completed_at = datetime.now()
                    print("goal complete")

            pose_engine.draw_points(frame, points)
            draw_overlay(frame, status, config, elapsed_seconds, completed)

            cv2.imshow(WINDOW_NAME, frame)

            key = cv2.waitKey(1) & 0xFF
            if key == ord("f"):
                fullscreen = not fullscreen
                set_fullscreen(fullscreen)
                continue

            if key in (ord("q"), 27):
                break

            if completed_at is not None and (datetime.now() - completed_at).total_seconds() >= 2.0:
                break
    finally:
        ended_at = datetime.now()
        summary = SessionSummary(
            started_at=started_at,
            ended_at=ended_at,
            mode=config.mode,
            pushup_goal=config.pushup_goal,
            squat_goal=config.squat_goal,
            pushups=motion_counter.pushup.state.count,
            squats=motion_counter.squat.state.count,
            completed=completed,
        )
        record_path = save_session(summary, records_dir=str(RECORDS_DIR))
        print_session_summary(summary, record_path)

        cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
