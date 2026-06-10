export const GAME_W = 720;
export const GAME_H = 1280;
export const LANE_X = 360;
export const ENTRANCE = { x: 360, y: 1230 };

export const GRILL_MAX = 4;
export const COUNTER_MAX = 8;
export const QUEUE_MAX = 4;
export const MAX_CUSTOMERS = 14;

export interface StallDef {
  id: string;
  name: string;
  emoji: string;
  color: number;
  foodColor: number;
  price: number;
  baseCookMs: number;
  unlockCost: number;
  cookCostBase: number;
  workerCostBase: number;
  side: "left" | "right";
  y: number;
}

export const STALLS: StallDef[] = [
  {
    id: "mooping",
    name: "Moo Ping",
    emoji: "🍢",
    color: 0xff6b35,
    foodColor: 0xa05a2c,
    price: 6,
    baseCookMs: 2400,
    unlockCost: 0,
    cookCostBase: 35,
    workerCostBase: 120,
    side: "left",
    y: 330,
  },
  {
    id: "padthai",
    name: "Pad Thai",
    emoji: "🍜",
    color: 0xffc145,
    foodColor: 0xf2a541,
    price: 11,
    baseCookMs: 3000,
    unlockCost: 300,
    cookCostBase: 70,
    workerCostBase: 240,
    side: "right",
    y: 560,
  },
  {
    id: "thaitea",
    name: "Thai Tea",
    emoji: "🧋",
    color: 0xc77dff,
    foodColor: 0xe07a2f,
    price: 16,
    baseCookMs: 3400,
    unlockCost: 1000,
    cookCostBase: 120,
    workerCostBase: 420,
    side: "left",
    y: 790,
  },
];
