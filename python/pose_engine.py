from dataclasses import dataclass

import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision


TARGET_LANDMARKS = {
    11,
    12,
    13,
    14,
    15,
    16,
    23,
    24,
    25,
    26,
    27,
    28,
}


@dataclass(frozen=True)
class PosePoint:
    x: float
    y: float
    z: float
    visibility: float = 1.0


class PoseEngine:
    """MediaPipe pose detector wrapper."""

    def __init__(
        self,
        model_path: str = "pose_landmarker_lite.task",
        min_pose_detection_confidence: float = 0.5,
        min_pose_presence_confidence: float = 0.5,
        min_tracking_confidence: float = 0.5,
    ) -> None:
        base_options = python.BaseOptions(model_asset_path=model_path)
        options = vision.PoseLandmarkerOptions(base_options=base_options)
        options.min_pose_detection_confidence = min_pose_detection_confidence
        options.min_pose_presence_confidence = min_pose_presence_confidence
        options.min_tracking_confidence = min_tracking_confidence

        self._pose_landmarker = vision.PoseLandmarker.create_from_options(options)

    def detect_landmarks(self, frame_bgr):
        """Return selected normalized landmarks and their pixel positions."""
        image_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)
        result = self._pose_landmarker.detect(mp_image)

        selected = {}
        selected_points = {}
        h, w = frame_bgr.shape[:2]

        if not result.pose_landmarks:
            return selected, selected_points

        # Use first detected person.
        person_landmarks = result.pose_landmarks[0]
        landmarks = person_landmarks.landmark if hasattr(person_landmarks, "landmark") else person_landmarks

        for idx, landmark in enumerate(landmarks):
            if idx not in TARGET_LANDMARKS:
                continue

            selected[idx] = PosePoint(
                x=landmark.x,
                y=landmark.y,
                z=landmark.z,
                visibility=getattr(landmark, "visibility", 1.0),
            )
            selected_points[idx] = (
                int(landmark.x * w),
                int(landmark.y * h),
            )

        return selected, selected_points

    def draw_points(self, frame_bgr, points, radius: int = 5, color=(0, 255, 0)):
        for _, (x, y) in points.items():
            cv2.circle(frame_bgr, (x, y), radius, color, -1)

    def __del__(self):
        # MediaPipe landmarker cleanup handled by internal destructor; keep explicit no-op for clarity.
        pass
