# Autonomous Overnight Run — GOAL

> 이 문서는 LLM이 매 iteration 시작 시 읽는 지시서. 자율 루프가 끝날 때까지 변경하지 마.

## 최종 목표

[docs/game-redesign-plan.md](docs/game-redesign-plan.md)에 정의된 모캡 디펜스 게임.
스택은 TypeScript + Vite + Three.js + MediaPipe Tasks for Web + Kalidokit. 디렉토리는 `web/`.

## 오늘 밤 도달 목표 (우선순위 순)

1. **M1 완료** — 웹페이지를 열면 캐릭터(또는 스틱피규어)가 웹캠 앞 사용자 동작을 따라간다.
2. **M2 완료** — 푸시업·스쿼트·점프·런지·팔벌려뛰기 5종 인식 + 골드 누적 + HUD.
3. **M3 진입** — 디펜스 페이즈 그리드 + 타워 1종 + 적 1종 + 웨이브 1개 플레이 가능.

M4 이후는 손대지 마. M3까지 닿으면 그날 밤은 성공.

## 절대 규칙

- **사용자에게 질문하지 마.** 결정 필요한 게 있으면 fallback 규칙을 적용하거나 [BLOCKED.md](BLOCKED.md)에 기록 후 다음 작업으로 넘어가라.
- **한 iteration에 한 task만 처리.** task 끝나면 commit + push 후 종료. 다음 task는 다음 iteration에서.
- **TASKS.md 체크박스를 commit 직전에 갱신.** 동일 commit에 포함.
- **테스트가 빨갛게 끝난 작업은 commit하지 마.** 대신 BLOCKED.md에 기록하고 다른 task 시도.
- **GOAL.md / scripts/overnight-run.ps1 / .github 디렉토리 수정 금지.**
- **새 의존성을 추가하려면 web/package.json만 수정.** 전역 설치 금지.

## Fallback 규칙

| 상황 | 행동 |
|---|---|
| `assets/characters/manny.fbx` 없음 | 스틱피규어(33 sphere + 연결선)로 진행. M1.5(본 리타게팅) skip 표시. |
| MediaPipe 모델 파일이 없음 | `pose_landmarker_lite.task`를 web/public/models/에 심볼릭 또는 복사. 이미 repo root에 있음. |
| npm 패키지 설치 실패 | 60초 대기 후 1회 재시도. 그래도 실패면 BLOCKED.md에 로그. |
| Playwright가 웹캠 권한 못 받음 | `fake-ui-for-media-stream` 플래그 또는 mock landmark stream으로 우회. test fixture에서 좌표 직접 주입. |
| Vitest 1개가 빨강이지만 코드 추가 진행 가능 | 해당 task만 BLOCKED.md에 기록, 다음 독립 task로 진행. |
| 같은 task에서 3회 연속 실패 | BLOCKED.md에 기록 + skip 표시, 다음 task로. |
| 모든 우선순위 task가 completed/skipped | `DONE.flag` 파일을 repo root에 생성하고 종료. |

## 작업 절차 (매 iteration)

1. `TASKS.md`에서 첫 번째 unchecked + non-skipped task를 골라라.
2. 해당 task의 수락 기준을 읽고 구현해라.
3. `cd web && npm install`이 필요한 첫 task면 실행.
4. 관련 테스트 실행:
   - `cd web && npm run test` (Vitest)
   - 필요시 `cd web && npm run test:e2e` (Playwright)
5. 모두 그린이면:
   - `TASKS.md`의 해당 task 체크박스 갱신
   - `git add -A && git commit -m "<task id>: <짧은 설명>"` (Co-Authored-By 트레일러 절대 추가하지 마)
   - `git push`
6. 실패면 fallback 규칙 적용.
7. 종료 (exit 0). 다음 iteration이 알아서 또 들어옴.

## 자기 검증 체크리스트

commit 전 매번 확인:
- [ ] `cd web && npx tsc --noEmit` 통과
- [ ] 관련 Vitest 통과
- [ ] 새 파일 추가시 import 경로 깨지지 않았는지
- [ ] TASKS.md 갱신됨
- [ ] (해당시) BLOCKED.md 업데이트됨
