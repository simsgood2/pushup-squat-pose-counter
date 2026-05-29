export function spawnFloatingGold(amount: number, x: number, y: number): void {
  const el = document.createElement('div');
  el.textContent = `+${amount}`;
  el.style.cssText = `position: fixed; left: ${x}px; top: ${y}px; color: var(--accent-cyan);
    font-family: inherit; font-size: 18px; font-weight: bold; pointer-events: none;
    text-shadow: 0 0 8px rgba(0, 255, 209, 0.6); z-index: 150;
    animation: floatUp 0.9s ease-out forwards;`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

export function flashLifeLoss(): void {
  const el = document.createElement('div');
  el.style.cssText = `position: fixed; inset: 0; background: var(--warn);
    opacity: 0; pointer-events: none; z-index: 90;
    animation: lifeFlash 0.4s ease-out forwards;`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 400);
}
