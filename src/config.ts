export const GAME_W = 720;
export const GAME_H = 1280; // viewport height
/** The world is taller than the viewport; the camera follows the player down it. */
export const WORLD_H = 1640;
export const LANE_X = 360;
export const ENTRANCE = { x: 360, y: WORLD_H - 60 };

/** Cumulative sales needed to earn each collection-book star (max 3). */
export const STAR_SALES = [40, 160, 480];
/** Permanent price bonus per earned star. */
export const STAR_BONUS = 0.1;
/** Permanent earnings multiplier gained per prestige ("move to the Floating Market"). */
export const PRESTIGE_BONUS = 0.25;
/** Daily-streak reward caps out at this many days. */
export const DAILY_CAP_DAY = 7;

export const GRILL_MAX = 4;
export const COUNTER_MAX = 8;
export const QUEUE_MAX = 4;
export const MAX_CUSTOMERS = 14;

/** How long a queued customer waits before storming off (ms). */
export const PATIENCE_MS = 25_000;

export interface StallDef {
  id: string;
  name: string;
  emoji: string;
  color: number;
  foodColor: number;
  /** Full-colour food token texture generated in BootScene (not tinted). */
  foodTex: string;
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
    foodTex: "food_skewer",
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
    foodTex: "food_noodle",
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
    foodTex: "food_tea",
    price: 16,
    baseCookMs: 3400,
    unlockCost: 1000,
    cookCostBase: 120,
    workerCostBase: 420,
    side: "left",
    y: 790,
  },
  {
    id: "somtam",
    name: "Som Tam",
    emoji: "🥗",
    color: 0x90be6d,
    foodColor: 0xbcd35f,
    foodTex: "food_somtam",
    price: 24,
    baseCookMs: 3800,
    unlockCost: 3000,
    cookCostBase: 200,
    workerCostBase: 720,
    side: "right",
    y: 1020,
  },
  {
    id: "mookrata",
    name: "Moo Krata",
    emoji: "🍲",
    color: 0xef6351,
    foodColor: 0xd9534f,
    foodTex: "food_krata",
    price: 34,
    baseCookMs: 4200,
    unlockCost: 8000,
    cookCostBase: 340,
    workerCostBase: 1120,
    side: "left",
    y: 1250,
  },
];
