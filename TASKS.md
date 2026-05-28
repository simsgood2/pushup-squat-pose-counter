# Overnight Task Ledger

> 각 task의 수락 기준은 자동 검증 가능한 형태로 작성. 체크박스는 task 완료 시 LLM이 갱신.

## M0 — 부트스트랩

- [x] **T0.1 — Vite + TS 프로젝트 init**
  - `web/` 디렉토리에 Vite + TypeScript 템플릿 스캐폴드.
  - `web/package.json`, `web/tsconfig.json`, `web/index.html`, `web/src/main.ts` 존재.
  - 수락: `cd web && npm install && npm run build` 그린.

- [x] **T0.2 — Three.js + MediaPipe + 테스트 의존성 추가**
  - 추가: `three`, `@types/three`, `@mediapipe/tasks-vision`, `kalidokit`, `zustand`.
  - dev 추가: `vitest`, `@playwright/test`, `@vitest/ui`.
  - npm scripts: `dev`, `build`, `test`, `test:e2e`.
  - 수락: `cd web && npm install` 그린 + `npm run test` 빈 테스트 통과.

- [x] **T0.3 — Playwright config + 첫 sanity 스펙**
  - `web/playwright.config.ts` 작성. 베이스 URL `http://localhost:5173`.
  - chromium만 사용, `--use-fake-ui-for-media-stream` 및 `--use-fake-device-for-media-stream` 플래그 포함.
  - `web/tests/sanity.spec.ts`: 페이지 로드 + `<canvas>` 존재 확인.
  - 수락: `npm run test:e2e` 그린.

## M1 — 모캡 → 캐릭터 동기화

- [x] **T1.1 — Three.js 기본 씬**
  - `web/src/scene.ts` 작성: PerspectiveCamera, AmbientLight + DirectionalLight, GridHelper, 회색 ground plane.
  - `web/src/main.ts`에서 씬 부트스트랩 + renderer 루프.
  - 수락: dev 서버 띄우면 회색 바닥 + 그리드가 보임 (Playwright 스크린샷으로 검증).

- [x] **T1.2 — MediaPipe 모델 자산 배치**
  - 레포 루트 `pose_landmarker_lite.task`를 `web/public/models/`로 복사.
  - 수락: 빌드 후 `web/dist/models/pose_landmarker_lite.task` 존재.

- [x] **T1.3 — MediaPipe Pose를 WebWorker에서 실행**
  - `web/src/mocap/poseWorker.ts`: WebWorker. `@mediapipe/tasks-vision`의 `PoseLandmarker`를 모델 파일 로딩 → 입력 비디오 프레임 받아 33개 landmark 출력.
  - `web/src/mocap/poseStream.ts`: 메인 스레드 측. `getUserMedia`로 카메라 열고, 매 프레임을 worker에 postMessage, 결과를 RxJS-less한 callback으로 emit.
  - Vitest: poseStream API의 subscribe/unsubscribe 동작 단위 테스트 (worker는 mock).
  - 수락: Vitest 통과 + dev에서 콘솔에 landmark 좌표 흐름 확인.

- [x] **T1.4 — 스틱피규어 렌더러 (manny.fbx 부재시 기본)**
  - `web/src/character/stickFigure.ts`: 33개 small sphere + 주요 본 연결 cylinder. poseStream 좌표를 매 프레임 반영.
  - 좌표 변환: MediaPipe `worldLandmarks`의 미터 단위 좌표를 그대로 사용, Y축은 뒤집어 Three 좌표계 맞춤.
  - 수락: Playwright fixture로 mock landmark stream 주입 → 캔버스에 33개 점이 그려진 픽셀 분포 확인.

- [ ] ~~**T1.5 — (Optional) FBX humanoid 본 리타게팅**~~ — SKIPPED (`assets/characters/manny.fbx` 없음)
  - 파일 없으면 SKIPPED 표시 후 통과 처리.
  - `web/src/character/fbxLoader.ts`: FBXLoader로 manny 로드.
  - `web/src/character/retargetBones.ts`: MediaPipe 33 landmarks → UE5 본 (upperarm_l, lowerarm_l 등) quaternion 회전 매핑.
  - 본 이름 매핑 테이블 inline 작성. Kalidokit의 출력 활용 가능.
  - 수락: 캐릭터가 mock 입력에 대해 팔 들어올린 자세를 정확히 재현 (테스트 좌표로 검증).

## M2 — 운동 인식 + 골드

- [x] **T2.1 — 각도 계산 유틸**
  - `web/src/exercise/angle.ts`: 3개 점으로 각도 (Python `utils.py` 포팅).
  - Vitest: 알려진 3D 좌표 입력에 대한 각도 결과 검증.

- [ ] **T2.2 — RepetitionCounter 베이스 클래스**
  - `web/src/exercise/repCounter.ts`: down_angle / up_angle / hysteresis state machine. Python `counter.py` 포팅.
  - Vitest: 인공 각도 시퀀스 입력에 정확한 카운트 수 검증.

- [ ] **T2.3 — 푸시업 분류기**
  - `web/src/exercise/classifiers/pushup.ts`: 양 팔꿈치 각도, 몸통 수평 조건.
  - Vitest: pushup motion sequence에 카운트 발생 검증.

- [ ] **T2.4 — 스쿼트 분류기**
  - `web/src/exercise/classifiers/squat.ts`: 양 무릎 각도, 몸통 수직 조건.
  - Vitest 동일 패턴.

- [ ] **T2.5 — 점프 / 런지 / 팔벌려뛰기 분류기**
  - 각각 `jump.ts`, `lunge.ts`, `jumpingJack.ts`. 규칙은 [docs/game-redesign-plan.md](docs/game-redesign-plan.md) 표 참조.
  - Vitest로 각 분류기 검증.

- [ ] **T2.6 — 골드 시스템 + 콤보 + 깊이 보너스**
  - `web/src/exercise/rewards.ts`: 동작별 기본 가치 + 콤보 배수 + 깊이 가산. Zustand store에 누적.
  - Vitest로 시나리오별 골드 결과 검증.

- [ ] **T2.7 — 운동 HUD**
  - `web/src/ui/ExerciseHud.ts`: Three.js 위 HTML overlay. 현재 동작 / 콤보 / 골드 표시.
  - Playwright: mock landmark 시퀀스 주입 후 HUD에 골드가 0이 아닌 값으로 보이는지.

## M3 — 디펜스 페이즈 (도달하면 보너스)

- [ ] **T3.1 — 그리드 + 타워 배치 UI**
  - `web/src/defense/grid.ts`: N×M 셀. 마우스 클릭으로 타워 배치 가능.
  - 수락: 클릭 위치에 타워 메쉬가 생성됨.

- [ ] **T3.2 — 타워 1종 + 적 1종 + 웨이브 1개**
  - 타워: 단일 타깃 발사체. 적: 직선 경로 이동, HP 100.
  - 웨이브 1: 적 5마리 출현.
  - 수락: Playwright로 타워 배치 후 적이 도달 전에 사망하는 시나리오 확인.

## 메타

- [ ] **TM.1 — 최종 DONE.flag 생성**
  - 위 우선순위 task가 모두 done 또는 skipped면 `DONE.flag` 생성.
