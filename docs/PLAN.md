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
