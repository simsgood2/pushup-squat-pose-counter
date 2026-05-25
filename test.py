import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

model_path = "pose_landmarker_lite.task"

# Draw only selected landmarks (MediaPipe PoseLandmarker landmark indices).
# 11,12: shoulders | 23,24: hips | 25,26: knees | 27,28: ankles
TARGET_LANDMARKS = {11, 12, 23, 24, 25, 26, 27, 28}

cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
if not cap.isOpened():
    raise RuntimeError("카메라(0)를 열 수 없습니다. 카메라 권한/연결/점유 상태를 확인하세요.")

base_options = python.BaseOptions(model_asset_path=model_path) # 모델 경로 설정
options = vision.PoseLandmarkerOptions(base_options=base_options) # 옵션 설정
options.min_pose_detection_confidence = 0.5 # 포즈 감지 신뢰도 임계값 설정 (0.5는 일반적으로 적절한 값입니다) 사람이보였다고 판단하는 기준입니다. 너무 낮게 설정하면 노이즈가 많아질 수 있고, 너무 높게 설정하면 감지가 잘 안될 수 있습니다.
options.min_pose_presence_confidence = 0.5 # 포즈 존재 신뢰도 임계값 설정 (0.5는 일반적으로 적절한 값입니다) 포즈가 실제로 존재한다고 판단하는 기준입니다. 너무 낮게 설정하면 노이즈가 많아질 수 있고, 너무 높게 설정하면 감지가 잘 안될 수 있습니다.
options.min_tracking_confidence = 0.5 # 포즈 추적 신뢰도 임계값 설정 (0.5는 일반적으로 적절한 값입니다) 포즈 추적이 유효하다고 판단하는 기준입니다. 너무 낮게 설정하면 노이즈가 많아질 수 있고, 너무 높게 설정하면 추적이 잘 안될 수 있습니다.
pose_landmarker = vision.PoseLandmarker.create_from_options(options) # PoseLandmarker 객체 생성 

while True:
    ret, frame = cap.read()
    if not ret:
        print("카메라에서 프레임을 가져오지 못했습니다.")
        if cv2.waitKey(500) & 0xFF == ord('q'):
            break
        continue

    image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image)

    result = pose_landmarker.detect(mp_image)

    if result.pose_landmarks:
        for person_landmarks in result.pose_landmarks:
            landmarks = (
                person_landmarks.landmark
                if hasattr(person_landmarks, "landmark")
                else person_landmarks
            )
            for i, landmark in enumerate(landmarks):
                if i not in TARGET_LANDMARKS:
                    continue
                x = int(landmark.x * frame.shape[1])
                y = int(landmark.y * frame.shape[0])
                cv2.circle(frame, (x, y), 5, (0, 255, 0), -1)

    cv2.imshow('Pose Landmarker', frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
