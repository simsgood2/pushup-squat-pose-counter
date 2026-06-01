import { type Point3D } from '../angle';
import type { Phase, ExerciseState } from '../repCounter';

export type Landmarks = (Point3D | null)[];

const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;
const LEFT_ANKLE = 27;
const RIGHT_ANKLE = 28;

// MediaPipe worldLandmarks: y positive = downward. Wrist above shoulder → wrist.y < shoulder.y
const ARMS_RAISED_MARGIN = 0.05; // wrist must be ≥ 5cm above shoulder
const FEET_APART_MIN = 0.25;     // ≥ 25cm x-spread = open
const FEET_TOGETHER_MAX = 0.15;  // ≤ 15cm x-spread = closed

export function isArmsRaised(landmarks: Landmarks): boolean {
  const ls = landmarks[LEFT_SHOULDER];
  const lw = landmarks[LEFT_WRIST];
  const rs = landmarks[RIGHT_SHOULDER];
  const rw = landmarks[RIGHT_WRIST];

  let available = 0;
  let raised = 0;
  if (ls && lw) { available++; if (lw.y < ls.y - ARMS_RAISED_MARGIN) raised++; }
  if (rs && rw) { available++; if (rw.y < rs.y - ARMS_RAISED_MARGIN) raised++; }
  return available > 0 && raised === available;
}

export function isFeetApart(landmarks: Landmarks): boolean {
  const la = landmarks[LEFT_ANKLE];
  const ra = landmarks[RIGHT_ANKLE];
  if (!la || !ra) return false;
  return Math.abs(la.x - ra.x) >= FEET_APART_MIN;
}

export function isFeetTogether(landmarks: Landmarks): boolean {
  const la = landmarks[LEFT_ANKLE];
  const ra = landmarks[RIGHT_ANKLE];
  if (!la || !ra) return false;
  return Math.abs(la.x - ra.x) <= FEET_TOGETHER_MAX;
}

export class JumpingJackClassifier {
  private count = 0;
  private phase: Phase = 'ready';

  update(landmarks: Landmarks): ExerciseState {
    const open = isArmsRaised(landmarks) && isFeetApart(landmarks);
    const closed = !isArmsRaised(landmarks) && isFeetTogether(landmarks);

    if ((this.phase === 'ready' || this.phase === 'up') && closed) {
      this.phase = 'down';
    } else if (this.phase === 'down' && open) {
      this.phase = 'up';
      this.count += 1;
    }

    return { count: this.count, phase: this.phase, angle: null, active: closed || open };
  }

  getState(): ExerciseState {
    return { count: this.count, phase: this.phase, angle: null, active: false };
  }

  reset(): void {
    this.count = 0;
    this.phase = 'ready';
  }
}
