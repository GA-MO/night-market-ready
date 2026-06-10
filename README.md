# Night Market Ready! 🏮

Idle-arcade prototype — run a Thai night market: grill skewers, serve the queue,
scoop up the cash, hire helpers, and light the whole market up stall by stall.

Built with Phaser 3 + TypeScript + Vite. All art is generated procedurally and
all sound is synthesized with WebAudio — zero binary assets.

## Run

```bash
npm install
npm run dev        # http://localhost:5174
```

Desktop: arrow keys / WASD. Mobile: drag anywhere to move (virtual joystick).

## Core loop

1. Stand at the **grill** 🔥 — cooked food jumps into your stack (carry limit applies)
2. Stand at the **counter** 🛎 — food is stocked, queued customers buy it
3. Walk over the **cash pile** 💰 — collect the money
4. Spend on upgrades: carry capacity, move speed, cook speed per stall
5. **Hire helpers** 🧑‍🍳 to automate grill→counter — the idle layer; they keep
   earning (at reduced rate, capped at 4h) while the game is closed
6. Unlock Pad Thai (฿300) and Thai Tea (฿1,000) — each unlock lights up the market

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | dev server on port 5174 |
| `npm run build` | typecheck + production build to `dist/` |
| `npm test` | unit tests (economy balance + save migration) |
| `npm run typecheck` | `tsc --noEmit` |

## Architecture

- `src/config.ts` — stall definitions and tuning constants
- `src/economy.ts` — pure balance math (costs, cook times, offline earnings) — unit tested
- `src/save.ts` — localStorage persistence with forward-compatible merge — unit tested
- `src/audio.ts` — tiny WebAudio synth (no audio files)
- `src/scenes/BootScene.ts` — generates every texture from Phaser Graphics
- `src/scenes/GameScene.ts` — world, input (keyboard + virtual joystick), customer spawning
- `src/scenes/UIScene.ts` — HUD, upgrade buttons, stall panel, toasts, celebration
- `src/entities/` — `Player`, `Stall` (cooking/queue/cash pile), `Customer`, `Worker`

`window.__game` exposes the Phaser instance for debugging/automated playtests.
