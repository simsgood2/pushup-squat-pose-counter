import { goldStore, type ExerciseType } from '../exercise/rewards';

export class ExerciseHud {
  private container: HTMLDivElement;
  private exerciseEl: HTMLSpanElement;
  private comboEl: HTMLSpanElement;
  private goldEl: HTMLSpanElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.setAttribute('data-testid', 'exercise-hud');
    this.container.className = 'hud-panel';
    this.container.style.cssText = [
      'position: fixed',
      'top: 16px',
      'left: 16px',
      'pointer-events: none',
      'z-index: 100',
      'min-width: 160px',
      'font-size: 15px',
    ].join('; ');

    this.exerciseEl = this._span('exercise');
    this.exerciseEl.textContent = '—';
    this.exerciseEl.style.color = 'var(--accent-cyan)';
    this.comboEl = this._span('combo');
    this.comboEl.textContent = '0';
    this.goldEl = this._span('gold');
    this.goldEl.textContent = '0';

    this.container.appendChild(this._row('Exercise', this.exerciseEl));
    this.container.appendChild(this._row('Combo', this.comboEl));
    this.container.appendChild(this._row('Gold', this.goldEl));

    document.body.appendChild(this.container);

    goldStore.subscribe((state) => {
      this.comboEl.textContent = String(state.combo);
      this.goldEl.textContent = String(state.gold);
    });
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
    lbl.className = 'hud-label-dim';
    row.appendChild(lbl);
    row.appendChild(valueEl);
    return row;
  }

  setExercise(type: ExerciseType | null): void {
    this.exerciseEl.textContent = type ?? '—';
  }

  dispose(): void {
    this.container.remove();
  }
}
