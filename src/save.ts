import { STALLS } from "./config";
import type { Goal } from "./economy";

export interface StallState {
  unlocked: boolean;
  cookLvl: number;
  workerLvl: number;
  /** Lifetime sales of this dish (drives collection-book stars). */
  sales: number;
  /** Earned collection-book stars (0–3); each grants a permanent price bonus. */
  stars: number;
}

export interface SaveState {
  money: number;
  carryLvl: number;
  speedLvl: number;
  stalls: Record<string, StallState>;
  lastSeen: number;
  // --- meta layer ---
  totalServed: number;
  totalEarned: number;
  /** Consecutive days opened; reset if a day is skipped. */
  streak: number;
  /** Local calendar day of the last claimed daily bonus, e.g. "2026-06-10". */
  lastDailyClaim: string;
  /** Times the player has prestiged ("moved to the Floating Market"). */
  prestige: number;
  /** Whether the new-player grill→counter→cash walkthrough has been completed. */
  tutorialDone: boolean;
  /** How many rotating session goals were completed (drives the next goal's difficulty). */
  goalIdx: number;
  /** The in-flight goal (generated once so a rising rate never moves the target). */
  goal: Goal | null;
  /** Baseline metric value (totalServed / totalEarned) captured when the goal started. */
  goalBase: number;
}

const KEY = "nmr-save-v1";

function defaultStall(unlocked: boolean): StallState {
  return { unlocked, cookLvl: 0, workerLvl: 0, sales: 0, stars: 0 };
}

export function defaultState(): SaveState {
  const stalls: Record<string, StallState> = {};
  for (const s of STALLS) {
    stalls[s.id] = defaultStall(s.unlockCost === 0);
  }
  return {
    money: 0,
    carryLvl: 0,
    speedLvl: 0,
    stalls,
    lastSeen: Date.now(),
    totalServed: 0,
    totalEarned: 0,
    streak: 0,
    lastDailyClaim: "",
    prestige: 0,
    tutorialDone: false,
    goalIdx: 0,
    goal: null,
    goalBase: 0,
  };
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
