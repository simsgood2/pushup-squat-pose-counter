import { goldStore, type ExerciseType } from '../exercise/rewards';

export class ExerciseHud {
  private container: HTMLDivElement;
  private exerciseEl: HTMLSpanElement;
  private comboEl: HTMLSpanElement;
  private goldEl: HTMLSpanElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.setAttribute('data-testid', 'exercise-hud');
    this.container.style.cssText = [
      'position: fixed',
      'top: 16px',
      'left: 16px',
      'background: rgba(0,0,0,0.65)',
      'color: #fff',
      'font-family: monospace',
      'font-size: 15px',
      'padding: 10px 16px',
      'border-radius: 8px',
      'pointer-events: none',
      'z-index: 100',
      'min-width: 160px',
    ].join('; ');

    this.exerciseEl = this._span('exercise');
    this.exerciseEl.textContent = '—';
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
    lbl.style.opacity = '0.7';
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
