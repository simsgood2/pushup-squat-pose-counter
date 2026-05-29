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
- 페이즈 상태 머신(Menu / Exercise / Defense / WaveClear / GameOver)이 구현되어 있고, PhaseHud로 페이즈/라운드/타이머/라이프/타워 비용이 표시된다.
- 타워 배치 시 골드가 차감(기본 30)되며, 잔액 부족 시 배치가 거부된다.
- 적이 끝점에 도달하면 라이프가 감소하고, 라이프 0이면 GameOver 상태로 전환된다.

## 왜 JS인가

| 기준 | JS / Browser | Python |
|---|---|---|
| MediaPipe 통합 | 브라우저 카메라 권한과 바로 연결 | 네이티브 카메라/GUI 차이 처리 필요 |
| 3D 렌더 | Three.js 생태계, glTF/GLB 로드 쉬움 | Panda3D 등 별도 파이프라인 필요 |
| 테스트 | Playwright로 브라우저/시각 검증 | GUI 검증 자동화가 상대적으로 번거로움 |
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
| 상태 관리 | 운동 골드: `goldStore`, 페이즈/라운드: `phaseStore` (Zustand vanilla) |
| UI | HTML overlay (`ExerciseHud`, `PhaseHud`) |
| 테스트 | Playwright |

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

- 골드 잔액이 HUD에 표시되지 않는다 (ExerciseHud에서 골드는 보임, 디펜스 HUD에는 비용만 표시).

### M4 — 페이즈 상태 머신 + 골드·라이프 루프

완료된 것 (T4.1):

- `phaseMachine.ts`: Menu / Exercise / Defense / WaveClear / GameOver 상태 + Zustand `phaseStore`
- `PhaseHud.ts`: 메뉴 오버레이("게임 시작"), 페이즈/라운드/타이머(60s) 표시, "디펜스 시작" / "다음 라운드" 버튼
- `main.ts` 페이즈 연동: Exercise 페이즈에서만 운동 분류기 활성, Defense 페이즈에서만 그리드 클릭 활성
- `grid.ts`: `setInputEnabled(boolean)`, `onWaveComplete` 콜백 추가
- Playwright 페이즈 E2E

완료된 것 (T4.2 + T4.3):

- `towers.ts`: `TowerConfig.cost` 필드 추가, 기본 타워 비용 30
- `rewards.ts`: `goldStore`에 `spendGold(amount): boolean` 추가 (잔액 부족 시 false)
- `grid.ts`: `placeTowerAt`에 골드 체크 및 차감, `onEnemyReachedEnd` 콜백, `startWave()` 공개 메서드
- `phaseMachine.ts`: `lives: number` (초기값 20, `INITIAL_LIVES`), `loseLife()` 액션 추가
- `PhaseHud.ts`: Defense 페이즈에 "라이프: N" / "타워 비용: 30" 행 표시
- `main.ts`: `onEnemyReachedEnd → loseLife` 연결
- Playwright (신규 `gameOver.spec.ts` 포함)

현재 한계:

- 라운드가 넘어가도 그리드/웨이브가 리셋되지 않는다 (T4.4 이후 처리).
- GameOver → Menu 복귀/재시작 UI가 없다 (T4.5 UX와 함께).
- 골드 잔액이 디펜스 HUD에 표시되지 않는다.

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

- 경로는 단순 직선이다.
- 타워/적/웨이브 종류가 각각 1개뿐이다 (T4.4에서 확장 예정).

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
├── game/
│   └── phaseMachine.ts        # 페이즈 상태 머신 + phaseStore (Zustand)
├── ui/
│   ├── ExerciseHud.ts
│   └── PhaseHud.ts            # 메뉴 오버레이, 페이즈/라운드/타이머 HUD
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

페이즈 상태 머신이 구현되어 두 시스템은 이제 명시적인 페이즈로 분리된다. 골드 소비와 라이프 시스템이 연결되어 운동 → 골드 → 타워 → 웨이브 방어 → (실패 시) GameOver 루프가 완성되었다. 다음 작업은 콘텐츠 확장(타워/적/웨이브 종류)이다.

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

### ~~1. 페이즈 상태 머신~~ ✅ 완료 (T4.1)

### ~~2. 골드와 타워 비용 연결~~ ✅ 완료 (T4.2)

- 타워 배치 시 골드 차감 (기본 30)
- 골드 부족 시 배치 실패
- HUD에 타워 비용 표시

### ~~3. HP / 라이프 / 게임오버~~ ✅ 완료 (T4.3)

- 적이 끝점에 도착하면 라이프 감소 (초기 20)
- 라이프 0이면 GameOver 전환
- Playwright + Vitest 검증 완료

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
- 카메라/캐릭터/그리드 화면 구도 조정 (간단한 프리셋 수준; 본격적인 비주얼은 M4)

## M4 — 비주얼 / 월드 (별도 트랙)

게임 로직 트랙(위 1~5)과 분리해서 화면을 "게임답게" 만드는 마일스톤. 지금은 회색 바닥 + 그리드 + 캐릭터 + 스틱피규어로 디버그 환경에 가깝다. 로직이 닫히는 것과 무관하게 비주얼 폴리시는 별도 트랙으로 굴린다.

### 진입 시점

M3 콘텐츠 확장(우선순위 #4 타워/적/웨이브 3종)까지 자리잡은 다음 본격 진입한다. 콘텐츠 종류가 정해지기 전에 모델/이펙트부터 입히면 재작업이 늘어난다. 단, T4.6 카메라 프리셋 정도는 UX 정리(우선순위 #5)와 묶어 일찍 시작해도 좋다.

### T4.6 페이즈별 카메라 / 씬 구도

- 운동 페이즈: 캐릭터 정면 중심, 가벼운 짐/스튜디오 분위기
- 디펜스 페이즈: 그리드 탑다운 또는 비스듬한 탑다운
- 페이즈 전환 시 카메라 트윈
- 운동 페이즈에서 그리드 숨김 / 디펜스 페이즈에서 캐릭터 축소 등 가시성 분리

### T4.7 디펜스 맵 비주얼

- 타일 머티리얼 (셀별 텍스처 또는 PBR)
- 적 경로 시각화 (path 하이라이트)
- 스폰 / 엔드 마커
- hover 시 배치 가능 / 불가 시각 피드백 (현재는 단순 점유 체크만)
- 맵 외곽 데코 (벽 / 배경 오브젝트)

### T4.8 모델 업그레이드

- 기본 타워: 박스 → 실제 GLB 모델
- 적: 종류별 GLB
- 투사체: trail / glow
- 피격 / 사망 / 골드 획득 이펙트

### T4.9 환경 / 조명

- 스카이박스 또는 HDR 환경 맵
- 디렉셔널 라이트 + 그림자
- 톤매핑 / 후처리 (블룸 등 가벼운 수준)

### T4.10 UI 비주얼 폴리시

- HUD 톤 통일 (현재 회색 박스)
- 라이프 감소 / 골드 획득 / 콤보 시각 피드백
- GameOver / WaveClear / Menu 오버레이 디자인
- 폰트 / 컬러 시스템 정리

### 범위 밖 (당장은)

- VRM 캐릭터 재도입
- 풀 PBR 파이프라인 (별도 에셋 작업 필요)
- 캐릭터 커스터마이즈

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

- **기본 정책: 자동 테스트를 추가하지 않는다.** 에이전트가 매 작업마다 Playwright 케이스를 짜고 돌리는 비용(토큰/시간)이 얻는 가치보다 크다. 검증은 사람이 직접 브라우저로 확인한다.
- **단위 테스트 프레임워크(Vitest)는 쓰지 않는다.** 도입했다가 제거된 이력이 있다.
- **테스트는 사용자가 명시적으로 요청할 때만 작성한다.** 그 경우에도 Playwright만 쓴다. 플랜/태스크 문서에 "테스트 작성"을 기본 단계로 적지 않는다.
- 사용자 요청으로 테스트를 추가하더라도 **테스트 전용 `window.__xxx` 훅은 추가하지 않는다.** 시뮬레이션이 꼭 필요하면 정식 모듈 API로 노출한다.

현재 자동 테스트는 없다 (`web/tests/`는 비어 있음). 필요할 때 사용자가 직접 요청한다.

## 리스크와 미정 사항

- **메인 스레드 MediaPipe 성능**: 현재는 충분하지만, 모바일에서는 병목이 될 수 있다.
- **worker 재도입**: MediaPipe Tasks Vision WASM 초기화 문제 해결 전까지 보류.
- **카메라 보정**: 사용자 체형/카메라 위치별 운동 인식 안정화가 필요하다.
- **골드 밸런스**: 운동 보상과 타워 비용이 연결되었지만, 비용(30)/라이프(20) 잠정값이며 플레이 테스트 후 조정 필요.
- **디펜스 밸런스**: 현재는 수락 테스트용 최소 전투다.
- **캐릭터 리타게팅**: 팔 외 본은 아직 제한적이다.
- **모바일 성능/권한**: 배포 전에 별도 확인 필요.

## 당장 다음 액션

1. ~~페이즈 상태 머신을 만든다.~~ ✅ (T4.1)
2. ~~골드 소비와 타워 배치를 연결한다.~~ ✅ (T4.2)
3. ~~라이프/게임오버를 추가한다.~~ ✅ (T4.3)
4. 디펜스 웨이브와 타워 종류를 확장한다. (T4.4)
5. 실제 플레이 화면 UX를 정리한다. (T4.5)
