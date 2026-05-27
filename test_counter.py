import unittest

from counter import (
    LEFT_ANKLE,
    LEFT_ELBOW,
    LEFT_HIP,
    LEFT_KNEE,
    LEFT_SHOULDER,
    LEFT_WRIST,
    MotionCounter,
    RIGHT_ANKLE,
    RIGHT_ELBOW,
    RIGHT_HIP,
    RIGHT_KNEE,
    RIGHT_SHOULDER,
    RIGHT_WRIST,
)
from pose_engine import PosePoint


def point(x, y):
    return PosePoint(x=x, y=y, z=0.0)


def base_landmarks():
    return {
        LEFT_SHOULDER: point(0.2, 0.3),
        RIGHT_SHOULDER: point(0.2, 0.35),
        LEFT_ELBOW: point(0.5, 0.3),
        RIGHT_ELBOW: point(0.5, 0.35),
        LEFT_WRIST: point(0.8, 0.3),
        RIGHT_WRIST: point(0.8, 0.35),
        LEFT_HIP: point(0.8, 0.32),
        RIGHT_HIP: point(0.8, 0.37),
        LEFT_KNEE: point(0.4, 0.7),
        RIGHT_KNEE: point(0.4, 0.75),
        LEFT_ANKLE: point(0.4, 0.95),
        RIGHT_ANKLE: point(0.4, 0.97),
    }


class MotionCounterTest(unittest.TestCase):
    def test_counts_pushup_after_down_then_up(self):
        counter = MotionCounter()
        up = base_landmarks()
        down = base_landmarks()
        down[LEFT_WRIST] = point(0.5, 0.6)
        down[RIGHT_WRIST] = point(0.5, 0.65)

        counter.update(up)
        counter.update(down)
        result = counter.update(up)

        self.assertEqual(result["pushup"].count, 1)

    def test_counts_squat_after_down_then_up(self):
        counter = MotionCounter()
        up = base_landmarks()
        down = base_landmarks()
        up[LEFT_SHOULDER] = point(0.4, 0.2)
        up[RIGHT_SHOULDER] = point(0.45, 0.2)
        up[LEFT_HIP] = point(0.4, 0.45)
        up[RIGHT_HIP] = point(0.45, 0.45)
        up[LEFT_KNEE] = point(0.4, 0.7)
        up[RIGHT_KNEE] = point(0.45, 0.7)
        up[LEFT_ANKLE] = point(0.4, 0.95)
        up[RIGHT_ANKLE] = point(0.45, 0.95)
        down[LEFT_SHOULDER] = point(0.15, 0.35)
        down[RIGHT_SHOULDER] = point(0.2, 0.35)
        down[LEFT_HIP] = point(0.15, 0.65)
        down[RIGHT_HIP] = point(0.2, 0.65)
        down[LEFT_KNEE] = point(0.4, 0.7)
        down[RIGHT_KNEE] = point(0.45, 0.7)
        down[LEFT_ANKLE] = point(0.4, 0.95)
        down[RIGHT_ANKLE] = point(0.45, 0.95)

        counter.update(up)
        counter.update(down)
        result = counter.update(up)

        self.assertEqual(result["squat"].count, 1)


if __name__ == "__main__":
    unittest.main()
