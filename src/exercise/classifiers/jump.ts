import { average, type Point3D } from '../angle';
import type { Phase, ExerciseState } from '../repCounter';

export type Landmarks = (Point3D | null)[];

const LEFT_ANKLE = 27;
const RIGHT_ANKLE = 28;

export const JUMP_LIFT_THRESHOLD = 0.1; // 10cm minimum lift to count as airborne
const CALIBRATION_FRAMES = 3;

export function computeJumpAnkleY(landmarks: Landmarks): number | null {
  const la = landmarks[LEFT_ANKLE];
  const ra = landmarks[RIGHT_ANKLE];
  return average([la?.y, ra?.y]);
}

export class JumpClassifier {
  private count = 0;
  private phase: Phase = 'ready';
  private baselineY: number | null = null;
  private calibSamples: number[] = [];

  update(landmarks: Landmarks): ExerciseState {
    const ankleY = computeJumpAnkleY(landmarks);

    if (ankleY === null) {
      return { count: this.count, phase: this.phase, angle: null, active: false };
    }

    if (this.baselineY === null) {
      this.calibSamples.push(ankleY);
      if (this.calibSamples.length >= CALIBRATION_FRAMES) {
        // Max y = most downward position = ground level (MediaPipe y+ is down)
        this.baselineY = Math.max(...this.calibSamples);
      }
      return { count: this.count, phase: this.phase, angle: ankleY, active: false };
    }

    const isAirborne = ankleY < this.baselineY - JUMP_LIFT_THRESHOLD;

    if ((this.phase === 'ready' || this.phase === 'up') && !isAirborne) {
      this.phase = 'down';
    } else if (this.phase === 'down' && isAirborne) {
      this.phase = 'up';
      this.count += 1;
    }

    return { count: this.count, phase: this.phase, angle: ankleY, active: true };
  }

  getState(): ExerciseState {
    return { count: this.count, phase: this.phase, angle: null, active: this.baselineY !== null };
  }

  reset(): void {
    this.count = 0;
    this.phase = 'ready';
    this.baselineY = null;
    this.calibSamples = [];
  }
}
