# T4.9 — 환경 / 조명 / 후처리

## Context
씬은 단색 배경(0x222222) + hemi/ambient/직사광 2개 + 기본 그림자, 톤매핑은 ACESFilmic만(`web/src/scene.ts`). 네온 디펜스 톤을 살리려면 환경맵·정돈된 그림자·블룸이 필요. 외부 HDR 에셋 없이 빌트인/절차적으로 처리한다. T4.8 이후 진행 권장 — 블룸이 강조할 emissive 콘텐츠가 이미 있어야 함.

## 완료 기준
- 절차적 그라디언트 스카이 + 빌트인 환경맵(IBL) 반사
- 정돈된 직사광 + 보드에 타이트한 그림자
- EffectComposer + UnrealBloomPass로 네온 발광
- 데스크톱 프레임 양호(블룸 해상도/threshold 보수적), npm run build 통과

## 설계
### 1) 환경 / 스카이 — web/src/scene.ts (선택: scene/sky.ts 분리)
- 배경: 절차적 그라디언트 — 큰 역구(inverted sphere) + 셰이더/버텍스 그라디언트(deep navy 0x07090d → 시안 호라이즌 → 검정), 또는 Scene.background 그라디언트 텍스처
- 환경맵(IBL): three 빌트인 RoomEnvironment → PMREMGenerator → scene.environment (외부 파일 불필요, StandardMaterial 반사 향상)
- THREE.FogExp2(deep navy, 옅게)로 깊이감

### 2) 조명 정리
- 키 직사광 1개: 그림자 카메라 frustum을 보드(약 ±3 유닛)에 타이트하게, shadow map 2048, bias로 acne 제거
- hemisphere 1개(시안/네이비 틴트) 보조광, 중복 ambient/fill 정리
- 타워/적 castShadow, ground receiveShadow 확인(T4.8 visuals에서 설정됨)

### 3) 후처리 — web/src/scene.ts (선택: scene/postfx.ts 분리)
- EffectComposer + RenderPass + UnrealBloomPass(strength 약 0.6, radius 약 0.4, threshold 약 0.8 — emissive만 블룸) + OutputPass(three r175)
- animate 루프를 renderer.render → composer.render로 전환, resize 시 composer.setSize
- 톤매핑 ACESFilmic 유지, exposure 재튜닝
- 성능: bloom 내부 해상도 보수적, 필요 시 품질 상수/토글

## 파일
- 수정: web/src/scene.ts(환경맵·스카이·fog·조명·composer·bloom·resize). 선택 분리: scene/sky.ts, scene/postfx.ts
- main.ts: animate가 scene.ts 내부라 변경 최소. composer 노출 필요 시 SceneContext 확장

## 검증
- cd web; npm run dev → 메뉴/운동/디펜스 각 페이즈에서 배경 그라디언트·환경 반사·그림자 확인
- 웨이브 중 네온 타워/적/투사체/이펙트가 블룸으로 빛나는지
- 리사이즈 시 깨짐 없음, 데스크톱 프레임 양호
- npm run build 타입체크 통과

## 메모
- 외부 HDR 에셋 미사용(빌트인 RoomEnvironment). 추후 실제 HDR로 교체 가능.
- 자동 테스트 추가하지 않음(프로젝트 정책).
