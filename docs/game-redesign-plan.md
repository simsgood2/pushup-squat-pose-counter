# 모캡 디펜스 게임 리디자인 계획

기존 Python 포즈 카운터를 기반으로, 사용자의 운동 동작이 3D 캐릭터에 동기화되고 그 결과로 모은 골드로 디펜스 페이즈를 플레이하는 웹 게임으로 확장한다.

이 문서는 초기 설계와 현재 구현 상태를 함께 기록한다. 2026-05-28 기준 MVP는 `web/` 아래 TypeScript + Vite + Three.js 앱으로 진행 중이다.

## 현재 결론

**TypeScript + Vite + Three.js + MediaPipe Tasks for Web + Kalidokit + Zustand** 스택으로 간다.

초기 계획과 달라진 핵심 결정:

- 포즈 추론은 현재 **메인 스레드**에서 실행한다.
- 캐릭터는 VRM이 아니라 현재 `web/src/assets/characters/manny.glb`를 사용한다.
- GLB 캐릭터 본 리타게팅은 팔 중심으로 먼저 구현했다.
- 스틱피규어는 fallback 겸 디버그 렌더러로 계속 유지한다.
- React는 아직 도입하지 않았다. HUD는 Three.js 캔버스 위 HTML overlay로 구현되어 있다.
- 디펜스는 현재 단일 타워, 단일 적, 단일 웨이브까지 플레이 가능하다.

## 왜 JS인가

| 기준 | JS / Browser | Python |
|---|---|---|
| MediaPipe 통합 | 브라우저 카메라 권한과 바로 연결 | 네이티브 카메라/GUI 차이 처리 필요 |
| 3D 렌더 | Three.js 생태계, glTF/GLB 로드 쉬움 | Panda3D 등 별도 파이프라인 필요 |
| 테스트 | Vitest + Playwright로 로직/브라우저 검증 가능 | GUI 검증 자동화가 상대적으로 번거로움 |
| 배포 | `vite build` 후 정적 호스팅 가능 | exe/OS별 권한/카메라 차이 고려 필요 |
| 에이전트 작업성 | 코드, 브라우저, 테스트가 한 프로젝트 안에서 닫힘 | 런타임 경계가 많아짐 |

핵심은 구현 루프가 짧다는 점이다. 포즈 입력, 3D 렌더, 게임 로직, 테스트가 모두 한 브라우저 앱 안에 있다.

## 현재 스택

| 영역 | 현재 선택 |
|---|---|
| 언어 | TypeScript |
| 번들러 / Dev 서버 | Vite |
| 3D 렌더 | Three.js |
| 포즈 추론 | MediaPipe Tasks for Web `PoseLandmarker` |
| 포즈 실행 위치 | 메인 스레드 |
| 캐릭터 포맷 | GLB (`manny.glb`) |
| 캐릭터 로딩 | Three.js `GLTFLoader` |
| 리타게팅 | 커스텀 본 매핑 + quaternion 변환, Kalidokit은 의존성으로 유지 |
| 상태 관리 | 운동 골드: Zustand store, 그 외는 단순 class/module state |
| UI | HTML overlay (`ExerciseHud`) |
| 테스트 | Vitest + Playwright |

## 현재 구현 상태

### M1 — 모캡 → 캐릭터 동기화

완료된 것:

- Vite + TypeScript 프로젝트 구성
- Three.js 씬, 카메라, 조명, 바닥, OrbitControls
- MediaPipe Pose Landmarker 실행
- 웹캠 입력에서 33개 landmark 수신
- 스틱피규어 렌더러
- GLB 캐릭터 로드 (`manny.glb`)
- 팔 중심 본 리타게팅
- Playwright 기반 시각 검증

중요한 변경:

- `poseWorker.ts`는 남아 있지만 런타임 경로로 사용하지 않는다.
- MediaPipe Tasks Vision WASM 글루가 module worker 안에서 안정적으로 초기화되지 않았다. `ModuleFactory not set` 계열 문제가 있었고, classic worker 우회보다 메인 스레드 실행이 MVP에 더 안정적이었다.
- 현재 33 landmark 처리와 단일 캐릭터 렌더링 수준에서는 메인 스레드 성능이 충분하다.

### M2 — 운동 인식 + 골드

완료된 것:

- 3D 각도 계산 유틸
- `RepetitionCounter` state machine
- 푸시업, 스쿼트, 점프, 런지, 팔벌려뛰기 분류기
- 동작별 골드, 콤보, 깊이 보너스
- Zustand 기반 골드 누적
- HTML HUD에 운동 종류, 콤보, 골드 표시
- Vitest/Playwright 검증

현재 UX 한계:

- 아직 명시적인 운동 페이즈 타이머는 없다.
- 사용자는 항상 모캡/운동 인식이 켜진 상태로 디펜스 그리드도 함께 볼 수 있다.
- 운동으로 번 골드와 타워 구매 비용은 아직 연결되어 있지 않다.

### M3 — 디펜스 페이즈

완료된 것:

- 8x8 그리드
- 마우스 클릭 또는 테스트 훅으로 타워 배치
- 기본 타워 1종
  - 단일 타깃
  - 발사체 이동
  - 사거리/피해량/연사 속도/투사체 속도 스탯
- 기본 적 1종
  - HP 100
  - 직선 경로 이동
  - 사망/도착 상태 구분
- 웨이브 1개
  - 기본 적 5마리
  - 순차 출현
- Playwright 검증
  - 타워 배치 후 5마리 적이 도착 전에 모두 사망

현재 한계:

- HP/라이프 시스템이 없다.
- 타워 구매 비용과 골드 소비가 없다.
- 경로는 단순 직선이다.
- 타워/적/웨이브 종류가 각각 1개뿐이다.
- 디펜스 페이즈 시작/종료 UI가 없다.

## 현재 아키텍처

```text
web/src/
├── main.ts                    # 런타임 엔트리, 씬/모캡/HUD/디펜스 연결
├── scene.ts                   # Three.js renderer, camera, light, ground
├── mocap/
│   ├── poseStream.ts          # 현재 사용 중: 메인 스레드 MediaPipe Pose
│   └── poseWorker.ts          # 보존 중: worker 재시도용, 현재 미사용
├── character/
│   ├── gltfLoader.ts          # GLB 로더
│   ├── fbxLoader.ts           # 캐릭터 정규화 helper 재사용
│   ├── retargetBones.ts       # MediaPipe landmarks → GLB 본 회전
│   └── stickFigure.ts         # fallback/debug skeleton
├── exercise/
│   ├── angle.ts
│   ├── repCounter.ts
│   ├── rewards.ts
│   └── classifiers/
│       ├── pushup.ts
│       ├── squat.ts
│       ├── jump.ts
│       ├── lunge.ts
│       └── jumpingJack.ts
├── defense/
│   ├── grid.ts                # 그리드, 타워 배치, 런타임 디펜스 시뮬레이션 연결
│   ├── towers.ts              # 타워 로직
│   ├── enemies.ts             # 적 로직
│   └── waves.ts               # 웨이브 스크립트
├── ui/
│   └── ExerciseHud.ts
└── assets/
    └── characters/manny.glb
```

## 스레드 분리 상태

초기 계획은 MediaPipe inference를 WebWorker로 분리하는 것이었다. 현재는 보류한다.

현재 정책:

- `PoseStream`이 메인 스레드에서 `PoseLandmarker.detectForVideo()`를 호출한다.
- Vite 설정에서 `@mediapipe/tasks-vision` pre-bundle을 피해서 WASM 로딩 문제를 줄인다.
- `poseWorker.ts`는 삭제하지 않고 보존한다. 나중에 MediaPipe Tasks의 worker 호환 패턴을 확실히 잡으면 다시 사용할 수 있다.

worker 재시도 조건:

- 메인 스레드 inference가 프레임 드랍을 명확히 만든다.
- 모바일/저사양 기기에서 입력 지연이 게임성을 해친다.
- MediaPipe Tasks Vision의 worker 초기화 문제를 재현 가능한 방식으로 해결했다.

그 전까지는 메인 스레드 경로를 기준 구현으로 본다.

## 게임 컨셉

두 페이즈가 번갈아 도는 로그라이크형 디펜스 게임을 목표로 한다.

### 페이즈 A — 운동

- 제한 시간 동안 운동 동작 수행
- 인식 동작:
  - 푸시업
  - 스쿼트
  - 점프
  - 런지
  - 팔벌려뛰기
- 보상:
  - 동작별 기본 골드
  - 깊이 보너스
  - 콤보 보너스
  - 다양성 보너스

### 페이즈 B — 디펜스

- 운동으로 번 골드로 타워/유닛 구매
- 웨이브를 막으면 다음 라운드로 진행
- 장기적으로는 랜덤 상점, 타워 등급, 변이 웨이브, 이벤트 카드를 붙인다.

현재는 페이즈 전환 없이 두 시스템이 같은 화면에서 동시에 존재한다. 다음 큰 작업은 이 둘을 게임 루프로 묶는 것이다.

## 목표 진행 루프

```text
[페이즈 A: 60초 운동] → 골드 정산
       ↓
[페이즈 B: 타워 배치 → 웨이브 방어] → 클리어 시 다음 라운드
       ↓
[페이즈 A: 제한 시간 감소 또는 난이도 증가]
       ↓
보스/최종 웨이브 → 클리어 또는 게임오버
```

## 다음 우선순위

### 1. 페이즈 상태 머신

- Menu / Exercise / Defense / WaveClear / GameOver 상태 정의
- 운동 인식은 Exercise 상태에서 주로 골드 수급
- Defense 상태에서는 타워 배치와 웨이브 진행
- 테스트 훅은 유지하되 런타임 UI와 충돌하지 않게 정리

### 2. 골드와 타워 비용 연결

- 타워 배치 시 골드 차감
- 골드 부족 시 배치 실패
- HUD에 현재 골드와 배치 가능 여부 표시

### 3. HP / 라이프 / 게임오버

- 적이 끝점에 도착하면 라이프 감소
- 라이프 0이면 GameOver
- Playwright로 도착/사망 시나리오 둘 다 검증

### 4. 디펜스 콘텐츠 확장

- 타워 3종:
  - 단일딜
  - 광역
  - 슬로우
- 적 3종:
  - 기본
  - 기갑
  - 고속
- 웨이브 1~5

### 5. UX 정리

- 운동 HUD와 디펜스 HUD 분리
- 웨이브 시작 버튼
- 현재 페이즈 표시
- 카메라/캐릭터/그리드 화면 구도 조정

## 동작 분류 규칙

현재 구현은 기존 Python 카운터 임계값을 출발점으로 포팅했다.

| 동작 | 핵심 관절 | 다운 조건 | 업 조건 | 추가 조건 |
|---|---|---|---|---|
| 푸시업 | 팔꿈치 | 각도 작아짐 | 각도 펴짐 | 몸통 수평 조건 |
| 스쿼트 | 무릎 | 각도 작아짐 | 각도 펴짐 | 몸통 수직 조건 |
| 점프 | 발목 Y | 기준선 근처 | 기준선보다 상승 | 짧은 시간 내 복귀 |
| 런지 | 무릎 + z 거리 | 앞다리 굽힘 | 다시 섬 | 양 다리 전후 차이 |
| 팔벌려뛰기 | 어깨/팔 + 발목 거리 | 팔 내림 + 발 모음 | 팔 올림 + 발 벌림 | 동시성 |

임계값은 테스트 fixture 기준으로 안정화되어 있지만, 실제 웹캠 환경에서는 사용자 키/카메라 각도에 따른 보정 UI가 필요할 수 있다.

## 캐릭터 방향

현재:

- `manny.glb`를 기본 캐릭터로 사용한다.
- GLB 텍스처/머티리얼 로딩은 확인했다.
- 팔 본 리타게팅이 우선 적용되어 있다.
- 스틱피규어도 함께 렌더되어 디버깅에 유용하다.

나중:

- 전신 리타게팅 확대
- 스틱피규어 표시 토글
- 캐릭터 선택
- PBR/조명/후처리 정리

VRM은 당장 필수 경로가 아니다. 캐릭터 파이프라인은 GLB 기준으로 안정화한 뒤 필요할 때 VRM을 다시 검토한다.

## 테스트 정책

- 게임 로직은 Vitest로 빠르게 검증한다.
- 브라우저 상호작용, 캔버스 렌더, HUD, 디펜스 시나리오는 Playwright로 검증한다.
- 테스트 전용 window hook은 MVP 기간에는 유지한다.
- 시각/상호작용 회귀를 막는 것이 우선이며, 내부 구조가 안정되면 hook을 정리한다.

현재 주요 검증:

- 씬 로드 및 캔버스 존재
- ground/grid 렌더
- 스틱피규어 landmark 렌더
- GLB 캐릭터 로드와 본 리타게팅
- 5종 운동 분류와 골드 보상
- HUD 골드 표시
- 그리드 클릭 타워 배치
- 기본 타워가 기본 웨이브 5마리를 도착 전에 처치

## 리스크와 미정 사항

- **메인 스레드 MediaPipe 성능**: 현재는 충분하지만, 모바일에서는 병목이 될 수 있다.
- **worker 재도입**: MediaPipe Tasks Vision WASM 초기화 문제 해결 전까지 보류.
- **카메라 보정**: 사용자 체형/카메라 위치별 운동 인식 안정화가 필요하다.
- **골드 밸런스**: 운동 보상과 타워 비용이 아직 연결되지 않아 곡선 튜닝 전이다.
- **디펜스 밸런스**: 현재는 수락 테스트용 최소 전투다.
- **캐릭터 리타게팅**: 팔 외 본은 아직 제한적이다.
- **모바일 성능/권한**: 배포 전에 별도 확인 필요.

## 당장 다음 액션

1. 페이즈 상태 머신을 만든다.
2. 골드 소비와 타워 배치를 연결한다.
3. 라이프/게임오버를 추가한다.
4. 디펜스 웨이브와 타워 종류를 확장한다.
5. 실제 플레이 화면 UX를 정리한다.
