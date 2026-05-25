import cv2  
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

model_path = "pose_landmarker_lite.task"

# Draw only selected landmarks (MediaPipe PoseLandmarker landmark indices).
# 11,12: shoulders | 23,24: hips | 25,26: knees | 27,28: ankles
TARGET_LANDMARKS = {11, 12, 23, 24, 25, 26, 27, 28}

def main() -> None:  
    cap = cv2.VideoCapture(0)  # 기본 웹캠(인덱스 0) 열기
    if not cap.isOpened():  # 카메라 열기 실패 체크
        raise RuntimeError("카메라를 열지 못했습니다. 웹캠 연결/권한을 확인하세요.")  

    print("카메라 시작: q 키로 종료")  # 종료 안내 출력

    base_options = python.BaseOptions(model_asset_path=model_path) # 모델 경로 설정
    options = vision.PoseLandmarkerOptions(base_options=base_options) # 옵션 설정
    options.min_pose_detection_confidence = 0.5 # 포즈 감지 신뢰도 임계값 설정 (0.5는 일반적으로 적절한 값입니다) 사람이보였다고 판단하는 기준입니다. 너무 낮게 설정하면 노이즈가 많아질 수 있고, 너무 높게 설정하면 감지가 잘 안될 수 있습니다.
    options.min_pose_presence_confidence = 0.5 # 포즈 존재 신뢰도 임계값 설정 (0.5는 일반적으로 적절한 값입니다) 포즈가 실제로 존재한다고 판단하는 기준입니다. 너무 낮게 설정하면 노이즈가 많아질 수 있고, 너무 높게 설정하면 감지가 잘 안될 수 있습니다.
    options.min_tracking_confidence = 0.5 # 포즈 추적 신뢰도 임계값 설정 (0.5는 일반적으로 적절한 값입니다) 포즈 추적이 유효하다고 판단하는 기준입니다. 너무 낮게 설정하면 노이즈가 많아질 수 있고, 너무 높게 설정하면 추적이 잘 안될 수 있습니다.
    pose_landmarker = vision.PoseLandmarker.create_from_options(options) # PoseLandmarker 객체 생성 


    while True:  # 프레임 루프 시작
        ok, frame = cap.read()  # 한 프레임 읽기

        if not ok:  # 프레임 획득 실패
            print("프레임을 읽지 못했습니다.") 
            break  

        frame = cv2.flip(frame, 1)  # 좌우 반전(거울 효과)
        img = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)  # BGR을 RGB로 변환
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img)
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


        cv2.putText(  # 화면 좌측 위에 상태 텍스트 표시
            frame,  # 대상 프레임
            "camera test - press q to quit",  # 출력 문자열
            (20, 30),  # 텍스트 위치 
            cv2.FONT_HERSHEY_SIMPLEX,  # 폰트
            0.8,  # 폰트 크기
            (0, 255, 0),  # 색상
            2,  # 두께
            cv2.LINE_AA,  # 안티앨리어싱 텍스트부드럽게
        )

        cv2.imshow("Pose Motion Counter", frame)  

        key = cv2.waitKey(1) & 0xFF  # 키 입력 체크
        if key in (ord('q'), 27):  # q 또는 ESC
            break  

    cap.release()  # 카메라 자원 해제
    cv2.destroyAllWindows()  # 창 닫기


if __name__ == "__main__":  # 스크립트 직접 실행 진입점
    main()  # main 실행
