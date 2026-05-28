import { phaseStore, type Phase } from '../game/phaseMachine';

export class PhaseHud {
  private menuOverlay: HTMLDivElement;
  private hudBar: HTMLDivElement;
  private phaseEl: HTMLSpanElement;
  private roundEl: HTMLSpanElement;
  private timerEl: HTMLSpanElement;
  private timerRow: HTMLDivElement;
  private startDefenseBtn: HTMLButtonElement;
  private nextRoundBtn: HTMLButtonElement;
  private gameOverOverlay: HTMLDivElement;
  private unsubscribe: () => void;

  constructor() {
    this.menuOverlay = this._buildMenuOverlay();
    document.body.appendChild(this.menuOverlay);

    this.hudBar = document.createElement('div');
    this.hudBar.setAttribute('data-testid', 'phase-hud');
    this.hudBar.style.cssText = [
      'position: fixed',
      'top: 16px',
      'right: 16px',
      'background: rgba(0,0,0,0.65)',
      'color: #fff',
      'font-family: monospace',
      'font-size: 15px',
      'padding: 10px 16px',
      'border-radius: 8px',
      'pointer-events: none',
      'z-index: 100',
      'min-width: 140px',
    ].join('; ');

    this.phaseEl = this._span('phase-label');
    this.roundEl = this._span('round-label');
    this.timerEl = this._span('timer-label');

    this.timerRow = document.createElement('div');
    this.timerRow.style.marginBottom = '4px';
    const timerLbl = document.createElement('span');
    timerLbl.textContent = '남은 시간: ';
    timerLbl.style.opacity = '0.7';
    this.timerRow.appendChild(timerLbl);
    this.timerRow.appendChild(this.timerEl);

    this.startDefenseBtn = document.createElement('button');
    this.startDefenseBtn.setAttribute('data-testid', 'start-defense-btn');
    this.startDefenseBtn.textContent = '디펜스 시작';
    this.startDefenseBtn.style.cssText = 'margin-top: 8px; padding: 4px 10px; cursor: pointer; pointer-events: all; display: block;';
    this.startDefenseBtn.addEventListener('click', () => phaseStore.getState().startDefense());

    this.nextRoundBtn = document.createElement('button');
    this.nextRoundBtn.setAttribute('data-testid', 'next-round-btn');
    this.nextRoundBtn.textContent = '다음 라운드';
    this.nextRoundBtn.style.cssText = 'margin-top: 8px; padding: 4px 10px; cursor: pointer; pointer-events: all; display: block;';
    this.nextRoundBtn.addEventListener('click', () => phaseStore.getState().nextRound());

    this.hudBar.appendChild(this._row('페이즈', this.phaseEl));
    this.hudBar.appendChild(this._row('라운드', this.roundEl));
    this.hudBar.appendChild(this.timerRow);
    this.hudBar.appendChild(this.startDefenseBtn);
    this.hudBar.appendChild(this.nextRoundBtn);
    document.body.appendChild(this.hudBar);

    this.gameOverOverlay = this._buildGameOverOverlay();
    document.body.appendChild(this.gameOverOverlay);

    this.unsubscribe = phaseStore.subscribe((state) => this._render(state));
    this._render(phaseStore.getState());
  }

  private _buildMenuOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.setAttribute('data-testid', 'menu-overlay');
    overlay.style.cssText = [
      'position: fixed',
      'inset: 0',
      'display: flex',
      'flex-direction: column',
      'align-items: center',
      'justify-content: center',
      'background: rgba(0,0,0,0.75)',
      'color: #fff',
      'font-family: monospace',
      'z-index: 200',
    ].join('; ');

    const title = document.createElement('h1');
    title.textContent = '모캡 디펜스';
    title.style.marginBottom = '24px';
    overlay.appendChild(title);

    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'start-button');
    btn.textContent = '게임 시작';
    btn.style.cssText = 'padding: 12px 32px; font-size: 18px; cursor: pointer;';
    btn.addEventListener('click', () => phaseStore.getState().start());
    overlay.appendChild(btn);

    return overlay;
  }

  private _buildGameOverOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.setAttribute('data-testid', 'game-over-overlay');
    overlay.style.cssText = [
      'position: fixed',
      'inset: 0',
      'display: none',
      'flex-direction: column',
      'align-items: center',
      'justify-content: center',
      'background: rgba(0,0,0,0.75)',
      'color: #fff',
      'font-family: monospace',
      'z-index: 200',
    ].join('; ');

    const title = document.createElement('h1');
    title.textContent = '게임 오버';
    overlay.appendChild(title);

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

  private _render(state: { phase: Phase; round: number; exerciseTimeLeft: number }): void {
    this.phaseEl.textContent = state.phase;
    this.roundEl.textContent = String(state.round);
    this.timerEl.textContent = Math.ceil(state.exerciseTimeLeft) + 's';

    this.menuOverlay.style.display = state.phase === 'Menu' ? 'flex' : 'none';
    this.gameOverOverlay.style.display = state.phase === 'GameOver' ? 'flex' : 'none';
    this.hudBar.style.display = state.phase === 'Menu' ? 'none' : 'block';

    this.timerRow.style.display = state.phase === 'Exercise' ? 'block' : 'none';
    this.startDefenseBtn.style.display = state.phase === 'Exercise' ? 'block' : 'none';
    this.nextRoundBtn.style.display = state.phase === 'WaveClear' ? 'block' : 'none';
  }

  dispose(): void {
    this.unsubscribe();
    this.menuOverlay.remove();
    this.hudBar.remove();
    this.gameOverOverlay.remove();
  }
}
