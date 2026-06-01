import { angleDegrees, average, type Point3D } from '../angle';
import { RepetitionCounter, type ExerciseState } from '../repCounter';

export const PUSHUP_DOWN_ANGLE = 105;
export const PUSHUP_UP_ANGLE = 155;

const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_ELBOW = 13;
const RIGHT_ELBOW = 14;
const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;

export type Landmarks = (Point3D | null)[];

function isSideways(upper: Point3D, lower: Point3D): boolean {
  const dx = Math.abs(upper.x - lower.x);
  const dy = Math.abs(upper.y - lower.y);
  return dx > dy * 1.15;
}

export function computePushupAngle(landmarks: Landmarks): number | null {
  const angles: number[] = [];
  const ls = landmarks[LEFT_SHOULDER];
  const le = landmarks[LEFT_ELBOW];
  const lw = landmarks[LEFT_WRIST];
  if (ls && le && lw) angles.push(angleDegrees(ls, le, lw));

  const rs = landmarks[RIGHT_SHOULDER];
  const re = landmarks[RIGHT_ELBOW];
  const rw = landmarks[RIGHT_WRIST];
  if (rs && re && rw) angles.push(angleDegrees(rs, re, rw));

  return average(angles);
}

export function isPushupActive(landmarks: Landmarks, angle: number | null): boolean {
  if (angle === null) return false;

  const ls = landmarks[LEFT_SHOULDER];
  const rs = landmarks[RIGHT_SHOULDER];
  const lh = landmarks[LEFT_HIP];
  const rh = landmarks[RIGHT_HIP];
  const lw = landmarks[LEFT_WRIST];
  const rw = landmarks[RIGHT_WRIST];

  if (!ls || !rs || !lh || !rh || !lw || !rw) return false;

  const leftHorizontal = isSideways(ls, lh);
  const rightHorizontal = isSideways(rs, rh);
  if (!leftHorizontal && !rightHorizontal) return false;

  const shoulderY = average([ls.y, rs.y]);
  const wristY = average([lw.y, rw.y]);
  if (shoulderY === null || wristY === null) return false;

  return wristY >= shoulderY - 0.08;
}

export class PushupClassifier {
  private counter: RepetitionCounter;

  constructor() {
    this.counter = new RepetitionCounter(PUSHUP_DOWN_ANGLE, PUSHUP_UP_ANGLE);
  }

  update(landmarks: Landmarks): ExerciseState {
    const angle = computePushupAngle(landmarks);
    const active = isPushupActive(landmarks, angle);
    return this.counter.update(angle, active);
  }

  getState(): ExerciseState {
    return this.counter.getState();
  }

  reset(): void {
    this.counter.reset();
  }
}
