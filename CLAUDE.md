# Night Market Ready! — agent guide

Thai night-market **idle arcade** prototype (Pizza Ready! genre). Phaser 3 + TypeScript +
Vite, portrait 720×1280. All art is procedural (BootScene Graphics), all audio is
WebAudio-synthesized — **never add binary assets without asking**.

Read `docs/PLAN.md` before starting work — it has the prioritized roadmap with
acceptance criteria and the current status.

## Commands

- `npm run dev` — dev server at http://localhost:5174
- `npm run build` — typecheck + production build incl. PWA manifest/SW (run before committing)
- `npm test` — vitest (economy + save); keep pure logic in `economy.ts`/`save.ts` so it stays testable
- `npm run typecheck`
- `npm run icons` — regenerate PWA icons procedurally (`scripts/generate-icons.mjs`, sharp → `public/`)

## Architecture (one file per concern — keep it that way)

- `src/config.ts` — stall defs (5) + tuning constants (positions, prices, costs); `WORLD_H` (taller than viewport), `STAR_SALES`, `PRESTIGE_BONUS`, `PATIENCE_MS`; fun-event tuning (`RUSH_*`, `FRENZY_*`, `CRITIC_*`/`REVIEW_*`, `CAT_*`)
- `src/economy.ts` — pure balance math, no Phaser imports, unit-tested (incl. stars/prestige/daily)
- `src/save.ts` — localStorage persistence; forward-compatible merge in `loadState` (old saves must keep working — add new fields to `defaultState` and merge)
- `src/fx.ts` — reusable juice: camera bloom+vignette (WebGL-guarded), fire/steam/sparkle emitters, fireflies, floating `+฿N`, camera punch
- `src/ads.ts` — `AdProvider` interface + `MockAdProvider` (3s countdown); swap for a real SDK later
- `src/analytics.ts` — `track(event, props)` console funnel
- `src/scenes/BootScene.ts` — all texture generation (shaded/gradient procedural sprites + food-per-dish)
- `src/scenes/GameScene.ts` — **map + focus model** (no roaming player/joystick). Map: camera at `MAP_ZOOM` (=1, stalls big & readable), drag to scroll the lane with flick `scrollVel`/`SCROLL_FRICTION` inertia; `pointerDragged` (>`DRAG_TAP` px) suppresses the tap so a flick never opens a stall. Tap a stall → `enterFocus` zooms to `FOCUS_ZOOM` (=1.5) centred on the stall's own action area (`cx + dir*80`), dims the rest to 0.12, remembers `mapScrollY`; `exitFocus` (Back, ESC, or downward `SWIPE_BACK` swipe) restores zoom + scroll. **Actions are diegetic** — `Stall.onGrillTap`/`onCounterTap`/`onPileTap` (zones over the station/counter/pile) call `cookFocus` (stoke the fire: +`COOK_TAP_BOOST_MS` cook progress — never conjures an item, throughput stays cook-limited), `serveFocus` (serve a tray, size = `carryCap`), `collectFocus` (scoop pile). Auto-cook + auto-serve + workers + offline unchanged. **Fun events** (all timers scene-clock, all state reset in `create()` for prestige restarts): tour-bus **rush** (`startRush`/`endRush`, floods one stall, ×1.5, `stall.rushUntil`), **frenzy** (combo ≥ `FRENZY_COMBO` → 8s flat ×3 manual serves, combo decay paused, then a 60s `FRENZY_COOLDOWN_MS` lockout — meter greys out), **lucky cat** (strolls the map *and* the focused upper strip; reward clamped to `CAT_MAX_REWARD`), **critic→rave** (`stall.onReview`, **manual serves only** so idle income never inherits ×2), **rotating goals** (`ensureGoal`/`tickGoal`, `goalInfo()` polled by UIScene). Events to UIScene: `money`, `state-changed`, `focus-enter`, `focus-exit`, `combo`, `frenzy`, `rush`, `rush-end`, `goal-done`, `toast`, `celebrate`, `toggle-stats`, `daily-available`, `offline-earned`, `world-reset`
- `src/scenes/UIScene.ts` — HUD (money pill, 📖 book, 📺 boost). `mapBar` = global upgrades (🍽️ Tray = carry, ⚡ Service = speed→serve cooldown), shown on the map, hidden in focus. Slim focus `panel` = per-stall Cook/Helper upgrades + Fill-grill/Back only (the cook/serve/collect actions are diegetic taps in the scene, not buttons). Stats overlay, daily/welcome-back/book/prestige modals, ad overlay, toasts. `update()` live-refreshes the focus panel. `Stall`: map cash badge (`setMapMode`/`refreshMapBadge`) floats above the awning; `setFocused` enables the 3 action zones and pulses the grill/counter + a 👆 cue over the cash
- `src/entities/Stall.ts` — cooking, queue+patience, cash pile, sales→stars, `unitPrice`; `reviewUntil`/`rushUntil` payout buffs (applied in `recordSale`, pulsing `buffBadge` shows 🚌/📰); `Player`, `Customer` (`makeVip`/`makeCritic`), `Worker`

## Verifying changes (do this, not just typecheck)

`window.__game` is exposed for automated playtesting. With the dev server running,
drive the game via chrome-devtools MCP `evaluate_script`:

```js
const gs = window.__game.scene.getScene("game");
gs.state.money = 5000; gs.events.emit("money", 5000);  // grant cash
gs.enterFocus(gs.stalls[0]);                           // zoom into a stall
gs.cookFocus(); gs.serveFocus(); gs.collectFocus();    // run the loop (cook→serve→collect)
gs.exitFocus();                                        // back to the map
gs.stalls[1].onTapped();                               // simulate a stall tap (unlock+focus)
gs.cameras.main.scrollY = 360;                         // scroll the map (clamps to [0,360])
```
NOTE: chrome-devtools-mcp dispatches a real pointer at the cursor each step, which can
fire a stray stall tap (→ focus). Drive state in ONE synchronous `evaluate_script`, or set
`gs.input.enabled = false` while poking internals, then re-enable it.

Gotchas learned the hard way:
- Autosave runs every 4s and stamps `lastSeen` — you cannot test offline earnings by
  editing localStorage on a live page; call `gs.grantOfflineEarnings()` after setting
  `gs.state.lastSeen` instead.
- Synthetic DOM PointerEvents dispatched on the canvas do NOT reach Phaser's input
  (activePointer stays at 0,0). To test taps, call the GameObject callback directly
  (`stall.onTapped()`) or the scene method (`gs.enterFocus(...)`).
- The overview camera uses bounds smaller than the zoomed-out view, so `centerOn` clamps
  to (0,0); the lane sits at the top. Adjust `OVERVIEW_ZOOM`/`OVERVIEW_CENTER_Y` together.

## Conventions

- TypeScript strict, `noUnusedLocals`/`noUnusedParameters` — prefix intentionally unused params with `_`
- Game-facing text is English with ฿ currency; code comments English
- Balance changes go in `economy.ts`/`config.ts` with a test when the math is non-trivial
