import { phaseStore, INITIAL_LIVES, type Phase } from '../game/phaseMachine';
import { TOWER_CONFIGS } from '../defense/towers';
import { goldStore } from '../exercise/rewards';

export class PhaseHud {
  private menuOverlay: HTMLDivElement;
  private hudBar: HTMLDivElement;
  private statsStack: HTMLDivElement;
  private phaseEl: HTMLSpanElement;
  private roundEl: HTMLSpanElement;
  private centerTimerEl: HTMLDivElement;
  private centerTimerTextEl: HTMLSpanElement;
  private startBuildBtn: HTMLButtonElement;
  private returnExerciseBtn: HTMLButtonElement;
  private resetTimerBtn: HTMLButtonElement;
  private startWaveBtn: HTMLButtonElement;
  private nextRoundBtn: HTMLButtonElement;
  private gameOverOverlay: HTMLDivElement;
  private livesEl: HTMLSpanElement;
  private livesRow: HTMLDivElement;
  private costRow: HTMLDivElement;
  private goldEl: HTMLSpanElement;
  private goldRow: HTMLDivElement;
  private unsubscribe: () => void;
  private unsubscribeGold: () => void;

  constructor() {
    this.menuOverlay = this._buildMenuOverlay();
    document.body.appendChild(this.menuOverlay);

    this.hudBar = document.createElement('div');
    this.hudBar.setAttribute('data-testid', 'phase-hud');
    this.hudBar.className = 'hud-panel';
    this.hudBar.style.cssText = [
      'position: fixed',
      'top: 16px',
      'right: 16px',
      'pointer-events: none',
      'z-index: 100',
      'min-width: 180px',
      'font-size: 30px',
    ].join('; ');

    this.phaseEl = this._span('phase-label');
    this.roundEl = this._span('round-label');

    this.centerTimerEl = document.createElement('div');
    this.centerTimerEl.setAttribute('data-testid', 'center-timer-label');
    this.centerTimerEl.className = 'hud-panel';
    this.centerTimerEl.style.cssText = [
      'position: fixed',
      'top: 16px',
      'left: 50%',
      'transform: translateX(-50%)',
      'z-index: 110',
      'font-size: 36px',
      'line-height: 1.5',
      'display: none',
      'align-items: center',
      'gap: 16px',
    ].join('; ');
    this.centerTimerTextEl = document.createElement('span');
    this.centerTimerEl.appendChild(this.centerTimerTextEl);

    this.startBuildBtn = this._button('start-build-btn', '건설 시작', () => phaseStore.getState().startBuild());
    this.returnExerciseBtn = this._button('return-exercise-btn', '운동 다시 하기', () => phaseStore.getState().returnToExercise());
    this.resetTimerBtn = this._button('reset-timer-btn', '시간 초기화', () => phaseStore.getState().resetTimer());
    this.resetTimerBtn.style.marginTop = '0';
    this.resetTimerBtn.style.fontSize = '24px';
    this.resetTimerBtn.style.whiteSpace = 'nowrap';
    this.centerTimerEl.appendChild(this.resetTimerBtn);

    this.startWaveBtn = this._button('start-wave-btn', '웨이브 시작', () => phaseStore.getState().startWave());
    this.nextRoundBtn = this._button('next-round-btn', '다음 라운드', () => phaseStore.getState().nextRound());

    this.livesEl = this._span('lives-label');
    this.livesEl.textContent = String(INITIAL_LIVES);
    this.livesRow = this._statBox('라이프', this.livesEl);

    this.goldEl = this._span('hud-gold-label');
    this.goldEl.textContent = '0';
    this.goldRow = this._statBox('골드', this.goldEl);

    this.statsStack = document.createElement('div');
    this.statsStack.style.cssText = [
      'position: fixed',
      'top: 16px',
      'right: 318px',
      'display: flex',
      'flex-direction: column',
      'gap: 12px',
      'z-index: 100',
      'font-size: 30px',
      'pointer-events: none',
    ].join('; ');
    this.statsStack.appendChild(this.livesRow);
    this.statsStack.appendChild(this.goldRow);

    this.costRow = this._statBox('타워 비용', this._plainSpan(String(TOWER_CONFIGS.basic.cost), 'tower-cost-label'));

    this.hudBar.appendChild(this._row('페이즈', this.phaseEl));
    this.hudBar.appendChild(this._row('라운드', this.roundEl));
    this.hudBar.appendChild(this.costRow);
    this.hudBar.appendChild(this.startBuildBtn);
    this.hudBar.appendChild(this.returnExerciseBtn);
    this.hudBar.appendChild(this.startWaveBtn);
    this.hudBar.appendChild(this.nextRoundBtn);
    document.body.appendChild(this.hudBar);
    document.body.appendChild(this.statsStack);
    document.body.appendChild(this.centerTimerEl);

    this.gameOverOverlay = this._buildGameOverOverlay();
    document.body.appendChild(this.gameOverOverlay);

    this.unsubscribe = phaseStore.subscribe((state) => this._render(state));
    this.unsubscribeGold = goldStore.subscribe((state) => {
      this.goldEl.textContent = String(Math.floor(state.gold));
    });
    this.goldEl.textContent = String(Math.floor(goldStore.getState().gold));
    this._render(phaseStore.getState());
  }

  private _buildMenuOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.setAttribute('data-testid', 'menu-overlay');
    overlay.className = 'hud-overlay';

    const title = document.createElement('h1');
    title.textContent = '모캡 디펜스';
    overlay.appendChild(title);

    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'start-button');
    btn.className = 'hud-btn';
    btn.textContent = '게임 시작';
    btn.style.cssText = 'padding: 12px 32px; font-size: 16px;';
    btn.addEventListener('click', () => phaseStore.getState().start());
    overlay.appendChild(btn);

    return overlay;
  }

  private _buildGameOverOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.setAttribute('data-testid', 'game-over-overlay');
    overlay.className = 'hud-overlay';
    overlay.style.display = 'none';

    const title = document.createElement('h1');
    title.textContent = '게임 오버';
    overlay.appendChild(title);

    const restartBtn = document.createElement('button');
    restartBtn.setAttribute('data-testid', 'restart-btn');
    restartBtn.className = 'hud-btn';
    restartBtn.textContent = '다시 시작';
    restartBtn.style.cssText = 'margin-top: 20px; padding: 12px 32px; font-size: 16px;';
    restartBtn.addEventListener('click', () => phaseStore.getState().restart());
    overlay.appendChild(restartBtn);

    return overlay;
  }

  private _button(testid: string, text: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', testid);
    btn.className = 'hud-btn';
    btn.textContent = text;
    btn.style.cssText = 'margin-top: 8px; pointer-events: all; display: block;';
    btn.addEventListener('click', onClick);
    return btn;
  }

  private _span(testid: string): HTMLSpanElement {
    const el = document.createElement('span');
    el.setAttribute('data-testid', testid);
    return el;
  }

  private _plainSpan(text: string, testid: string): HTMLSpanElement {
    const el = this._span(testid);
    el.textContent = text;
    return el;
  }

  private _row(label: string, valueEl: HTMLSpanElement): HTMLDivElement {
    const row = document.createElement('div');
    row.style.marginBottom = '4px';
    const lbl = document.createElement('span');
    lbl.textContent = label + ': ';
    lbl.style.opacity = '0.7';
    row.appendChild(lbl);
    row.appendChild(valueEl);
    return row;
  }

  private _statBox(label: string, valueEl: HTMLSpanElement): HTMLDivElement {
    const box = document.createElement('div');
    box.className = 'hud-panel';
    box.style.marginBottom = '0';
    const lbl = document.createElement('span');
    lbl.textContent = label + ': ';
    lbl.className = 'hud-label-dim';
    box.appendChild(lbl);
    box.appendChild(valueEl);
    return box;
  }

  private _render(state: { phase: Phase; round: number; exerciseTimeLeft: number; lives: number }): void {
    this.phaseEl.textContent = state.phase;
    this.roundEl.textContent = String(state.round);
    this.centerTimerTextEl.textContent = `남은 시간: ${Math.ceil(state.exerciseTimeLeft)}s`;
    this.livesEl.textContent = String(state.lives);

    const buildOrDefense = state.phase === 'Build' || state.phase === 'Defense';
    const showGold = state.phase === 'Exercise' || buildOrDefense || state.phase === 'WaveClear';
    const showTimer = state.phase === 'Exercise' || state.phase === 'Build';

    this.menuOverlay.style.display = state.phase === 'Menu' ? 'flex' : 'none';
    this.gameOverOverlay.style.display = state.phase === 'GameOver' ? 'flex' : 'none';
    this.hudBar.style.display = state.phase === 'Menu' ? 'none' : 'block';
    this.statsStack.style.display = state.phase === 'Menu' ? 'none' : 'flex';

    this.centerTimerEl.style.display = showTimer ? 'flex' : 'none';
    this.livesRow.style.display = buildOrDefense ? 'block' : 'none';
    this.goldRow.style.display = showGold ? 'block' : 'none';
    this.costRow.style.display = buildOrDefense ? 'block' : 'none';
    this.startBuildBtn.style.display = state.phase === 'Exercise' ? 'block' : 'none';
    this.returnExerciseBtn.style.display = state.phase === 'Build' ? 'block' : 'none';
    this.startWaveBtn.style.display = state.phase === 'Build' ? 'block' : 'none';
    this.nextRoundBtn.style.display = 'none';
  }

  dispose(): void {
    this.unsubscribe();
    this.unsubscribeGold();
    this.menuOverlay.remove();
    this.hudBar.remove();
    this.statsStack.remove();
    this.centerTimerEl.remove();
    this.gameOverOverlay.remove();
  }
}
