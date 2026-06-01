# 모캡 디펜스 게임 리디자인 계획

운동 동작이 3D 캐릭터에 동기화되고 운동으로 모은 골드로 디펜스를 플레이하는 웹 게임. 2026-05-29 기준 MVP는 `web/` 아래 TypeScript + Vite + Three.js 앱.

## 스택

| 영역 | 선택 |
|---|---|
| 언어 / 번들러 | TypeScript + Vite |
| 3D 렌더 | Three.js |
| 포즈 추론 | MediaPipe Tasks for Web `PoseLandmarker` (메인 스레드) |
| 캐릭터 | GLB (`manny.glb`), Three.js `GLTFLoader` |
| 리타게팅 | 커스텀 본 매핑 + quaternion (거울 모드, 팔/다리, visibility-스케일 슬러프) |
| 상태 관리 | Zustand vanilla (`goldStore`, `phaseStore`) |
| UI | HTML overlay (`ExerciseHud`, `PhaseHud`) |

`poseWorker.ts`는 보존 중이지만 현재 미사용. MediaPipe Tasks WASM이 module worker에서 안정적으로 초기화되지 않아 메인 스레드 경로를 기준으로 둠.

## 구현 완료

- Three.js 씬, 조명, 바닥, OrbitControls
- MediaPipe Pose Landmarker → 33 landmark 메인 스레드 추론
- GLB 캐릭터 로드 + 팔/다리 본 리타게팅 (거울 모드, visibility 비례 스무딩)
- 운동 분류기 5종 (푸시업, 스쿼트, 점프, 런지, 팔벌려뛰기) + 콤보/깊이/다양성 보너스
- Zustand 골드 누적 + `ExerciseHud`
- 페이즈 상태 머신: `Menu / Exercise / Build / Defense / WaveClear / GameOver`
- `PhaseHud`: 메뉴, 페이즈/라운드/타이머/라이프/골드 잔액/타워 비용, 건설/웨이브/다음 라운드 버튼
- 디펜스 맵: ⊓자 경로(좌하 → 좌상 → 우상 → 우하), 경로 셀 타워 배치 금지, 스폰/엔드 마커
- 디펜스: 8×8 그리드, 타워 3종(basic/area/slow), 적 4종(basic/fast/armored/boss)
- 사이드 타워 패널: 카드 선택 + 사거리/splash 미리 보기 원
- 웨이브 1~5 점진+보스 스크립트, 라운드별 적 종류 혼합
- 골드 차감, 라이프 시스템(초기 20), GameOver → "다시 시작" → 메뉴 복귀(완전 리셋)
- 페이즈별 카메라 프리셋 + 1초 easeInOutCubic 트윈 (Exercise: 정면, Defense/Build: 비스듬한 탑다운)
- 페이즈별 가시성 토글: Exercise엔 그리드 숨김, Build/Defense엔 캐릭터 숨김
- 맵 비주얼 폴리시: 경로 셀 다크 시안 + 글로우 외곽선, 스폰/엔드 마커 펄스, hover 셀 강조, 그리드 라인 어두운 시안
- UI 다크 시안 통일: CSS 변수 + `.hud-*` 유틸 클래스, 골드 플로팅 텍스트, 라이프 감소 화면 플래시
- 타워/적 절차적 지오메트리 (box/sphere → 종류별 형태 + emissive 네온 재질, `visuals.ts` 팩토리로 GLB 교체 대비)
- 투사체 glow 스프라이트 + 페이드 trail, 피격 스파크 / 사망 폭발 링 / 골드 스파클 이펙트 (`effects.ts`)

## 아키텍처

```text
web/src/
├── main.ts                    # 런타임 엔트리, 씬/모캡/HUD/디펜스 연결
├── scene.ts                   # Three.js renderer, camera, light, ground
├── mocap/
│   ├── poseStream.ts          # 현재 사용: 메인 스레드 MediaPipe Pose
│   └── poseWorker.ts          # 보존, 미사용
├── character/
│   ├── gltfLoader.ts
│   ├── fbxLoader.ts           # 캐릭터 정규화 helper
│   ├── retargetBones.ts       # MediaPipe → GLB 본 회전 (거울/스무딩)
│   └── stickFigure.ts         # 디버그용, 현재 미렌더
├── exercise/
│   ├── angle.ts
│   ├── repCounter.ts
│   ├── rewards.ts
│   └── classifiers/{pushup,squat,jump,lunge,jumpingJack}.ts
├── defense/
│   ├── grid.ts                # 그리드, ⊓자 경로, 타워 배치, 영속 투사체 trail, 이펙트 연결, 시뮬레이션 루프
│   ├── towers.ts              # basic / area / slow 3종 + projectile id / impact 이벤트
│   ├── enemies.ts             # basic / fast / armored / boss 4종 (kind 포함) + 슬로우/감산
│   ├── waves.ts               # 라운드 1~5 스크립트
│   ├── visuals.ts             # 타워/적 절차적 지오메트리 팩토리 (GLB 교체 지점)
│   ├── effects.ts             # 피격/사망/골드 파티클 + glow 텍스처 (additive)
│   └── towerSelection.ts      # 선택된 타워 종류 zustand 스토어
├── game/
│   ├── phaseMachine.ts        # 페이즈 + phaseStore (restart 포함)
│   ├── cameraPresets.ts       # 페이즈별 카메라 position/lookAt 프리셋
│   └── cameraTween.ts         # 1초 easeInOutCubic 카메라 트윈
├── ui/
│   ├── ExerciseHud.ts
│   ├── PhaseHud.ts            # 골드/라이프/비용 HUD + GameOver 재시작 버튼
│   ├── TowerPanel.ts          # 사이드 타워 카드 패널
│   └── feedback.ts            # 골드 플로팅 텍스트, 라이프 감소 플래시
└── assets/characters/manny.glb
```

## 게임 컨셉

```text
[Exercise: 60초 운동] → 골드 정산
        ↓
[Build: 타워 배치]
        ↓
[Defense: 웨이브 방어] → 클리어 시 다음 라운드 / 실패 시 GameOver
```

장기적으로는 랜덤 상점, 타워 등급, 변이 웨이브, 이벤트 카드 같은 로그라이크 요소를 붙인다.

## 남은 태스크

### ~~T4.4 디펜스 콘텐츠 확장~~ ✅ (2afac8d)
### ~~T4.5 UX 정리~~ ✅ (2afac8d + 5668e9d)
### ~~T4.6 페이즈별 카메라 / 씬 구도~~ ✅ (5668e9d)
### ~~T4.7 디펜스 맵 비주얼~~ ✅ (5668e9d)
### ~~T4.10 UI 비주얼 폴리시~~ ✅ (5668e9d)

### ~~T4.8 모델 업그레이드~~ ✅ (지오메트리 버전)
- 타워/적: box/sphere → 종류별 절차적 지오메트리 + emissive 네온 재질 (`visuals.ts` 팩토리 → 추후 GLB로 한 줄 교체)
- 투사체: glow 스프라이트 + 페이드 trail
- 피격(스파크) / 사망(폭발 링 + puff) / 골드(상승 스파클) 이펙트 (`effects.ts`)
- 실제 GLB 에셋 교체는 에셋 확보 후 진행 (visuals.ts 내부만 수정)

### T4.9 환경 / 조명
- 스카이박스 또는 HDR 환경 맵
- 디렉셔널 라이트 + 그림자
- 톤매핑 / 후처리 (블룸 등)

### 범위 밖 (당장은)
- VRM 재도입
- 풀 PBR 파이프라인
- 캐릭터 커스터마이즈

## 동작 분류 규칙

기존 Python 카운터 임계값을 출발점으로 포팅.

| 동작 | 핵심 관절 | 다운 조건 | 업 조건 | 추가 조건 |
|---|---|---|---|---|
| 푸시업 | 팔꿈치 | 각도 작아짐 | 각도 펴짐 | 몸통 수평 |
| 스쿼트 | 무릎 | 각도 작아짐 | 각도 펴짐 | 몸통 수직 |
| 점프 | 발목 Y | 기준선 근처 | 기준선보다 상승 | 짧은 시간 내 복귀 |
| 런지 | 무릎 + z 거리 | 앞다리 굽힘 | 다시 섬 | 양 다리 전후 차이 |
| 팔벌려뛰기 | 어깨/팔 + 발목 거리 | 팔 내림 + 발 모음 | 팔 올림 + 발 벌림 | 동시성 |

웹캠 환경에 따라 사용자 키/카메라 각도 보정 UI가 필요할 수 있음.

## 테스트 정책

- **기본은 자동 테스트를 추가하지 않는다.** 토큰/시간 비용이 가치보다 크다고 판단. 검증은 사람이 직접 브라우저로 확인.
- Vitest는 쓰지 않는다.
- 사용자가 명시적으로 요청할 때만 Playwright로 작성. 플랜에 "테스트 작성" 단계를 기본으로 적지 않음.
- 테스트를 추가하더라도 `window.__xxx` 훅은 만들지 않는다. 필요하면 정식 모듈 API로 노출.
- 현재 `web/tests/`는 비어 있음.

## 리스크와 미정

- **메인 스레드 MediaPipe 성능**: 데스크톱은 충분. 모바일에서 병목 가능 → worker 재도입 보류 중 (MediaPipe Tasks WASM worker 초기화 이슈 해결 필요).
- **카메라 보정**: 사용자 체형/위치별 운동 인식 안정화 필요. 다리 떨림은 visibility-스케일 슬러프로 부분 완화.
- **밸런스**: 타워 비용 30 / 라이프 20은 잠정값. 플레이 테스트 후 조정.
- **캐릭터 리타게팅**: 팔/다리는 됨. 척추/머리/손가락은 미구현.
- **모바일 성능/권한**: 배포 전 별도 확인.
