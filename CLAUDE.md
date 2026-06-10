# Night Market Ready! — agent guide

Thai night-market **idle arcade** prototype (Pizza Ready! genre). Phaser 3 + TypeScript +
Vite, portrait 720×1280. All art is procedural (BootScene Graphics), all audio is
WebAudio-synthesized — **never add binary assets without asking**.

Read `docs/PLAN.md` before starting work — it has the prioritized roadmap with
acceptance criteria and the current status.

## Commands

- `npm run dev` — dev server at http://localhost:5174
- `npm run build` — typecheck + production build (run before committing)
- `npm test` — vitest (economy + save); keep pure logic in `economy.ts`/`save.ts` so it stays testable
- `npm run typecheck`

## Architecture (one file per concern — keep it that way)

- `src/config.ts` — stall defs + tuning constants (positions, prices, costs)
- `src/economy.ts` — pure balance math, no Phaser imports, unit-tested
- `src/save.ts` — localStorage persistence; forward-compatible merge in `loadState` (old saves must keep working — add new fields to `defaultState` and merge)
- `src/scenes/BootScene.ts` — all texture generation
- `src/scenes/GameScene.ts` — world, input (WASD + virtual joystick), spawning, purchases; talks to UIScene only via `this.events` (`money`, `state-changed`, `stall-tapped`, `toast`, `celebrate`)
- `src/scenes/UIScene.ts` — HUD, upgrade buttons, stall panel, toasts
- `src/entities/Stall.ts` — cooking, queue, cash pile; `Player`, `Customer`, `Worker`

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
