# Roadmap — Night Market Ready!

Strategy context: chosen over match-3 (UA-war saturation) and pure puzzle (declining
retention). Idle arcade wins on small-team feasibility; revenue model is ads × volume,
so the game must be **clip-friendly** (visual progression = market lighting up) and
**retention-sticky** (meta layer). Theme (Thai night market) is deliberately unclaimed
by major publishers — keep leaning into it.

**Master gate (from the original 3-week plan):** before investing past Phase 2, the
game must pass the "can't put it down for 10 minutes" self-playtest, and people around
you should ask to keep playing. If it fails → harvest the systems, change theme/twist,
don't sink more weeks.

## Status — Thermal fix + focus-zoom redesign (2026-06-10)

- [x] **Heat/perf fix** (device was overheating): removed the full-screen Bloom postFX
  (multi-pass blur every frame — the #1 GPU cost; vignette kept), capped the loop at
  60fps (`fps.target` + `forceSetTimeOut`, stops 120Hz phones doubling work),
  `powerPreference: "low-power"` + `antialias: false`, slowed ember/steam emitters,
  fewer stars (70→40) / fireflies (20→12), and skip the per-frame progress-bar redraw
  when unchanged.
- [x] **Map + focus gameplay** (replaces roaming): no joystick/player. **Map** at zoom 1
  (stalls big & readable) — drag to scroll the lane with flick inertia, cash badge (💰฿N)
  floats above any stall with money to collect. **Tap a stall** → zoom to fill the screen,
  dim the rest. **Actions are diegetic** (famous-game style): tap the **grill** to cook
  (+1 on top of the idle timer), the **counter** to serve, the **cash** to collect — grill
  & counter pulse, a 👆 cue sits on the cash. Slim bottom bar = Cook/Helper upgrades +
  Fill-grill + Back (or swipe down / ESC). Returns to the remembered scroll position. Tray
  (carry) = plates per serve, Service (speed) = serve cooldown. Antialias re-enabled (the
  thermal wins were bloom-off + fps-cap, not MSAA). Simulation/economy/save/tests
  **unchanged** (25 tests green). Workers still run un-focused stalls (active one + idle
  rest = "manage one at a time").

## Status — Fun / difficulty pass (2026-06-10)

Addressing the "is it fun / well-balanced?" review — active play was thin and helpers
removed the gameplay. Added (economy.ts pure parts unit-tested, 29 tests green):
- [x] **Serve combo (A+B):** manual serving on a streak pays a rising multiplier
  (`comboMultiplier`, up to 2× over `COMBO_MAX` steps, `COMBO_WINDOW_MS` to chain). Only
  manual serves combo — idle/helper sales pay 1× — so being present & tapping always beats
  autopilot. Combo banner in UIScene.
- [x] **Focused stall = you serve it:** auto-serve + passive trickle pause on the focused
  stall so a queue builds for combo serving; customers for it spawn right below it (fast
  arrival) and 80% of spawns + a faster interval flow to it. `reflowQueue` keeps arrived
  customers servable so combos chain.
- [x] **VIP customers (A+D):** `VIP_CHANCE` spawn gold/crowned customers paying `VIP_MULT`×.
- [x] **No dead stalls (C):** un-focused stalls without a helper self-plate slowly
  (`BASE_AUTOPLATE_MS`) so they trickle sales instead of bleeding every customer — helper
  now *speeds up* a stall rather than being required.
- [x] **Feedback (D):** float `+฿` on serve, combo banner, camera punch on big serves.
- [ ] Still open: real human playtest for the 10-min "can't put it down" gate;
  rebalance once combo/VIP throughput is observed in real sessions.

## Status — Fun events pass (2026-06-10)

Five interlocking excitement/goal systems, all tuned to stay thermal-safe (no new postFX,
no persistent emitters; HUD redraws are throttled to 150ms and skipped when unchanged):
- [x] **🚌 Rush hour (tour bus):** every 80–150s a 25s rush floods one stall (the focused
  one if any) — spawn interval drops to `RUSH_SPAWN_MS`, customers spawn near the stall,
  sales pay ×`RUSH_MULT`. HUD countdown banner + pulsing "🚌 RUSH" badge on the stall.
- [x] **🔥 Frenzy:** combo reaching `FRENZY_COMBO` (12) ignites an 8s burst where every
  manual plate pays a flat ×`FRENZY_MULT` (3). Meter under the combo banner fills as the
  combo climbs and drains during the burn; combo decay pauses while frenzied, then resets.
  Synergises with rush (faster queue → faster ignition). Verified ignition end-to-end.
- [x] **📰 Food critic:** `CRITIC_CHANCE` spawns a short-fused (12s) critic; serving them
  in time (manually or via helper) grants the stall a ×2 "RAVE" price buff for 45s with a
  badge. Buffs stack multiplicatively with rush (🚌📰 ×3 badge).
- [x] **🐈 Lucky cat:** strolls across the visible map every 55–115s (map mode only);
  tapping it pays ~40s of full-throughput income. Rewards browsing instead of camping.
- [x] **🎯 Rotating goals:** serve-N / earn-฿N / combo-×N cycle (`goalForIndex`, pure +
  tested) with scaling targets/rewards, persisted in the save (goal fixed at creation so
  a rising rate never moves it). HUD card under the money pill; auto-rotates on completion.
- [x] Tuning: `MAX_CUSTOMERS` 14→18 (5 busy stalls were starving the focused queue),
  `FRENZY_COMBO` 15→12 (bot playtest stalled at 11). 35 unit tests green; in-browser
  playtest of all five systems via `window.__game` (frenzy ignited at ~17s of serving).

## Status — Balance pass from bot playtests (2026-06-10)

Three ~3-min automated "perfect new player" sessions (fresh save, ~3 serve-taps/s, greedy
shopping, rush-chasing) via `window.__game`; tuned between runs. Bot ≈ upper bound; a
human plays at roughly half this throughput.
- [x] **Frenzy was a perpetual engine** (7 ignitions/2min, one per ~25s of serving) →
  added `FRENZY_COOLDOWN_MS` (60s) after each frenzy; HUD meter greys out while recharging.
  Now ~1/min at perfect play.
- [x] **Rave ×2 leaked into idle income** — helpers serving critics earned the buff →
  rave now requires a *manual* serve. Also `CRITIC_CHANCE` 0.05→0.03, `REVIEW_MS` 45→30s
  (perfect play still approaches ~100% uptime — WATCH in the human playtest; next lever
  is chance 0.02 or a rave cooldown).
- [x] **Lucky cat never appeared** for engaged players (map-only spawn, players live in
  focus) → cat now also crosses the focused view (upper strip, clear of tap zones), and
  its reward is capped (`CAT_MAX_REWARD` ฿750). 2 cats seen/3min after the fix.
- [x] **Goals rotated every ~12-15s** → difficulty now ramps per completed goal (not per
  cycle): serve 12+6i, earn rate·45·(1+i), combo min(12, 4+i); rewards ~20% of effort.
  Perfect-play bot still clears one per ~20s early on (humans ~40-60s) — early snappiness
  is intentional onboarding; WATCH whether mid-game pacing feels right.
- [x] **Content exhausted in <5 min** (all 5 stalls) → unlock costs stretched: Som Tam
  3,000→6,000, Moo Krata 8,000→20,000. Early pacing kept (Pad Thai ~50s, Thai Tea ~2min
  for the bot; balance-guard tests still pass). Rush cadence tightened 80-150s→60-110s.
- Bot-measured after tuning (208s): Pad Thai 56s · frenzy ×3 · rush ×2 · cats ×2 ·
  raves ×7 · 0 lost sales · 0 console errors.
- [ ] Remaining for the human 10-min gate: rave uptime feel, goal mid-game pacing,
  whether ฿/min growth makes prestige (+25%) feel earned rather than farmed.

## Status — Human playtest verdict #1: "money is a faucet" (2026-06-11)

First real-player verdict on the deployed build: *"enter a stall, tap-tap-tap combo,
money pours in, unlocked everything in no time — boring."* Root cause: the grill tap
CONJURED an item (+1 stock, free, instant), so serveManual's grill-fallback made income
limited only by finger speed — every cook upgrade, timer and scarcity system was bypassed.
- [x] **Cook tap reworked: stoke, don't conjure.** `cookTap` now adds `COOK_TAP_BOOST_MS`
  (400ms) of cook progress (leftover carries into the next item). Hammering ≈2× idle cook
  rate; throughput is genuinely cook-limited, the Cook upgrade is the real income lever,
  and counter-spam with an empty grill just denies. The balance-guard model (cook-limited
  ceiling × overhead) is now an accurate description of active play again.
- [x] `VIP_MULT` 4→3 (one less silent multiplier in the stack).
- Bot delta (same 3-min protocol): ฿/min 7.7k→4.9k (-36%); humans fall further since the
  old loop needed no skill. Pad Thai 54s · Thai Tea 150s · frenzy ×3 · 0 lost sales.
- [ ] Get a second human verdict: does the cook-limited loop create enough decisions
  (stoke vs serve vs collect), or does it need demand-side pressure too (patience/queue)?

## Status — DONE (2026-06-10)

- [x] Core loop: grill → carry → counter → customers pay → cash pile → collect
- [x] 3 stalls (Moo Ping free / Pad Thai ฿300 / Thai Tea ฿1,000) with unlock + lighting celebration
- [x] Upgrades: carry, move speed, per-stall cook speed, hireable/upgradable helpers
- [x] Idle layer: helpers automate grill→counter; offline earnings (40% rate, 4h cap)
- [x] Persistence (localStorage, forward-compatible), autosave 4s + pagehide
- [x] Input: virtual joystick + WASD; WebAudio sfx; procedural art; 14 unit tests
- [x] Verified end-to-end in browser via `window.__game` automation

## Status — Studio-grade visual + juice pass (2026-06-10)

- [x] BootScene rewritten: shaded/rim-lit/gradient procedural textures — vendor mascot,
  shaded customers, per-dish food tokens (`food_skewer`/`food_noodle`/`food_tea`, full
  colour, not tinted — set via `StallDef.foodTex`), glossy coin, coal-bed grill,
  wood-grain counter, scalloped awning, paper `lantern`, plus `spark`/`steam` particles.
- [x] Effects layer (`src/fx.ts`): WebGL camera bloom + vignette (Canvas-safe guard),
  grill ember fire + steam emitters per stall, drifting ambient fireflies, cash-pile
  sparkle bursts, floating `+฿N` on collect, camera punch on big scoops, money-pill bounce.
- [x] Phase 1 #1 **customer patience** DONE — shrinking bar over queued customers (25s,
  `PATIENCE_MS`), storms off with 💢 + red flash + deny sfx when empty (no more deadlock
  when a stall is out of stock). Wired through `Stall.tickPatience`/`reflowQueue` +
  `Customer.arriveAtSlot`/`tickPatience`/`loseTemper`.
- [x] Phase 1 #2 **money feel** DONE — float `+฿N`, pile sparkle, money-pill bounce,
  growing-pile coin pulse.

## Phase 1 — Make the loop juicier — ✅ DONE

1. ~~**Customer patience**~~ — DONE.
2. ~~**Money feel**~~ — DONE (sparkle + float `+฿N` + pile pulse + pill bounce).
3. ~~**Stats for tuning**~~ — DONE. `totalServed`/`totalEarned`/`streak`/`prestige` in save;
   session ฿/min computed live; overlay toggled by tapping the title (emits `toggle-stats`).
4. ~~**Balance pass**~~ — GUARDED. `economy.test.ts` "balance targets" encodes the
   spec (Pad Thai ≤4 min, Thai Tea ≤10 min) via cook-limited `ratePerSecond` × realistic
   solo-play overhead (0.6 / 0.55). Current config passes (~3.3 min / ~8.25 min modelled).
   The test fails if costs/prices/cook-times regress. Still worth a real human playtest to
   confirm the *feel*, but the numbers are no longer a blind guess.

## Phase 2 — Meta layer / hybridcasual — ✅ DONE

5. ~~**Camera follow + Stalls 4 & 5**~~ — DONE. `WORLD_H = 1640` (> viewport); camera
   `startFollow` + bounds + deadzone; joystick sprites `scrollFactor(0)`; UIScene fixed.
   Som Tam + Moo Krata added with `food_somtam`/`food_krata` textures.
6. ~~**Daily streak**~~ — DONE. `streakForToday`/`dailyReward` (pure, tested); 7-day modal
   on first open per local day; reward scales with `ratePerSecond`, day-7 cap, ฿40×day floor.
7. ~~**Menu collection book** 📖~~ — DONE. Stars at 40/160/480 lifetime sales (`STAR_SALES`),
   +10%/star permanent price (`effectivePrice`). 📖 HUD button opens the modal.
8. ~~**Prestige**~~ — DONE. "Move to the Floating Market" (confirm modal in the book):
   resets stalls/upgrades, keeps stars, +25%/prestige (`PRESTIGE_BONUS`); `scene.restart()`.

## Phase 3 — Monetization scaffolding — ✅ DONE

9. ~~**`AdProvider` interface** + `MockAdProvider`~~ — DONE (`src/ads.ts`). 3s countdown
   overlay in UIScene. Placements wired: 2× earnings/4h (📺 HUD), instant-fill grills
   (stall panel), double offline (welcome-back modal). Swap the mock for a real SDK later.
10. ~~**Analytics**~~ — DONE (`src/analytics.ts`). `track(event, props)` → console:
    session_start, unlock, upgrade, ad_watched, prestige, daily_claim, star_earned.

## Phase 4 — Ship as app

11. ~~**PWA**~~ — DONE. `vite-plugin-pwa` (autoUpdate SW, fullscreen/portrait, navy+gold
    manifest). Icons generated procedurally: `npm run icons` → `scripts/generate-icons.mjs`
    (sharp rasterises an inline lantern SVG → `public/pwa-{192,512}.png`, maskable, apple-touch).
12. ~~**Capacitor wrap**~~ — SCAFFOLDED. `@capacitor/{core,cli,ios,android}` installed,
    `capacitor.config.ts` (appId `com.nightmarket.ready`, webDir `dist`, navy bg), scripts
    `cap:sync`/`cap:ios`/`cap:android`. Remaining (needs Xcode / Android Studio, not in this
    environment): `npm run build` → `npx cap add ios && npx cap add android` → `npm run cap:sync`
    → open the native project and build/sign. CocoaPods required for iOS.
13. **Store assets** — STILL OPEN (design task; produces binaries). The unlock-lighting +
    "MARKET FULLY LIT" celebration is the 3-second clip; build the screenshot/video flow
    around it. Tip: `take_screenshot` against `window.__game` can capture marketing frames.

## Explicitly out of scope (don't build without a new decision)

- Real ad SDK integration, IAP, server-side anything, level-based content,
  multiplayer/leaderboards, localization beyond English.

## Known debt / quirks

- `Stall.update` redraws the progress bar every frame (fine at this scale).
- Depth sorting is y-based and approximate; revisit only if visibly wrong after camera work.
- `Worker` class name shadows DOM `Worker` — local import wins; leave as is.
- Dev-server port is 5174 to avoid clashing with block-puzzle's 5173.
