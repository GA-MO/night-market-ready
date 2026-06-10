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

- `src/config.ts` — stall defs (5) + tuning constants (positions, prices, costs); `WORLD_H` (taller than viewport), `STAR_SALES`, `PRESTIGE_BONUS`, `PATIENCE_MS`
- `src/economy.ts` — pure balance math, no Phaser imports, unit-tested (incl. stars/prestige/daily)
- `src/save.ts` — localStorage persistence; forward-compatible merge in `loadState` (old saves must keep working — add new fields to `defaultState` and merge)
- `src/fx.ts` — reusable juice: camera bloom+vignette (WebGL-guarded), fire/steam/sparkle emitters, fireflies, floating `+฿N`, camera punch
- `src/ads.ts` — `AdProvider` interface + `MockAdProvider` (3s countdown); swap for a real SDK later
- `src/analytics.ts` — `track(event, props)` console funnel
- `src/scenes/BootScene.ts` — all texture generation (shaded/gradient procedural sprites + food-per-dish)
- `src/scenes/GameScene.ts` — world, camera-follow down a tall lane, input (WASD + joystick w/ `scrollFactor 0`), spawning, purchases, stats, daily, ads, prestige; talks to UIScene via `this.events` (`money`, `state-changed`, `stall-tapped`, `toast`, `celebrate`, `toggle-stats`, `daily-available`, `offline-earned`, `world-reset`)
- `src/scenes/UIScene.ts` — HUD (money pill, 📖 book, 📺 boost), upgrade bar, stall panel, stats overlay, daily/welcome-back/book/prestige modals, ad countdown overlay, toasts
- `src/entities/Stall.ts` — cooking, queue+patience, cash pile, sales→stars, `unitPrice`; `Player`, `Customer`, `Worker`

## Verifying changes (do this, not just typecheck)

`window.__game` is exposed for automated playtesting. With the dev server running,
drive the game via chrome-devtools MCP `evaluate_script`:

```js
const gs = window.__game.scene.getScene("game");
gs.player.obj.setPosition(gs.stalls[0].grillPos.x, gs.stalls[0].grillPos.y); // stand at grill
gs.state.money = 5000; gs.events.emit("money", 5000);                        // grant cash
gs.stallTapped(gs.stalls[1]);                                                // tap a stall
```

Gotchas learned the hard way:
- Autosave runs every 4s and stamps `lastSeen` — you cannot test offline earnings by
  editing localStorage on a live page; call `gs.grantOfflineEarnings()` after setting
  `gs.state.lastSeen` instead.
- Interaction zones are distance-based (radius ~60px). Keep grill/counter/pile
  positions ≥80px apart or actions trigger simultaneously (pile was moved once for this).
- The joystick only starts on pointerdown that hits no interactive object (stall zones,
  UI bar/panel absorb taps).

## Conventions

- TypeScript strict, `noUnusedLocals`/`noUnusedParameters` — prefix intentionally unused params with `_`
- Game-facing text is English with ฿ currency; code comments English
- Balance changes go in `economy.ts`/`config.ts` with a test when the math is non-trivial
