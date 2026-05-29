import { TOWER_CONFIGS, type TowerKind } from '../defense/towers';
import { towerSelectionStore } from '../defense/towerSelection';
import { goldStore } from '../exercise/rewards';
import { phaseStore } from '../game/phaseMachine';
import type { DefenseGrid } from '../defense/grid';

export class TowerPanel {
  private panel: HTMLDivElement;
  private cards = new Map<TowerKind, HTMLDivElement>();
  private unsubscribeGold: () => void;
  private unsubscribeSelection: () => void;
  private unsubscribePhase: () => void;
  private grid: DefenseGrid;

  constructor(grid: DefenseGrid) {
    this.grid = grid;
    this.panel = this._buildPanel();
    document.body.appendChild(this.panel);

    this.unsubscribeGold = goldStore.subscribe(() => this._updateCardStates());
    this.unsubscribeSelection = towerSelectionStore.subscribe(() => this._updateCardStates());
    this.unsubscribePhase = phaseStore.subscribe((state) => {
      const show = state.phase === 'Build' || state.phase === 'Defense';
      this.panel.style.display = show ? 'flex' : 'none';
    });

    const phase = phaseStore.getState().phase;
    this.panel.style.display = (phase === 'Build' || phase === 'Defense') ? 'flex' : 'none';
    this._updateCardStates();
  }

  private _buildPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'hud-panel';
    panel.style.cssText = [
      'position: fixed',
      'right: 12px',
      'top: 50%',
      'transform: translateY(-50%)',
      'display: flex',
      'flex-direction: column',
      'gap: 8px',
      'z-index: 100',
      'pointer-events: none',
    ].join('; ');

    const kinds: TowerKind[] = ['basic', 'area', 'slow'];
    for (const kind of kinds) {
      const card = this._buildCard(kind);
      this.cards.set(kind, card);
      panel.appendChild(card);
    }

    return panel;
  }

  private _buildCard(kind: TowerKind): HTMLDivElement {
    const cfg = TOWER_CONFIGS[kind];
    const card = document.createElement('div');
    card.style.cssText = [
      'background: rgba(0,0,0,0.78)',
      'color: #fff',
      'font-family: monospace',
      'font-size: 13px',
      'padding: 10px 14px',
      'border-radius: 8px',
      'border: 2px solid transparent',
      'cursor: pointer',
      'pointer-events: all',
      'min-width: 130px',
      'user-select: none',
      'transition: box-shadow 0.15s, border-color 0.15s;',
    ].join('; ');

    const names: Record<TowerKind, string> = { basic: '기본', area: '광역', slow: '슬로우' };
    const descs: Record<TowerKind, string> = {
      basic: `비용 ${cfg.cost} · 사거리 ${cfg.range}`,
      area:  `비용 ${cfg.cost} · 반경 ${cfg.splashRadius}`,
      slow:  `비용 ${cfg.cost} · 감속 ${Math.round((1 - (cfg.slowMultiplier ?? 1)) * 100)}% / ${cfg.slowDuration}s`,
    };

    const title = document.createElement('div');
    title.textContent = names[kind];
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '4px';

    const info = document.createElement('div');
    info.style.opacity = '0.75';
    info.textContent = descs[kind];

    card.appendChild(title);
    card.appendChild(info);

    card.addEventListener('click', () => {
      if (goldStore.getState().gold < cfg.cost) return;
      towerSelectionStore.getState().setSelectedKind(kind);
    });

    card.addEventListener('mouseenter', () => {
      this.grid.showRangePreview(0, 0, kind);
      card.style.boxShadow = 'var(--shadow-glow)';
    });

    card.addEventListener('mouseleave', () => {
      this.grid.hideRangePreview();
      card.style.boxShadow = '';
    });

    return card;
  }

  private _updateCardStates(): void {
    const gold = goldStore.getState().gold;
    const selected = towerSelectionStore.getState().selectedKind;

    for (const [kind, card] of this.cards) {
      const canAfford = gold >= TOWER_CONFIGS[kind].cost;
      card.style.opacity = canAfford ? '1' : '0.5';
      card.style.cursor = canAfford ? 'pointer' : 'not-allowed';
      if (kind === selected) {
        card.style.borderColor = 'var(--accent-cyan)';
        card.style.boxShadow = 'var(--shadow-glow)';
      } else {
        card.style.borderColor = 'transparent';
        card.style.boxShadow = '';
      }
    }
  }

  dispose(): void {
    this.unsubscribeGold();
    this.unsubscribeSelection();
    this.unsubscribePhase();
    this.panel.remove();
  }
}
