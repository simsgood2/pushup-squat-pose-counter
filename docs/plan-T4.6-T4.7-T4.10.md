# 구현 플랜 — T4.6 카메라 + T4.7 맵 비주얼 + T4.10 UI 폴리시

소넷이 한 세션으로 처리할 비주얼 폴리시 번들. 마스터 플랜은 [game-redesign-plan.md](./game-redesign-plan.md). 새 GLB 에셋은 도입하지 않음(T4.8과 분리). 코드와 머티리얼/CSS만으로 "게임답게" 보이게 한다.

## 결정 사항 (확정)

- **톤**: 다크 네온 / 사이버 풍. 현재 회색·그린 라인 톤을 유지하면서 시안-민트 액센트와 살짝 글로우를 더한다. 풀 미래 SF X, 어두운 베이스에 네온 포인트.
- **카메라 전환**: 페이즈별 프리셋 + 1초 이즈인아웃 트윈. 즉시 점프 X.
- **가시성 분리**: Exercise 페이즈에선 그리드/타워/적 숨김. Defense·Build에선 캐릭터 유지(축소 아님). Menu/WaveClear/GameOver는 둘 다 보임.

## 컬러 팔레트 (모든 곳에서 통일해서 사용)

```ts
export const COLORS = {
  bgDeep:    0x07090d,
  bgPanel:   0x0e1218,
  accentCyan:  0x00ffd1,   // 액센트 (네온 시안-민트)
  accentBlue:  0x4d8aff,   // 보조 (현재 basic 타워 색 계열)
  warn:        0xff3360,   // 경고/위험
  gridLine:    0x1a3340,   // 어두운 시안 그리드
  gridLineHi:  0x33ffd1,   // hover/active
  pathBase:    0x0a1e26,   // 경로 셀 베이스
  pathGlow:    0x00ffd1,   // 경로 외곽선/방향
  textBase:    0xe6f1ff,
  textDim:     0x7d92b0,
};
```

CSS 측에도 동일 값:

```css
--bg-deep: #07090d;
--bg-panel: #0e1218;
--accent-cyan: #00ffd1;
--accent-blue: #4d8aff;
--warn: #ff3360;
--text-base: #e6f1ff;
--text-dim: #7d92b0;
```

## 작업 순서

1. 카메라 프리셋 + 페이즈 트윈 (T4.6)
2. 페이즈별 가시성 분리 (T4.6 잔여)
3. 맵 비주얼 폴리시 (T4.7)
4. HUD/오버레이 스타일 통일 (T4.10)
5. 인터랙션 피드백(골드/라이프) (T4.10)

---

## 1. 카메라 프리셋 + 트윈 (T4.6)

### 1.1 프리셋 정의

신규 파일 `web/src/game/cameraPresets.ts`:

```ts
import * as THREE from 'three';

export interface CameraPreset {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
}

export const CAMERA_PRESETS: Record<'exercise' | 'defense' | 'menu', CameraPreset> = {
  // 운동: 캐릭터 정면 흉상~전신, 약간 위에서 내려다봄
  exercise: {
    position: new THREE.Vector3(0, 1.4, 3.2),
    lookAt:   new THREE.Vector3(0, 1.0, 0),
  },
  // 디펜스: 그리드 비스듬한 탑다운, 그리드가 화면 대부분을 차지
  defense: {
    position: new THREE.Vector3(0, 4.5, 4.0),
    lookAt:   new THREE.Vector3(0, 0, 0),
  },
  // 메뉴/WaveClear/GameOver: 디펜스 프리셋 재사용 (그리드+캐릭터 둘 다 살짝 보이게)
  menu: {
    position: new THREE.Vector3(0.5, 3.0, 4.0),
    lookAt:   new THREE.Vector3(0, 0.8, 0),
  },
};
```

### 1.2 트윈 로직

`scene.ts`에서 OrbitControls는 유지하되, **페이즈 전환 트윈 중에는 controls가 카메라를 만지지 못하게** 일시 비활성. 사용자 드래그도 트윈 중 X.

신규 파일 `web/src/game/cameraTween.ts`:

```ts
export class CameraTween {
  private start = 0;
  private duration = 1.0;
  private from?: { pos: THREE.Vector3; look: THREE.Vector3 };
  private to?: { pos: THREE.Vector3; look: THREE.Vector3 };
  active = false;

  begin(camera: THREE.PerspectiveCamera, currentLookAt: THREE.Vector3, target: CameraPreset, duration = 1.0): void {
    this.from = { pos: camera.position.clone(), look: currentLookAt.clone() };
    this.to   = { pos: target.position.clone(), look: target.lookAt.clone() };
    this.start = performance.now();
    this.duration = duration;
    this.active = true;
  }

  /** Returns updated look-at point, or null if no tween. */
  update(camera: THREE.PerspectiveCamera): THREE.Vector3 | null {
    if (!this.active || !this.from || !this.to) return null;
    const t = Math.min(1, (performance.now() - this.start) / 1000 / this.duration);
    const e = easeInOutCubic(t);
    camera.position.lerpVectors(this.from.pos, this.to.pos, e);
    const look = new THREE.Vector3().lerpVectors(this.from.look, this.to.look, e);
    camera.lookAt(look);
    if (t >= 1) this.active = false;
    return look;
  }
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
```

### 1.3 wiring (`main.ts`)

- `scene.ts`의 `initScene`이 `controls`와 `camera`를 외부로 노출 (현재 `cleanup`만 노출하므로 반환 타입 확장).
- `main.ts`에 `CameraTween` 인스턴스 + `currentLookAt: THREE.Vector3` 보유.
- `phaseStore.subscribe`에서 phase 변경 시 적절한 preset으로 `tween.begin(...)`.
- `scene.ts`의 animate 루프에서 매 프레임 `tween.update(camera)`. 트윈 active 동안 `controls.enabled = false`, 끝나면 `true`.
- 트윈 active 동안엔 `controls.target.copy(updatedLookAt)`도 매 프레임 동기화(끝나면 사용자가 그 지점을 기준으로 자유 회전).

페이즈→프리셋 매핑:

| 페이즈 | preset |
|---|---|
| Menu | menu |
| Exercise | exercise |
| Build | defense |
| Defense | defense |
| WaveClear | defense |
| GameOver | menu |

수락 기준: 페이즈 전환 시 카메라가 ~1초간 부드럽게 이동. 트윈 중엔 마우스 드래그가 카메라에 영향 X. 끝나면 OrbitControls로 자유 회전 가능.

---

## 2. 가시성 분리 (T4.6 잔여)

`DefenseGrid`에 `setVisible(visible: boolean)` 메서드 추가. 내부 `gridGroup` + 모든 타워 메쉬 + 적 메쉬 + 발사체 메쉬의 `visible`을 일괄 토글.

`main.ts`:

- 캐릭터는 `characterGroup.visible`로 토글.
- 페이즈별 매핑:
  - Menu / WaveClear / GameOver: 캐릭터 ON, 그리드 ON
  - Exercise: 캐릭터 ON, 그리드 OFF
  - Build / Defense: 캐릭터 OFF, 그리드 ON

수락 기준: Exercise 페이즈에선 그리드/타워/적이 사라짐. Build/Defense에선 캐릭터가 사라지고 그리드만. 전환 시 카메라 트윈과 동시에 자연스러움.

---

## 3. 맵 비주얼 폴리시 (T4.7)

### 3.1 path 셀 머티리얼

현재 갈색 평면 → 다크 시안 베이스 + 외곽선 + 가운데 점선 글로우.

`DefenseGrid._buildVisual` 또는 `_drawPath`(있다면) 수정:

- path 셀: `MeshBasicMaterial({ color: COLORS.pathBase, transparent: true, opacity: 0.85 })` 평면.
- path 외곽선: 인접한 path 셀끼리 묶어서 외곽 사각형의 라인 — 간단화: 셀마다 RingGeometry 또는 EdgesGeometry 외곽선(`color: COLORS.pathGlow, opacity: 0.6`).
- 폴리시 한 단계 위로 가려면 path를 따라 길게 PlaneGeometry로 연결한 띠를 깔고 가운데 글로우 라인 그리는 방식 권장(셀 단위는 덜 매끄러움). 간단판: 셀별 평면 + 외곽선으로 시작.

### 3.2 스폰/엔드 마커

현재 단순 cylinder → 펄스 애니메이션.

- 스폰: `color: COLORS.accentCyan`, 반지름 0.12, 높이 0.03. 매 프레임 `scale.x = scale.z = 1 + 0.15 * Math.sin(t * 4)`.
- 엔드: `color: COLORS.warn`, 같은 사이즈/펄스.
- 둘 다 위에 작은 floating 텍스트 대체로 위쪽에 살짝 솟은 cone(스폰: 위 가리킴, 엔드: 아래)로 방향 강조.

펄스 갱신은 `DefenseGrid._tick`에서 `performance.now()` 기반.

### 3.3 hover 피드백 (빈 셀 / 막힌 셀)

신규 메쉬: `_hoverCellMesh` (PlaneGeometry 1×1, 셀 위 평면). 평소 visible=false.

`_handleMousemove`에서:

- 현재 hover된 셀이 빈 셀 + path 셀 X → `color: COLORS.gridLineHi`, opacity 0.35, 보이게.
- path 셀이거나 점유 셀 → `color: COLORS.warn`, opacity 0.35, 보이게.
- 그리드 밖이거나 input disabled → 숨김.

기존 사거리 미리보기 원과 동시 표시(둘 다 다른 정보).

### 3.4 그리드 라인 톤

기존 0x00ff88 → COLORS.gridLine(#1a3340)으로 변경. 살짝 어둡고 차분하게.

수락 기준: ⊓자 경로가 어두운 시안 띠로 명확히 보임. 스폰/엔드 마커가 부드럽게 펄스. 그리드 hover 시 셀 강조 + 막힌 셀은 빨간 강조.

---

## 4. HUD / 오버레이 스타일 통일 (T4.10)

### 4.1 글로벌 스타일

`web/index.html`의 `<style>` 블록 확장:

```css
:root {
  --bg-deep: #07090d;
  --bg-panel: rgba(14, 18, 24, 0.85);
  --accent-cyan: #00ffd1;
  --accent-blue: #4d8aff;
  --warn: #ff3360;
  --text-base: #e6f1ff;
  --text-dim: #7d92b0;
  --border-faint: rgba(0, 255, 209, 0.25);
  --shadow-glow: 0 0 12px rgba(0, 255, 209, 0.35);
}
html, body { margin: 0; padding: 0; overflow: hidden; height: 100%;
  background: var(--bg-deep); color: var(--text-base);
  font-family: 'JetBrains Mono', 'Consolas', monospace; }
#game-canvas { display: block; }

.hud-panel { background: var(--bg-panel); border: 1px solid var(--border-faint);
  border-radius: 8px; padding: 10px 16px; backdrop-filter: blur(6px); }
.hud-btn { background: transparent; border: 1px solid var(--accent-cyan);
  color: var(--accent-cyan); padding: 6px 14px; border-radius: 6px; cursor: pointer;
  font-family: inherit; font-size: 14px; letter-spacing: 0.04em;
  transition: box-shadow 0.15s, background 0.15s; }
.hud-btn:hover { box-shadow: var(--shadow-glow); background: rgba(0, 255, 209, 0.08); }
.hud-btn:disabled { border-color: var(--text-dim); color: var(--text-dim);
  cursor: not-allowed; box-shadow: none; }
.hud-label-dim { color: var(--text-dim); }
.hud-overlay { position: fixed; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; background: rgba(7, 9, 13, 0.85);
  backdrop-filter: blur(8px); z-index: 200; }
.hud-overlay h1 { color: var(--accent-cyan); font-size: 36px; letter-spacing: 0.1em;
  text-shadow: var(--shadow-glow); margin-bottom: 24px; }
```

### 4.2 PhaseHud 리팩토링

기존 inline cssText 덩어리 → 클래스 사용:

- `hudBar`에 `class="hud-panel"`, inline 위치/크기만 남김.
- 모든 버튼에 `class="hud-btn"`.
- "라이프: " "골드: " "타워 비용: " 같은 라벨은 `class="hud-label-dim"`.
- menuOverlay, gameOverOverlay에 `class="hud-overlay"`. h1은 그대로 사용.

### 4.3 TowerPanel 리팩토링

- 패널 본체에 `class="hud-panel"`, inline은 위치만.
- 카드 hover 시 시안 글로우, 선택된 카드는 그 글로우 영구 표시(`box-shadow: var(--shadow-glow); border-color: var(--accent-cyan)`).
- 골드 부족 카드는 회색(`opacity: 0.5`, cursor: not-allowed).

### 4.4 ExerciseHud 리팩토링

- 같은 톤으로 `hud-panel`/`hud-label-dim` 적용. 운동 종류 라벨은 accent-cyan으로 강조.

수락 기준: HUD/패널/오버레이 모두 같은 다크 시안 톤. 버튼 호버 시 시안 글로우. 메뉴/게임오버 오버레이가 다크 블러 + 시안 제목.

---

## 5. 인터랙션 피드백 (T4.10)

### 5.1 골드 획득 플로팅 텍스트

신규 `web/src/ui/feedback.ts`:

```ts
export function spawnFloatingGold(amount: number, x: number, y: number): void {
  const el = document.createElement('div');
  el.textContent = `+${amount}`;
  el.style.cssText = `position: fixed; left: ${x}px; top: ${y}px; color: var(--accent-cyan);
    font-family: inherit; font-size: 18px; font-weight: bold; pointer-events: none;
    text-shadow: 0 0 8px rgba(0, 255, 209, 0.6); z-index: 150;
    animation: floatUp 0.9s ease-out forwards;`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 900);
}
```

CSS animation:

```css
@keyframes floatUp {
  0% { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(-40px); opacity: 0; }
}
```

`goldStore.addGold`가 호출되면 트리거. 좌표는 hud의 골드 라벨 위치 근처(약간 오른쪽 위 띄움) 또는 화면 중앙 위쪽. 단순화: HUD 골드 라벨 DOM 위치 기반.

`PhaseHud._render` 또는 별도 subscribe에서 gold delta를 추적해 호출.

### 5.2 라이프 감소 플래시

`loseLife()` 발생 시 화면 전체에 빨간 반투명 오버레이 0.3초 페이드 인/아웃.

`web/src/ui/feedback.ts`에 `flashLifeLoss()` 함수 추가. `main.ts`에서 `onEnemyReachedEnd` 콜백에 함께 호출.

```ts
export function flashLifeLoss(): void {
  const el = document.createElement('div');
  el.style.cssText = `position: fixed; inset: 0; background: var(--warn);
    opacity: 0; pointer-events: none; z-index: 90;
    animation: lifeFlash 0.4s ease-out forwards;`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 400);
}
```

```css
@keyframes lifeFlash {
  0% { opacity: 0; } 30% { opacity: 0.35; } 100% { opacity: 0; }
}
```

수락 기준: 적 처치 시 골드 +텍스트가 시안 글로우와 함께 위로 떠올라 사라짐. 적이 끝점 도달 시 화면이 짧게 빨갛게 깜빡.

---

## 파일 변경 요약

| 파일 | 변경 |
|---|---|
| `index.html` | CSS 변수, .hud-* 유틸 클래스, @keyframes |
| `scene.ts` | `initScene` 반환에 `camera`, `controls` 추가. 라이트 톤 미세 조정(현재 컬러 유지) |
| `game/cameraPresets.ts` (신규) | 페이즈별 카메라 위치/lookAt |
| `game/cameraTween.ts` (신규) | 트윈 클래스 |
| `main.ts` | 페이즈 전환 시 카메라 트윈 + 가시성 토글 wiring |
| `defense/grid.ts` | path 머티리얼/외곽선, 스폰/엔드 마커 펄스, hover 셀 강조, 그리드 라인 톤, `setVisible()` |
| `ui/PhaseHud.ts` | hud-panel/hud-btn 클래스 사용으로 리팩토링 |
| `ui/TowerPanel.ts` | 같은 톤으로 리팩토링, 카드 hover/select glow |
| `ui/ExerciseHud.ts` | 같은 톤으로 리팩토링 |
| `ui/feedback.ts` (신규) | spawnFloatingGold, flashLifeLoss |
| `exercise/rewards.ts` 또는 wiring | `addGold` 호출 후 `spawnFloatingGold` 트리거 (PhaseHud에서 구독해도 OK, 더 깔끔하면 그쪽) |

## 범위 밖 (절대 손대지 말 것)

- 타워/적/캐릭터 GLB 모델 교체 (T4.8)
- HDR 환경, EffectComposer, 블룸, SSAO (T4.9)
- 운동 분류 로직 변경
- 캐릭터 리타게팅 변경
- 사이드 패널/HUD 위치/구조 변경 (스타일만 폴리시)
- 자동 테스트 추가 (`web/tests/`는 비워둘 것)
- 마스터 플랜 문서 갱신 (별도로 함)
- 폰트 파일 추가 다운로드 (시스템 모노스페이스로 충분)

## 검증 방법

타입체크: `cd web && npx tsc --noEmit`

수동 동작 확인(사용자가 직접):
1. Menu → "게임 시작" → 카메라가 부드럽게 운동 프리셋으로 이동, 그리드 사라지고 캐릭터만 보임
2. "건설 시작" 클릭 → 카메라가 디펜스 프리셋(비스듬한 탑다운)으로 트윈, 캐릭터 사라지고 그리드 보임
3. ⊓자 경로가 다크 시안 띠로 명확히 보이고, 스폰(시안)/엔드(빨강) 마커가 펄스
4. 그리드 hover 시 빈 셀은 시안, path 셀은 빨강 강조
5. 타워 배치 가능 카드는 시안 글로우, 골드 부족 카드는 회색
6. 적 처치 시 "+10" 같은 시안 텍스트가 위로 떠오름
7. 적이 끝점 도달 시 화면이 빨갛게 짧게 깜빡
8. GameOver 오버레이 다크 블러 + 시안 제목, "다시 시작" 버튼 시안 글로우 호버
