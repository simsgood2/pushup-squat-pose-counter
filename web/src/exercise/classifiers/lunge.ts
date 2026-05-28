import { angleDegrees, type Point3D } from '../angle';
import { RepetitionCounter, type ExerciseState } from '../repCounter';

export type Landmarks = (Point3D | null)[];

export const LUNGE_DOWN_ANGLE = 110;
export const LUNGE_UP_ANGLE = 160;
export const LUNGE_KNEE_Z_MIN = 0.15; // 15cm front-back knee separation

const LEFT_HIP = 23;
const RIGHT_HIP = 24;
const LEFT_KNEE = 25;
const RIGHT_KNEE = 26;
const LEFT_ANKLE = 27;
const RIGHT_ANKLE = 28;

export function computeLungeAngle(landmarks: Landmarks): number | null {
  const angles: number[] = [];

  const lh = landmarks[LEFT_HIP];
  const lk = landmarks[LEFT_KNEE];
  const la = landmarks[LEFT_ANKLE];
  if (lh && lk && la) angles.push(angleDegrees(lh, lk, la));

  const rh = landmarks[RIGHT_HIP];
  const rk = landmarks[RIGHT_KNEE];
  const ra = landmarks[RIGHT_ANKLE];
  if (rh && rk && ra) angles.push(angleDegrees(rh, rk, ra));

  if (angles.length === 0) return null;
  // Use the smaller (more bent) angle — that's the front (lunging) leg
  return Math.min(...angles);
}

export function isLungeActive(landmarks: Landmarks, angle: number | null): boolean {
  if (angle === null) return false;
  const lk = landmarks[LEFT_KNEE];
  const rk = landmarks[RIGHT_KNEE];
  if (!lk || !rk) return false;
  // Significant depth separation between front and back knee
  return Math.abs(lk.z - rk.z) >= LUNGE_KNEE_Z_MIN;
}

export class LungeClassifier {
  private counter: RepetitionCounter;

  constructor() {
    this.counter = new RepetitionCounter(LUNGE_DOWN_ANGLE, LUNGE_UP_ANGLE);
  }

  update(landmarks: Landmarks): ExerciseState {
    const angle = computeLungeAngle(landmarks);
    const active = isLungeActive(landmarks, angle);
    return this.counter.update(angle, active);
  }

  getState(): ExerciseState {
    return this.counter.getState();
  }

  reset(): void {
    this.counter.reset();
  }
}
