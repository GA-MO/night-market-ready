// Pure balance math — kept free of Phaser so it is unit-testable.
import { DAILY_CAP_DAY, PRESTIGE_BONUS, STAR_BONUS, STAR_SALES } from "./config";

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

/** Seconds to save up `cost` at a given ฿/sec rate (Infinity if not earning). */
export function secondsToAfford(cost: number, ratePerSec: number): number {
  return ratePerSec <= 0 ? Infinity : cost / ratePerSec;
}

/** Live earning rate (฿/sec) at full throughput across unlocked stalls — drives daily scaling. */
export function ratePerSecond(stalls: OfflineStallInfo[]): number {
  let r = 0;
  for (const s of stalls) {
    if (!s.unlocked) continue;
    r += s.price / (cookMs(s.baseCookMs, s.cookLvl) / 1000);
  }
  return r;
}

// ---------- collection book ----------

/** Stars earned (0–3) from lifetime sales of a dish. */
export function starsFromSales(sales: number): number {
  let stars = 0;
  for (const threshold of STAR_SALES) {
    if (sales >= threshold) stars++;
  }
  return stars;
}

/** Combined permanent price multiplier from collection stars and prestige level. */
export function priceMultiplier(stars: number, prestige: number): number {
  return (1 + stars * STAR_BONUS) * (1 + prestige * PRESTIGE_BONUS);
}

/** Final per-sale payout for a dish, after stars and prestige. */
export function effectivePrice(basePrice: number, stars: number, prestige: number): number {
  return Math.max(1, Math.round(basePrice * priceMultiplier(stars, prestige)));
}

// ---------- daily streak ----------

/**
 * Day count for today's claim given the last-claimed day.
 * `today`/`yesterday` are caller-supplied `YYYY-MM-DD` strings (kept pure for testing).
 * Returns 0 if today's bonus was already claimed.
 */
export function streakForToday(
  prevStreak: number,
  lastClaim: string,
  today: string,
  yesterday: string,
): number {
  if (lastClaim === today) return 0; // already claimed
  if (lastClaim === yesterday) return prevStreak + 1; // continued the streak
  return 1; // fresh start (first ever, or a day was skipped)
}

/** Daily bonus ฿: grows with the streak day (capped) and the player's current earning rate. */
export function dailyReward(streakDay: number, ratePerSec: number): number {
  const day = Math.min(Math.max(streakDay, 1), DAILY_CAP_DAY);
  const seconds = 60 * day; // day 1 = 1 min of earnings … day 7 = 7 min
  return Math.max(40 * day, Math.floor(ratePerSec * seconds));
}
