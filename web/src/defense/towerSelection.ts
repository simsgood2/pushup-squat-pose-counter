import { createStore } from 'zustand/vanilla';
import type { TowerKind } from './towers';

interface TowerSelectionState {
  selectedKind: TowerKind;
  setSelectedKind: (k: TowerKind) => void;
}

export const towerSelectionStore = createStore<TowerSelectionState>()((set) => ({
  selectedKind: 'basic',
  setSelectedKind: (k) => set({ selectedKind: k }),
}));
