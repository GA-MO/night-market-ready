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
export const MAX_CUSTOMERS = 18;

/** How long a queued customer waits before storming off (ms). */
export const PATIENCE_MS = 25_000;

// ---------- active-play feel (combo / VIP / passive trickle) ----------

/** Time window to keep a serve combo alive between manual serves (ms). */
export const COMBO_WINDOW_MS = 3000;
/** Bonus payout per combo step and the cap, e.g. step 0.1 × cap 10 = up to +100% (2×). */
export const COMBO_STEP = 0.1;
export const COMBO_MAX = 10;
/** Chance a spawned customer is a paying VIP, and the payout multiplier they give. */
export const VIP_CHANCE = 0.12;
export const VIP_MULT = 3;
/** Without a hired helper a stall still plates one item this often (keeps it from bleeding). */
export const BASE_AUTOPLATE_MS = 2600;

/** Cook-time progress added per grill tap (ms). Tapping FANS THE FLAME — it speeds the
 *  current item up, it never conjures one. This keeps the cook rate (and the Cook
 *  upgrade) the real throughput ceiling: the human playtest found that instant +1-per-tap
 *  cooking turned focus mode into a money faucet limited only by finger speed. */
export const COOK_TAP_BOOST_MS = 400;

// ---------- fun events (rush hour / frenzy / critic / lucky cat / goals) ----------

/** Random gap between tour-bus rush hours (ms), how long one lasts, and its payout boost. */
export const RUSH_GAP_MIN_MS = 60_000;
export const RUSH_GAP_MAX_MS = 110_000;
export const RUSH_DURATION_MS = 25_000;
/** Customer spawn interval while a rush is on (floods the rushed stall). */
export const RUSH_SPAWN_MS = 480;
export const RUSH_MULT = 1.5;

/** Combo length that ignites Frenzy, how long it burns, and its flat payout multiplier. */
export const FRENZY_COMBO = 12;
export const FRENZY_MS = 8_000;
export const FRENZY_MULT = 3;
/** Re-ignition lockout after a Frenzy ends — keeps it a climax, not a perpetual engine
 *  (bot playtest: without this, frenzy cycled every ~25s of sustained serving). */
export const FRENZY_COOLDOWN_MS = 60_000;

/** Food critic: spawn chance, short fuse, and the rave-review stall buff for serving in time.
 *  Tuned down from 0.05/45s — bot playtest showed near-100% rave uptime during active play,
 *  which turned an "event" into a silent permanent ×2. */
export const CRITIC_CHANCE = 0.03;
export const CRITIC_PATIENCE_MS = 12_000;
export const REVIEW_MULT = 2;
export const REVIEW_MS = 30_000;

/** Lucky cat: random stroll gap and its reward (seconds of full-throughput income). */
export const CAT_GAP_MIN_MS = 55_000;
export const CAT_GAP_MAX_MS = 115_000;
export const CAT_REWARD_SEC = 40;
export const CAT_MIN_REWARD = 25;
/** Hard ceiling so late-game rates don't turn one cat tap into a jackpot. */
export const CAT_MAX_REWARD = 750;

export interface StallDef {
  id: string;
  name: string;
  emoji: string;
  color: number;
  foodColor: number;
  /** Full-colour food token texture generated in BootScene (not tinted). */
  foodTex: string;
  /** Distinct cooking-station texture (grill / wok / tea bar / mortar / hotpot). */
  stationTex: string;
  /** Whether the station has live flame (ember + steam FX, hot-station look). */
  hasFire: boolean;
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
    stationTex: "grill",
    hasFire: true,
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
    stationTex: "st_wok",
    hasFire: true,
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
    stationTex: "st_teabar",
    hasFire: false,
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
    stationTex: "st_mortar",
    hasFire: false,
    price: 24,
    baseCookMs: 3800,
    unlockCost: 6000,
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
    stationTex: "st_krata",
    hasFire: true,
    price: 34,
    baseCookMs: 4200,
    unlockCost: 20000,
    cookCostBase: 340,
    workerCostBase: 1120,
    side: "left",
    y: 1250,
  },
];
