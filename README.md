# Pose Motion Counter

웹캠 영상에서 사람의 자세를 추적해 푸시업과 스쿼트 반복 횟수를 자동으로 카운트하는 Python 컴퓨터비전 프로젝트입니다.

MediaPipe Pose Landmarker로 주요 관절을 추출하고, 팔꿈치/무릎 각도와 몸통 방향을 기준으로 푸시업과 스쿼트를 동시에 추론합니다.

## 주요 기능

- 웹캠 기반 실시간 포즈 추적
- 푸시업/스쿼트 자동 추론
- 푸시업 카운트와 스쿼트 카운트 동시 표시
- 현재 추론 상태, 동작 phase, 관절 각도 표시
- 종료 시 세션 요약 CSV 저장

## 기술 스택

- Python
- OpenCV
- MediaPipe Pose Landmarker
- NumPy

## 빠른 시작

```bash
pip install -r requirements.txt
python main.py
```

실행 후 별도 모드 선택 없이 웹캠 앞에서 푸시업 또는 스쿼트를 수행하면 됩니다.

종료:

- `q`
- `ESC`

## 화면 표시

실행 화면에는 다음 정보가 표시됩니다.

- `Activity`: 현재 추론 중인 동작 상태
- `Push-ups`: 푸시업 카운트
- `Squats`: 스쿼트 카운트
- 주요 관절 포인트

## CSV 기록

앱을 종료하면 `records/` 폴더에 세션 CSV가 저장됩니다.

저장 컬럼:

```csv
started_at,ended_at,duration_seconds,pushups,squats
```

## 카메라 배치

노트북 웹캠 기준으로는 아래 배치가 가장 안정적입니다.

- 높이: 바닥 기준 약 70cm ~ 100cm
- 거리: 몸 전체가 화면에 들어오도록 약 2m
- 각도: 몸 기준 30도 ~ 45도 사선
- 푸시업: 어깨, 팔꿈치, 손목, 엉덩이가 보이게 배치
- 스쿼트: 엉덩이, 무릎, 발목이 보이게 배치
- 조명: 몸이 밝게 보이고 배경이 단순할수록 안정적

## 프로젝트 구조

```text
.
├── main.py                  # 실행 엔트리, 카메라 루프, 화면 오버레이
├── pose_engine.py           # MediaPipe Pose Landmarker 래퍼
├── counter.py               # 푸시업/스쿼트 자동 추론 및 카운팅
├── utils.py                 # 각도 계산 등 유틸 함수
├── session_logger.py        # 세션 CSV 저장
├── pose_landmarker_lite.task
├── requirements.txt
├── records/                 # 실행 후 생성되는 CSV 저장 폴더
└── assets/
```

## 테스트

웹캠 없이 카운터 로직만 테스트할 수 있습니다.

```bash
python -m unittest test_counter.py
```

문법 검사는 다음 명령으로 확인할 수 있습니다.

```bash
python -m compileall main.py pose_engine.py counter.py utils.py session_logger.py test.py test_counter.py
```

## 튜닝 포인트

카운트가 너무 쉽게 올라가거나 잘 안 올라가면 `counter.py`의 임계값을 조정합니다.

```python
self.pushup = RepetitionCounter(down_angle=105.0, up_angle=155.0)
self.squat = RepetitionCounter(down_angle=105.0, up_angle=160.0)
```

- 너무 쉽게 카운트되면 `down_angle`을 낮춥니다.
- 내려갔는데 인식이 안 되면 `down_angle`을 높입니다.
- 올라왔는데 카운트가 완료되지 않으면 `up_angle`을 낮춥니다.
- 완전히 올라오기 전에 카운트되면 `up_angle`을 높입니다.

## 참고 사항

- 현재 운동 분류는 별도 학습 모델이 아니라 랜드마크 기반 규칙으로 동작합니다.
- 카메라 위치, 조명, 옷, 화면 내 신체 가림에 따라 정확도가 달라질 수 있습니다.
- 한 명이 화면에 들어오는 환경을 기준으로 설계되어 있습니다.
