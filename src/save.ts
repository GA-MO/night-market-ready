import { STALLS } from "./config";

export interface StallState {
  unlocked: boolean;
  cookLvl: number;
  workerLvl: number;
}

export interface SaveState {
  money: number;
  carryLvl: number;
  speedLvl: number;
  stalls: Record<string, StallState>;
  lastSeen: number;
}

const KEY = "nmr-save-v1";

export function defaultState(): SaveState {
  const stalls: Record<string, StallState> = {};
  for (const s of STALLS) {
    stalls[s.id] = { unlocked: s.unlockCost === 0, cookLvl: 0, workerLvl: 0 };
  }
  return { money: 0, carryLvl: 0, speedLvl: 0, stalls, lastSeen: Date.now() };
}

export function loadState(storage: Storage = localStorage): SaveState {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<SaveState>;
    const def = defaultState();
    const stalls = { ...def.stalls };
    if (parsed.stalls) {
      for (const id of Object.keys(stalls)) {
        if (parsed.stalls[id]) stalls[id] = { ...stalls[id], ...parsed.stalls[id] };
      }
    }
    return { ...def, ...parsed, stalls };
  } catch {
    return defaultState();
  }
}

export function saveState(state: SaveState, storage: Storage = localStorage): void {
  state.lastSeen = Date.now();
  try {
    storage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked (private mode) — play on without persistence.
  }
}
