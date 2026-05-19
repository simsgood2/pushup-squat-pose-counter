# Pose Motion Counter

실시간 웹캠 영상으로 동작을 추적해 푸시업과 스쿼트 반복 횟수를 자동으로 카운트하고, 자세 상태를 실시간으로 확인할 수 있는 컴퓨터비전 미니 프로젝트입니다.

## 프로젝트 개요
- **주요 기능**: 웹캠 기반 푸시업/스쿼트 인식, 반복 횟수 카운트, 동작 상태 표시
- **핵심 기술**: Python, OpenCV, MediaPipe Pose, NumPy
- **타겟 사용 환경**: 바닥에서 수행하는 푸시업, 스쿼트(개인 운동 루틴, 트레이닝 보조)

## 빠른 시작
1. 의존성 설치
```bash
pip install -r requirements.txt
```
2. 앱 실행
```bash
python app.py
```

## 사용 방법
- 실행 후 동작 모드(`pushup`, `squat`)를 선택합니다.
- 웹캠 앞에서 동작을 시작하면 화면에 관절 스켈레톤, 각도, 현재 동작 상태가 표시됩니다.
- 동작 반복이 카운트되며 종료 시 세션 로그(CSV)가 기록됩니다.

## 카메라 가이드(바닥 동작 기준)
- 카메라 높이: 0.8m ~ 1.0m (바닥 기준)
- 피사체 거리: 2.0m ~ 2.5m
- 배치: 정면 또는 약 30도 사선
- 화면에 어깨·엉덩이·무릎(스쿼트의 핵심부위)이 항상 들어오도록 배치
- 배경은 단순하고 조명은 균일할수록 안정적

## 구조
- `app.py`: 실행 엔트리, UI/카메라 루프
- `pose_engine.py`: MediaPipe Pose 추론 래퍼
- `counter.py`: 푸시업/스쿼트 상태 머신 및 카운팅 로직
- `utils.py`: 각도 계산, 유틸 함수
- `requirements.txt`: 환경 의존성
- `records/`: 세션별 CSV 저장
- `assets/`: 데모 이미지/스크린샷

## 실행 체크리스트
- `python --version`이 venv의 Python을 가리키는지 확인
- `pip show mediapipe`로 패키지 설치 확인
- 웹캠 권한이 허용되어 있는지 확인

## 참고 사항
- 조명이나 가림(옷, 장애물)으로 추적이 불안정해지면 임계값 튜닝이 필요할 수 있습니다.
- 본 프로젝트는 1인 사용 기준으로 설계되어 있으며, 1인 환경에서 최적화되어 있습니다.

## 데모
- `assets/demo_pushup.png`
- `assets/demo_squat.png`

## Reference
- OpenCV
- MediaPipe Pose
- NumPy
