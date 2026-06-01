export type Phase = 'ready' | 'down' | 'up';

export interface ExerciseState {
  count: number;
  phase: Phase;
  angle: number | null;
  active: boolean;
}

export class RepetitionCounter {
  private downAngle: number;
  private upAngle: number;
  private state: ExerciseState;

  constructor(downAngle: number, upAngle: number) {
    this.downAngle = downAngle;
    this.upAngle = upAngle;
    this.state = { count: 0, phase: 'ready', angle: null, active: false };
  }

  update(angle: number | null, active: boolean): ExerciseState {
    this.state.angle = angle;
    this.state.active = active;

    if (angle === null) return this.state;

    if (!active) {
      this.state.phase = 'ready';
      return this.state;
    }

    if ((this.state.phase === 'ready' || this.state.phase === 'up') && angle <= this.downAngle) {
      this.state.phase = 'down';
    } else if (this.state.phase === 'down' && angle >= this.upAngle) {
      this.state.phase = 'up';
      this.state.count += 1;
    }

    return this.state;
  }

  getState(): ExerciseState {
    return { ...this.state };
  }

  reset(): void {
    this.state = { count: 0, phase: 'ready', angle: null, active: false };
  }
}
