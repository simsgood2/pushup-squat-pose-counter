import { phaseStore, INITIAL_LIVES, type Phase } from '../game/phaseMachine';
import { TOWER_CONFIGS } from '../defense/towers';
import { goldStore } from '../exercise/rewards';

export class PhaseHud {
  private menuOverlay: HTMLDivElement;
  private hudBar: HTMLDivElement;
  private phaseEl: HTMLSpanElement;
  private roundEl: HTMLSpanElement;
  private timerEl: HTMLSpanElement;
  private timerRow: HTMLDivElement;
  private startBuildBtn: HTMLButtonElement;
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
      'min-width: 140px',
      'font-size: 15px',
    ].join('; ');

    this.phaseEl = this._span('phase-label');
    this.roundEl = this._span('round-label');
    this.timerEl = this._span('timer-label');

    this.timerRow = document.createElement('div');
    this.timerRow.style.marginBottom = '4px';
    const timerLbl = document.createElement('span');
    timerLbl.textContent = '남은 시간: ';
    timerLbl.className = 'hud-label-dim';
    this.timerRow.appendChild(timerLbl);
    this.timerRow.appendChild(this.timerEl);

    this.startBuildBtn = document.createElement('button');
    this.startBuildBtn.setAttribute('data-testid', 'start-build-btn');
    this.startBuildBtn.className = 'hud-btn';
    this.startBuildBtn.textContent = '건설 시작';
    this.startBuildBtn.style.cssText = 'margin-top: 8px; pointer-events: all; display: block;';
    this.startBuildBtn.addEventListener('click', () => phaseStore.getState().startBuild());

    this.startWaveBtn = document.createElement('button');
    this.startWaveBtn.setAttribute('data-testid', 'start-wave-btn');
    this.startWaveBtn.className = 'hud-btn';
    this.startWaveBtn.textContent = '웨이브 시작';
    this.startWaveBtn.style.cssText = 'margin-top: 8px; pointer-events: all; display: block;';
    this.startWaveBtn.addEventListener('click', () => phaseStore.getState().startWave());

    this.nextRoundBtn = document.createElement('button');
    this.nextRoundBtn.setAttribute('data-testid', 'next-round-btn');
    this.nextRoundBtn.className = 'hud-btn';
    this.nextRoundBtn.textContent = '다음 라운드';
    this.nextRoundBtn.style.cssText = 'margin-top: 8px; pointer-events: all; display: block;';
    this.nextRoundBtn.addEventListener('click', () => phaseStore.getState().nextRound());

    this.livesEl = this._span('lives-label');
    this.livesEl.textContent = String(INITIAL_LIVES);

    this.livesRow = document.createElement('div');
    this.livesRow.style.marginBottom = '4px';
    const livesLbl = document.createElement('span');
    livesLbl.textContent = '라이프: ';
    livesLbl.className = 'hud-label-dim';
    this.livesRow.appendChild(livesLbl);
    this.livesRow.appendChild(this.livesEl);

    this.costRow = document.createElement('div');
    this.costRow.style.marginBottom = '4px';
    const costLbl = document.createElement('span');
    costLbl.textContent = '타워 비용: ';
    costLbl.className = 'hud-label-dim';
    const costVal = document.createElement('span');
    costVal.setAttribute('data-testid', 'tower-cost-label');
    costVal.textContent = String(TOWER_CONFIGS.basic.cost);
    this.costRow.appendChild(costLbl);
    this.costRow.appendChild(costVal);

    this.goldEl = this._span('hud-gold-label');
    this.goldEl.textContent = '0';
    this.goldRow = document.createElement('div');
    this.goldRow.style.marginBottom = '4px';
    const goldLbl = document.createElement('span');
    goldLbl.textContent = '골드: ';
    goldLbl.className = 'hud-label-dim';
    this.goldRow.appendChild(goldLbl);
    this.goldRow.appendChild(this.goldEl);

    this.hudBar.appendChild(this._row('페이즈', this.phaseEl));
    this.hudBar.appendChild(this._row('라운드', this.roundEl));
    this.hudBar.appendChild(this.timerRow);
    this.hudBar.appendChild(this.livesRow);
    this.hudBar.appendChild(this.goldRow);
    this.hudBar.appendChild(this.costRow);
    this.hudBar.appendChild(this.startBuildBtn);
    this.hudBar.appendChild(this.startWaveBtn);
    this.hudBar.appendChild(this.nextRoundBtn);
    document.body.appendChild(this.hudBar);

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

  private _span(testid: string): HTMLSpanElement {
    const el = document.createElement('span');
    el.setAttribute('data-testid', testid);
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

  private _render(state: { phase: Phase; round: number; exerciseTimeLeft: number; lives: number }): void {
    this.phaseEl.textContent = state.phase;
    this.roundEl.textContent = String(state.round);
    this.timerEl.textContent = Math.ceil(state.exerciseTimeLeft) + 's';
    this.livesEl.textContent = String(state.lives);

    this.menuOverlay.style.display = state.phase === 'Menu' ? 'flex' : 'none';
    this.gameOverOverlay.style.display = state.phase === 'GameOver' ? 'flex' : 'none';
    this.hudBar.style.display = state.phase === 'Menu' ? 'none' : 'block';

    const buildOrDefense = state.phase === 'Build' || state.phase === 'Defense';
    const showGold = state.phase === 'Exercise' || buildOrDefense || state.phase === 'WaveClear';
    this.timerRow.style.display = state.phase === 'Exercise' ? 'block' : 'none';
    this.livesRow.style.display = buildOrDefense ? 'block' : 'none';
    this.goldRow.style.display = showGold ? 'block' : 'none';
    this.costRow.style.display = buildOrDefense ? 'block' : 'none';
    this.startBuildBtn.style.display = state.phase === 'Exercise' ? 'block' : 'none';
    this.startWaveBtn.style.display = state.phase === 'Build' ? 'block' : 'none';
    this.nextRoundBtn.style.display = state.phase === 'WaveClear' ? 'block' : 'none';
  }

  dispose(): void {
    this.unsubscribe();
    this.unsubscribeGold();
    this.menuOverlay.remove();
    this.hudBar.remove();
    this.gameOverOverlay.remove();
  }
}
