import { angleDegrees, average, type Point3D } from '../angle';
import { RepetitionCounter, type ExerciseState } from '../repCounter';

export const SQUAT_DOWN_ANGLE = 105;
export const SQUAT_UP_ANGLE = 160;

const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;
const LEFT_KNEE = 25;
const RIGHT_KNEE = 26;
const LEFT_ANKLE = 27;
const RIGHT_ANKLE = 28;

export type Landmarks = (Point3D | null)[];

function isUpright(upper: Point3D, lower: Point3D): boolean {
  const dx = Math.abs(upper.x - lower.x);
  const dy = Math.abs(upper.y - lower.y);
  return dy > dx * 1.15;
}

export function computeSquatAngle(landmarks: Landmarks): number | null {
  const angles: number[] = [];

  const lh = landmarks[LEFT_HIP];
  const lk = landmarks[LEFT_KNEE];
  const la = landmarks[LEFT_ANKLE];
  if (lh && lk && la) angles.push(angleDegrees(lh, lk, la));

  const rh = landmarks[RIGHT_HIP];
  const rk = landmarks[RIGHT_KNEE];
  const ra = landmarks[RIGHT_ANKLE];
  if (rh && rk && ra) angles.push(angleDegrees(rh, rk, ra));

  return average(angles);
}

export function isSquatActive(landmarks: Landmarks, angle: number | null): boolean {
  if (angle === null) return false;

  const ls = landmarks[LEFT_SHOULDER];
  const rs = landmarks[RIGHT_SHOULDER];
  const lh = landmarks[LEFT_HIP];
  const rh = landmarks[RIGHT_HIP];

  if (!ls || !rs || !lh || !rh) return false;

  const leftUpright = isUpright(ls, lh);
  const rightUpright = isUpright(rs, rh);
  return leftUpright || rightUpright;
}

export class SquatClassifier {
  private counter: RepetitionCounter;

  constructor() {
    this.counter = new RepetitionCounter(SQUAT_DOWN_ANGLE, SQUAT_UP_ANGLE);
  }

  update(landmarks: Landmarks): ExerciseState {
    const angle = computeSquatAngle(landmarks);
    const active = isSquatActive(landmarks, angle);
    return this.counter.update(angle, active);
  }

  getState(): ExerciseState {
    return this.counter.getState();
  }

  reset(): void {
    this.counter.reset();
  }
}
