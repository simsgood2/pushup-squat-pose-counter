from dataclasses import dataclass

from utils import angle_degrees, average, has_points


LEFT_SHOULDER = 11
RIGHT_SHOULDER = 12
LEFT_ELBOW = 13
RIGHT_ELBOW = 14
LEFT_WRIST = 15
RIGHT_WRIST = 16
LEFT_HIP = 23
RIGHT_HIP = 24
LEFT_KNEE = 25
RIGHT_KNEE = 26
LEFT_ANKLE = 27
RIGHT_ANKLE = 28


@dataclass
class ExerciseState:
    count: int = 0
    phase: str = "ready"
    angle: float | None = None
    active: bool = False


class RepetitionCounter:
    def __init__(self, down_angle: float, up_angle: float) -> None:
        self.down_angle = down_angle
        self.up_angle = up_angle
        self.state = ExerciseState()

    def update(self, angle: float | None, active: bool) -> ExerciseState:
        self.state.angle = angle
        self.state.active = active

        if angle is None:
            return self.state

        if not active:
            self.state.phase = "ready"
            return self.state

        if self.state.phase in ("ready", "up") and angle <= self.down_angle:
            self.state.phase = "down"
        elif self.state.phase == "down" and angle >= self.up_angle:
            self.state.phase = "up"
            self.state.count += 1

        return self.state


class MotionCounter:
    def __init__(self, enabled_exercises: set[str] | None = None) -> None:
        self.enabled_exercises = enabled_exercises or {"pushup", "squat"}
        self.pushup = RepetitionCounter(down_angle=105.0, up_angle=155.0)
        self.squat = RepetitionCounter(down_angle=105.0, up_angle=160.0)
        self.activity = "detecting"

    def update(self, landmarks) -> dict:
        pushup_angle = self._pushup_angle(landmarks)
        squat_angle = self._squat_angle(landmarks)

        pushup_active = self._looks_like_pushup(landmarks, pushup_angle)
        squat_active = self._looks_like_squat(landmarks, squat_angle)

        pushup_enabled = "pushup" in self.enabled_exercises
        squat_enabled = "squat" in self.enabled_exercises

        pushup_state = self.pushup.update(pushup_angle, pushup_active and pushup_enabled)
        squat_state = self.squat.update(squat_angle, squat_active and squat_enabled)

        self.activity = self._infer_activity(pushup_state, squat_state)
        feedback = self._feedback(landmarks, pushup_state, squat_state)

        return {
            "activity": self.activity,
            "pushup": pushup_state,
            "squat": squat_state,
            "feedback": feedback,
        }

    def _pushup_angle(self, landmarks) -> float | None:
        angles = []
        if has_points(landmarks, [LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST]):
            angles.append(angle_degrees(landmarks[LEFT_SHOULDER], landmarks[LEFT_ELBOW], landmarks[LEFT_WRIST]))
        if has_points(landmarks, [RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST]):
            angles.append(angle_degrees(landmarks[RIGHT_SHOULDER], landmarks[RIGHT_ELBOW], landmarks[RIGHT_WRIST]))
        return average(angles)

    def _squat_angle(self, landmarks) -> float | None:
        angles = []
        if has_points(landmarks, [LEFT_HIP, LEFT_KNEE, LEFT_ANKLE]):
            angles.append(angle_degrees(landmarks[LEFT_HIP], landmarks[LEFT_KNEE], landmarks[LEFT_ANKLE]))
        if has_points(landmarks, [RIGHT_HIP, RIGHT_KNEE, RIGHT_ANKLE]):
            angles.append(angle_degrees(landmarks[RIGHT_HIP], landmarks[RIGHT_KNEE], landmarks[RIGHT_ANKLE]))
        return average(angles)

    def _looks_like_pushup(self, landmarks, angle: float | None) -> bool:
        if angle is None or not has_points(landmarks, [LEFT_SHOULDER, LEFT_HIP, RIGHT_SHOULDER, RIGHT_HIP]):
            return False

        left_body_horizontal = self._is_sideways(landmarks[LEFT_SHOULDER], landmarks[LEFT_HIP])
        right_body_horizontal = self._is_sideways(landmarks[RIGHT_SHOULDER], landmarks[RIGHT_HIP])
        body_horizontal = average([left_body_horizontal, right_body_horizontal])
        if not body_horizontal:
            return False

        wrist_available = has_points(landmarks, [LEFT_WRIST, RIGHT_WRIST])
        if not wrist_available:
            return False

        shoulder_y = average([landmarks[LEFT_SHOULDER].y, landmarks[RIGHT_SHOULDER].y])
        wrist_y = average([landmarks[LEFT_WRIST].y, landmarks[RIGHT_WRIST].y])
        if shoulder_y is None or wrist_y is None:
            return False

        hands_near_or_below_shoulders = wrist_y >= shoulder_y - 0.08
        return hands_near_or_below_shoulders

    def _looks_like_squat(self, landmarks, angle: float | None) -> bool:
        if angle is None or not has_points(landmarks, [LEFT_HIP, LEFT_KNEE, LEFT_ANKLE, RIGHT_HIP, RIGHT_KNEE, RIGHT_ANKLE]):
            return False

        hip_y = average([landmarks[LEFT_HIP].y, landmarks[RIGHT_HIP].y])
        knee_y = average([landmarks[LEFT_KNEE].y, landmarks[RIGHT_KNEE].y])
        ankle_y = average([landmarks[LEFT_ANKLE].y, landmarks[RIGHT_ANKLE].y])
        if hip_y is None or knee_y is None or ankle_y is None:
            return False

        lower_body_ordered = hip_y < knee_y < ankle_y
        torso_upright = self._is_upright(landmarks[LEFT_SHOULDER], landmarks[LEFT_HIP]) or self._is_upright(
            landmarks[RIGHT_SHOULDER], landmarks[RIGHT_HIP]
        )
        return lower_body_ordered and torso_upright

    def _is_sideways(self, upper, lower) -> bool:
        dx = abs(upper.x - lower.x)
        dy = abs(upper.y - lower.y)
        return dx > dy * 1.15

    def _is_upright(self, upper, lower) -> bool:
        dx = abs(upper.x - lower.x)
        dy = abs(upper.y - lower.y)
        return dy > dx * 1.15

    def _infer_activity(self, pushup_state: ExerciseState, squat_state: ExerciseState) -> str:
        if pushup_state.active and not squat_state.active:
            return "pushup"
        if squat_state.active and not pushup_state.active:
            return "squat"
        if pushup_state.phase == "down" and squat_state.phase != "down":
            return "pushup"
        if squat_state.phase == "down" and pushup_state.phase != "down":
            return "squat"
        if pushup_state.active or squat_state.active:
            return "tracking"
        return "detecting"

    def _feedback(self, landmarks, pushup_state: ExerciseState, squat_state: ExerciseState) -> list[str]:
        if not landmarks:
            return ["No pose detected. Move into the camera frame."]

        messages = []

        if "pushup" in self.enabled_exercises:
            messages.extend(self._pushup_feedback(landmarks, pushup_state))

        if "squat" in self.enabled_exercises:
            messages.extend(self._squat_feedback(landmarks, squat_state))

        if messages:
            return messages[:3]

        if self.activity in ("pushup", "squat", "tracking"):
            return ["Good form. Keep going."]

        return ["Get into position to start counting."]

    def _pushup_feedback(self, landmarks, state: ExerciseState) -> list[str]:
        required = [LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_ELBOW, RIGHT_ELBOW, LEFT_WRIST, RIGHT_WRIST, LEFT_HIP, RIGHT_HIP]
        if not has_points(landmarks, required):
            return ["Push-up: show shoulders, elbows, wrists, and hips."]

        if not state.active:
            return ["Push-up: use a side view with hands near or below shoulders."]

        if state.angle is None:
            return ["Push-up: elbow angle is not visible."]

        if state.phase in ("ready", "up") and state.angle > self.pushup.down_angle + 15:
            return ["Push-up: bend elbows lower to count the down phase."]

        if state.phase == "down" and state.angle < self.pushup.up_angle - 10:
            return ["Push-up: straighten arms to finish the repetition."]

        return []

    def _squat_feedback(self, landmarks, state: ExerciseState) -> list[str]:
        required = [LEFT_HIP, RIGHT_HIP, LEFT_KNEE, RIGHT_KNEE, LEFT_ANKLE, RIGHT_ANKLE]
        if not has_points(landmarks, required):
            return ["Squat: show hips, knees, and ankles."]

        if not has_points(landmarks, [LEFT_SHOULDER, RIGHT_SHOULDER]):
            return ["Squat: keep shoulders visible for posture checking."]

        if not state.active:
            return ["Squat: stand upright with full lower body in frame."]

        if state.angle is None:
            return ["Squat: knee angle is not visible."]

        if state.phase in ("ready", "up") and state.angle > self.squat.down_angle + 15:
            return ["Squat: go lower until knees bend deeper."]

        if state.phase == "down" and state.angle < self.squat.up_angle - 10:
            return ["Squat: stand tall to finish the repetition."]

        return []
