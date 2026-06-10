// Pure balance math — kept free of Phaser so it is unit-testable.

export const GROWTH = 1.6;
export const CARRY_COST_BASE = 50;
export const SPEED_COST_BASE = 60;
export const OFFLINE_CAP_MS = 4 * 3_600_000;
export const OFFLINE_EFFICIENCY = 0.4;

export const CAPS = { cook: 15, carry: 12, speed: 10, worker: 8 };

export function upgradeCost(base: number, level: number): number {
  return Math.round(base * Math.pow(GROWTH, level));
}

export function cookMs(baseMs: number, level: number): number {
  return Math.max(600, baseMs * Math.pow(0.88, level));
}

export function carryCap(level: number): number {
  return 3 + level;
}

export function moveSpeed(level: number): number {
  return 270 + level * 22;
}

export function workerCap(level: number): number {
  return level <= 0 ? 0 : 1 + level;
}

export interface OfflineStallInfo {
  unlocked: boolean;
  workerLvl: number;
  cookLvl: number;
  price: number;
  baseCookMs: number;
}

/** Stalls with a hired helper keep selling while the player is away, at reduced efficiency. */
export function offlineEarnings(elapsedMs: number, stalls: OfflineStallInfo[]): number {
  const seconds = Math.min(Math.max(elapsedMs, 0), OFFLINE_CAP_MS) / 1000;
  let total = 0;
  for (const s of stalls) {
    if (!s.unlocked || s.workerLvl <= 0) continue;
    const perSec = s.price / (cookMs(s.baseCookMs, s.cookLvl) / 1000);
    total += perSec * OFFLINE_EFFICIENCY * seconds;
  }
  return Math.floor(total);
}
