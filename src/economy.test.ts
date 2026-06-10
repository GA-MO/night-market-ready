import { describe, expect, it } from "vitest";
import {
  OFFLINE_CAP_MS,
  carryCap,
  cookMs,
  offlineEarnings,
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
