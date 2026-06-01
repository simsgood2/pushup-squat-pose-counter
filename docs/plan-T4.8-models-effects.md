# T4.8 — 모델 업그레이드(지오메트리) + 이펙트

## Context
디펜스 타워/적/투사체가 전부 box·sphere primitive(`web/src/defense/grid.ts`의 `_spawnTowerMesh`/`_spawnEnemyMesh`/`_syncProjectileMeshes`). 게임용 3D 에셋은 아직 없고 추후 GLB로 교체 예정. 이번 단계는 순수 지오메트리 + emissive 재질로 다크 시안 네온 톤에 맞춰 종류별로 예쁘게 만들고, 투사체 glow/trail과 피격·사망·골드 이펙트를 추가한다. 나중에 GLB로 한 줄 교체할 수 있도록 비주얼 생성을 팩토리로 격리한다.

## 완료 기준
- 타워 3종(basic/area/slow)·적 4종(basic/fast/armored/boss)이 형태·색으로 구분
- 투사체 glow + 짧은 trail
- 피격(스파크) / 사망(폭발 puff + 확장 링) / 골드 획득(상승 스파클) 이펙트
- 에셋 교체 지점이 visuals.ts 팩토리 함수 한 곳으로 격리
- npm run build 타입체크 통과

## 설계
### 1) 비주얼 팩토리 — 신규 web/src/defense/visuals.ts
- createTowerObject(kind): { object: THREE.Group; core: THREE.Object3D }
  - 공통: base(원기둥/육각 프리즘, MeshStandardMaterial, 약한 emissive) + core(회전/펄스용)
  - basic(0x4488ff): 슬림 실린더 base + 회전 octahedron core
  - area(0xff8844): 넓고 낮은 base + torus 링/다중 배럴 + 주황 emissive core
  - slow(0x66ccff): 키 큰 스파이어 + 펄스 icosphere core
  - 색은 TOWER_CONFIGS[kind].color 기준, object.castShadow = true(자식 메쉬에 설정)
- createEnemyObject(kind, config): THREE.Object3D
  - basic: icosahedron, 빨강 emissive / fast: 길쭉한 cone·tetra, 골드 / armored: 각진 chunk, metalness 높은 standard, 회청색 / boss: 큰 형상 + 회전 링, 보라 emissive
  - config.scale 반영, castShadow = true
- 향후 GLB 교체는 이 두 함수 내부만 GLTFLoader 로딩으로 바꾸면 됨(시그니처 유지). glow 텍스처 유틸은 effects.ts와 공유.

### 2) 적 종류 식별 — web/src/defense/enemies.ts
- EnemyConfig에 kind: EnemyKind 추가, ENEMY_CONFIGS 각 항목에 kind 명시. visuals가 kind로 형태 선택(EnemyLogic은 config만 보관하므로 config.kind 사용).

### 3) 투사체 glow/trail — web/src/defense/towers.ts + grid.ts
- towers.ts: ProjectileState에 id: number 추가(모듈 카운터로 발사 시 부여). 색은 kind별.
- grid.ts: _syncProjectileMeshes를 매 tick 파괴/재생성 → 영속 Map<id, {glow, trail, positions[]}>로 변경(적 메쉬 생성/갱신/제거 패턴과 동일).
  - glow: additive sprite(절차적 radial-gradient canvas 텍스처) + 작은 emissive 구
  - trail: 최근 N(약 6) 위치를 Line/Tube로, 끝으로 갈수록 opacity 감소

### 4) 이펙트 매니저 — 신규 web/src/defense/effects.ts
- EffectsManager: transient 파티클 풀 소유, additive 블렌딩 + 절차적 glow 텍스처(외부 에셋 없음)
- API: spawnHit(pos,color) / spawnDeath(pos,color,scale) / spawnGold(pos) / update(dt) / setVisible(v) / dispose()
  - hit: 작은 스파크 몇 개 확장+페이드(약 0.2s)
  - death: RingGeometry 확장+페이드 + puff 스프라이트
  - gold: 노란 스파클 상승+페이드
- grid가 매 frame update(dt) 호출, 페이즈 가시성에 연동(setVisible).

### 5) 이벤트 연결 — towers.ts → grid.ts → effects
- TowerLogic에 impacts: ImpactEvent[](pos, kind, killed) 필드. update에서 명중 시 채우고, grid가 tick마다 읽고 비움.
- 적 사망: grid의 _syncEnemyMeshes에서 alive→dead 전이 감지 시 spawnDeath + (reward>0) spawnGold.

### 6) 애니메이션 — grid _tick
- 타워 core 회전/펄스, 투사체 trail 갱신, effects.update(dt).

## 파일
- 신규: web/src/defense/visuals.ts, web/src/defense/effects.ts
- 수정: web/src/defense/towers.ts(ProjectileState.id·impacts), enemies.ts(kind), grid.ts(팩토리 사용·영속 투사체·이펙트 연결·core 애니·dispose 정리)

## 검증
- cd web; npm run dev → 브라우저
- Build/Defense 진입 후 타워 3종 배치 → 형태/색 구분
- 웨이브 시작 → 적 4종 형태 구분, 투사체 glow+trail, 피격 스파크, 처치 시 폭발+골드 스파클, 골드 증가
- GameOver→재시작 후 메쉬/이펙트 정상 정리(누수 없음)
- npm run build 타입체크 통과

## 메모
- 자동 테스트 추가하지 않음(프로젝트 정책). 검증은 사람이 브라우저로.
- emissive 재질을 적극 사용 → T4.9 블룸이 이 발광을 강조.
