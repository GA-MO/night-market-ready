import { describe, expect, it } from "vitest";
import { STALLS } from "./config";
import {
  OFFLINE_CAP_MS,
  carryCap,
  cookMs,
  dailyReward,
  effectivePrice,
  offlineEarnings,
  priceMultiplier,
  ratePerSecond,
  secondsToAfford,
  starsFromSales,
  streakForToday,
  upgradeCost,
  workerCap,
} from "./economy";

describe("upgradeCost", () => {
  it("grows with level", () => {
    let prev = 0;
    for (let lvl = 0; lvl < 10; lvl++) {
      const cost = upgradeCost(50, lvl);
      expect(cost).toBeGreaterThan(prev);
      prev = cost;
    }
  });

  it("returns the base at level 0", () => {
    expect(upgradeCost(50, 0)).toBe(50);
  });
});

describe("cookMs", () => {
  it("gets faster with level but never below the floor", () => {
    expect(cookMs(2400, 1)).toBeLessThan(cookMs(2400, 0));
    expect(cookMs(2400, 99)).toBe(600);
  });
});

describe("caps and capacities", () => {
  it("carry capacity starts at 3", () => {
    expect(carryCap(0)).toBe(3);
    expect(carryCap(2)).toBe(5);
  });

  it("no worker means zero capacity", () => {
    expect(workerCap(0)).toBe(0);
    expect(workerCap(1)).toBe(2);
  });
});

describe("offlineEarnings", () => {
  const stall = { unlocked: true, workerLvl: 1, cookLvl: 0, price: 6, baseCookMs: 2400 };

  it("earns nothing without a worker", () => {
    expect(offlineEarnings(3_600_000, [{ ...stall, workerLvl: 0 }])).toBe(0);
  });

  it("earns nothing when locked", () => {
    expect(offlineEarnings(3_600_000, [{ ...stall, unlocked: false }])).toBe(0);
  });

  it("is capped at 4 hours", () => {
    const capped = offlineEarnings(OFFLINE_CAP_MS, [stall]);
    expect(offlineEarnings(OFFLINE_CAP_MS * 10, [stall])).toBe(capped);
  });

  it("scales with elapsed time", () => {
    expect(offlineEarnings(2_000_000, [stall])).toBeGreaterThan(offlineEarnings(1_000_000, [stall]));
  });

  it("never goes negative", () => {
    expect(offlineEarnings(-5000, [stall])).toBe(0);
  });
});

describe("collection book", () => {
  it("awards stars as cumulative sales cross thresholds (40/160/480)", () => {
    expect(starsFromSales(0)).toBe(0);
    expect(starsFromSales(39)).toBe(0);
    expect(starsFromSales(40)).toBe(1);
    expect(starsFromSales(159)).toBe(1);
    expect(starsFromSales(160)).toBe(2);
    expect(starsFromSales(480)).toBe(3);
    expect(starsFromSales(99999)).toBe(3);
  });

  it("price multiplier stacks +10%/star with +25%/prestige", () => {
    expect(priceMultiplier(0, 0)).toBeCloseTo(1);
    expect(priceMultiplier(3, 0)).toBeCloseTo(1.3);
    expect(priceMultiplier(0, 2)).toBeCloseTo(1.5);
    expect(priceMultiplier(3, 2)).toBeCloseTo(1.3 * 1.5);
  });

  it("effective price rounds and never drops below 1", () => {
    expect(effectivePrice(6, 0, 0)).toBe(6);
    expect(effectivePrice(6, 3, 0)).toBe(8); // 6 * 1.3 = 7.8 → 8
    expect(effectivePrice(0, 0, 0)).toBe(1);
  });
});

describe("ratePerSecond", () => {
  it("sums only unlocked stalls", () => {
    const a = { unlocked: true, workerLvl: 0, cookLvl: 0, price: 6, baseCookMs: 2400 };
    const b = { unlocked: false, workerLvl: 0, cookLvl: 0, price: 16, baseCookMs: 3400 };
    expect(ratePerSecond([a, b])).toBeCloseTo(6 / 2.4);
  });
});

describe("daily streak", () => {
  it("continues when yesterday was claimed, resets after a gap", () => {
    expect(streakForToday(3, "2026-06-09", "2026-06-10", "2026-06-09")).toBe(4);
    expect(streakForToday(3, "2026-06-07", "2026-06-10", "2026-06-09")).toBe(1);
  });

  it("returns 0 when today is already claimed", () => {
    expect(streakForToday(3, "2026-06-10", "2026-06-10", "2026-06-09")).toBe(0);
  });

  it("reward grows with the day and caps at day 7", () => {
    expect(dailyReward(1, 5)).toBeGreaterThan(0);
    expect(dailyReward(7, 5)).toBeGreaterThan(dailyReward(1, 5));
    expect(dailyReward(99, 5)).toBe(dailyReward(7, 5));
  });

  it("has a floor independent of earning rate", () => {
    expect(dailyReward(1, 0)).toBe(40);
  });
});

/**
 * Balance guard for PLAN.md Phase 1 #4: a fresh save should unlock Pad Thai in
 * ≤4 min and Thai Tea in ≤10 min of active play. We model active throughput as the
 * cook-limited ceiling (`ratePerSecond`) discounted by realistic solo-play overhead.
 * If costs/prices/cook-times drift out of range, this test fails — that's the point.
 */
describe("balance targets (unlock pacing)", () => {
  const ACTIVE = 0.6; // solo shuttling reaches ~60% of the cook-limited ceiling
  const SOLO_SPLIT = 0.55; // running two stalls alone splits attention further
  const info = (id: string) => {
    const def = STALLS.find((s) => s.id === id)!;
    return { unlocked: true, workerLvl: 0, cookLvl: 0, price: def.price, baseCookMs: def.baseCookMs };
  };
  const cost = (id: string) => STALLS.find((s) => s.id === id)!.unlockCost;

  it("Pad Thai is affordable within 4 minutes", () => {
    const rate = ratePerSecond([info("mooping")]);
    const seconds = secondsToAfford(cost("padthai"), rate * ACTIVE);
    expect(seconds).toBeLessThanOrEqual(4 * 60);
  });

  it("Thai Tea is affordable within 10 minutes", () => {
    const padSeconds = secondsToAfford(cost("padthai"), ratePerSecond([info("mooping")]) * ACTIVE);
    const bothRate = ratePerSecond([info("mooping"), info("padthai")]);
    const teaSeconds = padSeconds + secondsToAfford(cost("thaitea"), bothRate * SOLO_SPLIT);
    expect(teaSeconds).toBeLessThanOrEqual(10 * 60);
  });

  it("secondsToAfford is Infinity with no income", () => {
    expect(secondsToAfford(300, 0)).toBe(Infinity);
  });
});
