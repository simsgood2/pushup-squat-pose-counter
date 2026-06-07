# Push-up / Squat Pose Counter

OpenCV와 MediaPipe를 사용해 웹캠 화면에서 푸시업과 스쿼트 횟수를 세는 Python 운동 카운터입니다.

사용자는 실행 시 운동 모드를 선택하고 목표 횟수를 입력할 수 있습니다. 프로그램은 관절 각도를 기준으로 반복 동작을 판별하며, 종료 시 운동 기록을 CSV 파일로 저장합니다.

## 주요 기능

- 기본 웹캠을 열어 실시간 자세를 분석합니다.
- MediaPipe Pose Landmarker로 어깨, 팔꿈치, 손목, 엉덩이, 무릎, 발목 위치를 추적합니다.
- 푸시업, 스쿼트, 푸시업 + 스쿼트 모드를 지원합니다.
- 운동별 목표 횟수를 설정할 수 있습니다.
- 팔꿈치 각도로 푸시업을, 무릎 각도로 스쿼트를 카운트합니다.
- 화면에 경과 시간, 현재 횟수, 목표 달성 여부를 표시합니다.
- 운동 종료 후 세션 기록과 전체 요약 기록을 CSV로 저장합니다.

## 실행 방법

Windows PowerShell 기준입니다.

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```

가상환경 활성화가 막히면 현재 PowerShell 창에서만 실행 정책을 풀고 다시 활성화합니다.

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\venv\Scripts\Activate.ps1
```

## 사용 방법

프로그램을 실행하면 운동 모드를 선택합니다.

```text
1. Push-up
2. Squat
3. Push-up + Squat
```

선택한 운동의 목표 횟수를 입력합니다. 목표 없이 계속 카운트하려면 `0`을 입력하거나 빈칸으로 넘기면 됩니다.

카메라 창이 열리면 운동을 시작합니다.

- `f`: 전체 화면과 창 모드 전환
- `q`: 종료
- `ESC`: 종료

종료하면 `records/` 폴더에 운동 기록이 저장됩니다.

## 테스트 영상

직접 촬영한 테스트 영상입니다. Markdown 뷰어에서 영상 미리보기가 보이지 않으면 아래 링크를 눌러 확인할 수 있습니다.

### 스쿼트 10개

<video src="media/squat-10-reps.mp4" controls width="720"></video>

[스쿼트 테스트 영상 열기](media/squat-10-reps.mp4)

### 푸시업 10개

<video src="media/pushup-10-reps.mp4" controls width="720"></video>

[푸시업 테스트 영상 열기](media/pushup-10-reps.mp4)

## 저장되는 기록

운동을 종료하면 두 종류의 CSV가 저장됩니다.

- `records/session_YYYYMMDD_HHMMSS.csv`: 해당 운동 1회의 상세 기록
- `records/summary.csv`: 전체 운동 세션 누적 요약

기록에는 시작 시간, 종료 시간, 운동 시간, 목표 횟수, 완료 여부, 전체 횟수, 분당 반복 횟수가 포함됩니다.

## 프로젝트 구조

```text
.
|-- main.py
|-- pose_engine.py
|-- counter.py
|-- utils.py
|-- session_logger.py
|-- pose_landmarker_lite.task
|-- requirements.txt
|-- media/
|   |-- pushup-10-reps.mp4
|   `-- squat-10-reps.mp4
`-- README.md
```

## 파일 설명

- `main.py`: 웹캠 실행, 모드 선택, 화면 표시, 키 입력 처리, 세션 저장을 담당합니다.
- `pose_engine.py`: MediaPipe Pose Landmarker 모델을 불러오고 신체 랜드마크를 감지합니다.
- `counter.py`: 푸시업과 스쿼트의 반복 횟수 계산 및 자세 피드백 로직을 담고 있습니다.
- `utils.py`: 관절 각도 계산, 랜드마크 평균값 계산, 누락된 포인트 확인 같은 공통 함수를 제공합니다.
- `session_logger.py`: 운동 결과를 세션 CSV와 누적 요약 CSV로 저장합니다.
- `pose_landmarker_lite.task`: MediaPipe 자세 인식 모델 파일입니다.
- `requirements.txt`: 실행에 필요한 Python 패키지 목록입니다.
- `media/`: README에서 사용하는 테스트 영상 파일입니다.
- `records/`: 운동 기록이 저장되는 폴더입니다. 실행 중 자동으로 생성되며 Git에는 포함하지 않습니다.

## 동작 원리

- 자세 인식: MediaPipe가 웹캠 프레임에서 주요 관절 위치를 감지합니다.
- 각도 계산: 푸시업은 팔꿈치 각도, 스쿼트는 무릎 각도를 중심으로 판단합니다.
- 상태 관리: `ready`, `down`, `up` 상태를 거치며 완전한 동작 1회를 카운트합니다.
- 피드백: 신체가 화면에 충분히 보이는지, 옆모습이 적절한지, 내려가는 깊이가 충분한지 확인합니다.
- 기록 저장: 운동이 끝나면 세션별 기록과 전체 요약 기록을 CSV로 남깁니다.

## 촬영 및 인식 팁

- 전신이 화면 안에 들어오도록 카메라를 배치합니다.
- 스쿼트는 엉덩이, 무릎, 발목이 잘 보여야 안정적으로 카운트됩니다.
- 푸시업은 어깨, 팔꿈치, 손목, 엉덩이가 보이는 옆모습 구도가 좋습니다.
- 카운트가 너무 엄격하거나 느슨하면 `counter.py`의 각도 기준값을 조정합니다.
