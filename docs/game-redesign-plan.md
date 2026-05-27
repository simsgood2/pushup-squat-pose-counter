# 모캡 디펜스 게임 리디자인 계획

기존 Python 포즈 카운터를 기반으로, 사용자의 운동 동작이 3D 캐릭터에 동기화되고 그 결과로 모은 골드로 디펜스 페이즈를 플레이하는 게임으로 확장한다.

## 결론

**TypeScript + Three.js + three-vrm + Kalidokit + MediaPipe Tasks for Web** 스택으로 새로 만든다. 기존 Python 코드베이스(카운터 임계값, 운동 분류 규칙 등)는 참고만 하고 살리지 않는다.

## 왜 JS인가

| 기준 | JS (Three.js) | Python (Panda3D) |
|---|---|---|
| MediaPipe 통합 | 브라우저 네이티브, 단일 프로세스 | 네이티브, 단일 프로세스 |
| 3D 애니메이션 파이프라인 | glTF/VRM 표준, AnimationMixer 즉시 사용 | .egg/.bam 변환 필요, 자료 부족 |
| 모션 리타게팅 | Kalidokit이 짠 채로 존재 | 동급 라이브러리 없음, 직접 구현 |
| 보조 라이브러리 | npm 생태계 (물리·UI·포스트프로세싱·캐릭터 컨트롤러) | 직접 구현 |
| 배포 | `vite build` 후 URL 하나 | exe 빌드, 카메라 권한 OS별 차이 |
| 에이전트 검증 루프 | Playwright 스크린샷 1줄 | OS별 GUI 캡처 직접 구현 |

핵심: **리타게팅 1주 → 라이브러리 호출 1시간**으로 줄어드는 게 가장 큼.

## 최종 스택

| 영역 | 선택 |
|---|---|
| 언어 | TypeScript |
| 번들러 / Dev 서버 | Vite |
| 3D 렌더 | Three.js (WebGL2 기본, 필요 시 WebGPU) |
| 캐릭터 포맷 | VRM 1.0 (three-vrm으로 로드) |
| 포즈 추론 | MediaPipe Tasks for Web (Pose Landmarker) |
| 리타게팅 | Kalidokit |
| 캐릭터 제작 | VRoid Studio (toon 셰이딩 끄고 PBR로 교체 예정) |
| 상태 관리 | Zustand 또는 단순 module-level store |
| UI | React (HUD·메뉴) 또는 Three.js 위 lil-gui |
| 테스트 | Vitest (게임 로직) + Playwright (시각 회귀) |

## 게임 컨셉

두 페이즈가 번갈아 도는 로그라이크형 디펜스 게임.

### 페이즈 A — 운동 (골드 수급)

- 제한 시간 안에 자유롭게 동작 수행
- 동작별 기본 가치(잠정안):
  - 푸시업: 10g / rep
  - 스쿼트: 8g / rep
  - 점프: 5g / rep
  - 런지: 12g / rep (좌/우 교차)
  - 팔벌려뛰기: 4g / rep
- 자세 깊이 보너스: 각도가 임계값보다 더 깊으면 1.0 ~ 1.5배
- 콤보 시스템: 동일 동작 연속 3회마다 다음 1회 가치 1.2배 (상한 2.0배)
- 다양성 보너스: 라운드 중 사용한 동작 종류가 N개 이상이면 라운드 종료 시 보정

### 페이즈 B — 디펜스 (운빨존많겜)

- 모은 골드로 타워/유닛 구매, 적 웨이브 방어
- 운빨 요소:
  - 픽3 랜덤 상점 (로그라이크식) — 매 웨이브 후 리롤 가능 (리롤 비용 골드)
  - 타워 등급 가챠 — 같은 골드로 일반/희귀/전설 확률 분포
  - 변이 웨이브 — 매 웨이브마다 1~2개의 랜덤 변이 (속도+30%, 광역 면역 등)
  - 이벤트 카드 — 가끔 등장, "다음 운동 페이즈 골드 2배" 같은 효과

### 진행 루프

```
[페이즈 A: 60초 운동] → 골드 정산
       ↓
[페이즈 B: 타워 배치 → 웨이브 1] → 클리어 시 다음 라운드
       ↓
[페이즈 A: 45초 운동, 난이도↑] → ...
       ↓
보스 웨이브 도달 → 클리어 / 사망
```

## 아키텍처

```
src/
├── main.ts                    # 엔트리, 씬 부트스트랩
├── core/
│   ├── gameLoop.ts            # 메인 루프, requestAnimationFrame
│   ├── stateMachine.ts        # PhaseA / PhaseB / Menu / GameOver
│   └── store.ts               # 골드, HP, 라운드, 인벤토리
├── mocap/
│   ├── poseWorker.ts          # MediaPipe를 WebWorker에서 실행
│   ├── poseStream.ts          # 메인 스레드 측 좌표 구독자
│   └── retarget.ts            # Kalidokit 래퍼
├── character/
│   ├── vrmLoader.ts           # three-vrm으로 .vrm 로드
│   └── rigBinder.ts           # poseStream → VRM humanoid 본
├── exercise/
│   ├── classifier.ts          # 좌표 → 동작 분류 (각도 기반 규칙)
│   ├── repCounter.ts          # 동작별 카운트 + 깊이 보정
│   └── rewards.ts             # 동작 → 골드 매핑 테이블
├── defense/
│   ├── grid.ts                # 타워 배치 좌표계
│   ├── towers.ts              # 타워 정의/스탯
│   ├── enemies.ts             # 적 정의/스탯
│   ├── waves.ts               # 웨이브 스크립트 + 변이 RNG
│   └── shop.ts                # 픽3 상점 + 가챠 확률표
├── ui/
│   ├── Hud.tsx                # 골드/HP/타이머 표시
│   ├── ShopModal.tsx          # 상점 픽3
│   └── ExerciseHud.tsx        # 카운트·콤보·다양성
└── assets/
    ├── characters/*.vrm
    ├── towers/*.glb
    └── enemies/*.glb
```

### 스레드 분리

- **MediaPipe inference는 WebWorker**에서 실행. 메인 스레드의 렌더 루프(16.6ms 예산)를 막지 않음.
- Worker는 매 추론마다 33개 관절의 3D 월드 좌표만 메인 스레드로 `postMessage`.
- 메인 스레드는 받은 좌표를 Kalidokit으로 변환 → VRM 본에 적용 → 렌더.

### 페이즈 상태 머신

```
Menu ─→ PhaseA(round=1) ─→ Tally ─→ PhaseB(round=1)
                                        │
                                        ↓
                              ┌── Cleared → PhaseA(round=2)
                              │
                              └── Dead → GameOver
```

## 구현 순서 (마일스톤)

### M1 — 뼈대 (목표: 캐릭터가 내 움직임 따라함)

- [ ] Vite + TypeScript 프로젝트 부트스트랩
- [ ] Three.js 씬: 카메라·라이트·바닥
- [ ] VRoid Studio로 임시 캐릭터 1체 제작 → three-vrm으로 로드
- [ ] MediaPipe Tasks for Web을 WebWorker에서 띄우기
- [ ] Kalidokit으로 좌표 → 본 회전 변환 → 캐릭터에 적용
- [ ] **검증**: 웹캠 앞에서 손 흔들면 캐릭터가 같이 흔들면 성공

### M2 — 운동 인식 (목표: 동작 카운트 + 골드 표시)

- [ ] 각도 계산 유틸 (기존 [utils.py](../utils.py)의 로직 포팅)
- [ ] 푸시업/스쿼트 RepetitionCounter 포팅 ([counter.py](../counter.py) 임계값 참고)
- [ ] 점프 / 런지 / 팔벌려뛰기 분류 규칙 추가
- [ ] 동작별 골드 매핑 + 콤보 + 깊이 보정
- [ ] 운동 HUD (현재 동작·카운트·콤보·골드)
- [ ] **검증**: 60초 페이즈 안에 5종 동작 다 인식 + 골드 누적

### M3 — 디펜스 페이즈 (목표: 한 라운드 플레이 가능)

- [ ] 그리드 + 타워 배치 UI (마우스로 충분)
- [ ] 타워 3종 (단일딜·광역·슬로우) + 적 3종 (보병·기갑·고속)
- [ ] 웨이브 스크립트 1~5
- [ ] HP 시스템 + 게임오버
- [ ] **검증**: M2에서 모은 골드로 5웨이브 클리어 가능

### M4 — RNG 레이어 (운빨존많겜 결)

- [ ] 픽3 상점 + 리롤
- [ ] 타워 가챠 등급 + 시각 차별화
- [ ] 변이 웨이브 (랜덤 modifier 1~2개)
- [ ] 이벤트 카드 시스템
- [ ] **검증**: 같은 시드로 100판 시뮬레이션 → 골드 곡선·승률 균형

### M5 — 룩 & 폴리시

- [ ] VRM toon 셰이더 → PBR 머티리얼 교체 (버튜버 인상 제거)
- [ ] 캐릭터 2~3종 선택지
- [ ] 사운드 (배경음·타격·웨이브 시작)
- [ ] 포스트프로세싱 (bloom·vignette 약하게)
- [ ] **검증**: 처음 보는 사람 5명에게 30분 플레이 시켜보기

### M6 — 배포

- [ ] `vite build` → 정적 호스팅 (Vercel/Cloudflare Pages 무료)
- [ ] 모바일 카메라 권한·해상도 테스트
- [ ] PWA 설치 가능하게

## 동작 → 분류 규칙 (참고)

기존 Python 카운터의 임계값을 시작점으로:

| 동작 | 핵심 관절 | 다운 조건 | 업 조건 | 추가 조건 |
|---|---|---|---|---|
| 푸시업 | 팔꿈치(왼/오른) | 각도 < 105° | 각도 > 155° | 몸통 수평 (어깨-엉덩이 벡터가 바닥과 가까움) |
| 스쿼트 | 무릎(왼/오른) | 각도 < 105° | 각도 > 160° | 몸통 수직 |
| 점프 | 발목 Y 좌표 | 기준선 아래 | 기준선보다 0.1m 이상 위 | 짧은 시간 안에 복귀 |
| 런지 | 앞다리 무릎 | 각도 < 110° | 각도 > 160° | 양 무릎의 z 거리 차이 큼 |
| 팔벌려뛰기 | 어깨-팔 각도 + 발목 거리 | 팔 내림 + 발 모음 | 팔 올림 + 발 벌림 | 동시성 |

상세 임계값은 M2에서 실측 보정.

## 캐릭터 룩 처리

VRM = 버튜버 룩 인상을 피하려면:

- **VRoid의 기본 MToon 셰이더를 Three.js `MeshStandardMaterial` (PBR)로 교체**
- 머리카락은 카툰 하이라이트 끄고 PBR specular로
- 옷 텍스처를 좀 더 사실적인 것으로 (Substance/Mixamo asset에서 옷만 추출)
- 또는 처음부터 Mixamo 캐릭터 + 본 매핑 테이블 직접 (작업량 1~2일 더)

MVP에선 VRoid 디폴트 그대로 가고, M5에서 셰이더만 갈아끼우는 게 시간 효율적.

## 에이전트 친화 포인트 (왜 이 스택이 빠른가)

- **단일 프로세스**: MediaPipe·렌더·게임 로직이 한 브라우저 탭 안. 에이전트가 한 곳만 봄.
- **Playwright 검증**: 에이전트가 `npx playwright` 한 줄로 스크린샷 + DOM 확인 가능.
- **HMR**: Vite의 hot module reload로 코드 수정 즉시 반영. 에이전트가 결과를 빨리 확인.
- **TypeScript**: 타입 오류가 컴파일 단계에서 잡힘. 에이전트가 무근거 추측을 줄임.
- **거대한 학습 데이터**: Three.js·MediaPipe Tasks Web·VRM 관련 코드 예제가 모델 학습 데이터에 풍부.

## 리스크와 미정 사항

- **MediaPipe 입력 지연**: 20~30ms는 어떤 스택에서도 동일. 타이밍 게임이 아니라 카운팅 게임이라 게임 디자인에는 문제 없음.
- **모바일 성능**: 저가형 안드로이드에서 MediaPipe Pose Full 모델은 무거울 수 있음. Lite 모델 기본으로.
- **VRM 라이선스**: VRoid 캐릭터 배포 시 라이선스 확인 필요. 게임 내 기본 캐릭터는 자체 제작 또는 CC0 모델로.
- **운빨존많겜 밸런스**: M4 후 시뮬레이션 기반 튜닝 필수. 그 전엔 디자인 결정 보류.

## 다음 액션

이 문서 머지 후, 새 디렉토리(예: `web/` 또는 별도 레포)에서 M1부터 시작.
