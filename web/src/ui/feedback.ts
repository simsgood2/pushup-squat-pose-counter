import type { ExerciseType } from '../exercise/rewards';

const EXERCISE_LABELS: Record<ExerciseType, string> = {
  pushup: '푸시업',
  squat: '스쿼트',
  jump: '점프',
  lunge: '런지',
  jumpingJack: '팔벌려뛰기',
};

/**
 * Floating "운동 종류 +골드 (콤보)" text that rises near the character,
 * spawned once per counted rep. (x, y) are screen-space pixels.
 */
export function spawnExerciseFloat(
  type: ExerciseType,
  gold: number,
  combo: number,
  x: number,
  y: number
): void {
  const el = document.createElement('div');
  el.className = 'exercise-float';
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  const comboHtml = combo >= 2 ? `<span class="ef-combo">COMBO x${combo}</span>` : '';
  el.innerHTML =
    `<span class="ef-name">${EXERCISE_LABELS[type] ?? type}</span> ` +
    `<span class="ef-gold">+${gold}</span>${comboHtml}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

export function flashLifeLoss(): void {
  const el = document.createElement('div');
  el.style.cssText = `position: fixed; inset: 0; background: var(--warn);
    opacity: 0; pointer-events: none; z-index: 90;
    animation: lifeFlash 0.4s ease-out forwards;`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 400);
}
