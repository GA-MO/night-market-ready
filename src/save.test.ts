import { describe, expect, it } from "vitest";
import { defaultState, loadState, saveState } from "./save";
import { STALLS } from "./config";

function memStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k: string) => m.get(k) ?? null,
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => void m.delete(k),
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

describe("save/load", () => {
  it("returns defaults when storage is empty", () => {
    const s = loadState(memStorage());
    expect(s.money).toBe(0);
    expect(s.stalls[STALLS[0].id].unlocked).toBe(true); // first stall is free
    expect(s.stalls[STALLS[1].id].unlocked).toBe(false);
  });

  it("round-trips state", () => {
    const storage = memStorage();
    const s = defaultState();
    s.money = 1234;
    s.carryLvl = 2;
    s.stalls[STALLS[1].id].unlocked = true;
    s.stalls[STALLS[1].id].cookLvl = 3;
    saveState(s, storage);

    const loaded = loadState(storage);
    expect(loaded.money).toBe(1234);
    expect(loaded.carryLvl).toBe(2);
    expect(loaded.stalls[STALLS[1].id].unlocked).toBe(true);
    expect(loaded.stalls[STALLS[1].id].cookLvl).toBe(3);
  });

  it("survives corrupted storage", () => {
    const storage = memStorage();
    storage.setItem("nmr-save-v1", "{not json!!");
    const s = loadState(storage);
    expect(s.money).toBe(0);
  });

  it("fills in missing stalls from older saves", () => {
    const storage = memStorage();
    storage.setItem(
      "nmr-save-v1",
      JSON.stringify({ money: 50, stalls: { mooping: { unlocked: true, cookLvl: 1, workerLvl: 0 } } }),
    );
    const s = loadState(storage);
    expect(s.money).toBe(50);
    expect(s.stalls[STALLS[0].id].cookLvl).toBe(1);
    expect(s.stalls[STALLS[2].id]).toBeDefined();
    expect(s.stalls[STALLS[2].id].unlocked).toBe(false);
  });
});
