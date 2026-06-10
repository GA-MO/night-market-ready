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

## Phase 1 — Make the loop juicier (next session, ~1 day)

Goal: the moment-to-moment feel. Do these in order.

1. **Customer patience** — patience bar over queued customers (~25s, shrinks; leaves
   angry 💢 if it empties, with a small "lost sale" sting). Accept: queues no longer
   deadlock when a stall has no stock; losing customers is visible and felt.
2. **Money feel** — pile coins should pulse/sparkle when value grows; collected amount
   floats up as `+฿N` text. Accept: collecting cash is the best-feeling action in the game.
3. **Stats for tuning** — track `totalServed`, `totalEarned`, session ฿/min; show in a
   small debug overlay toggled by tapping the title. Accept: you can measure whether a
   balance change helped.
4. **Balance pass** — with patience on, verify a fresh save can unlock Pad Thai in
   ≤4 min of active play and Thai Tea in ≤10. Adjust `config.ts` costs/prices only.

## Phase 2 — Meta layer / hybridcasual (the retention bet, ~2 days)

5. **Stall 4 + 5: Som Tam (฿3,000), Moo Krata (฿8,000)** — requires making the world
   taller than the viewport: switch camera to follow the player
   (`this.cameras.main.startFollow`), extend lane, keep UIScene fixed. This is the
   biggest refactor in the plan — do it before adding the stalls themselves.
6. **Daily streak** — on first open per calendar day: streak counter + escalating bonus
   (฿ scaled to current earning rate, day 7 cap). Store `lastDailyClaim`, `streak` in save.
7. **Menu collection book** 📖 — every N sales of a dish earns a star (max 3);
   each star = permanent +10% price for that stall. Simple modal listing stalls/stars.
   This is the long-tail retention hook.
8. **Prestige (only if 5–7 land well)** — "Move to the Floating Market": reset stalls,
   keep collection book, +25% permanent multiplier per prestige.

## Phase 3 — Monetization scaffolding (before any store talk)

9. **`AdProvider` interface** with a mock implementation (button → 3s fake countdown →
   reward). Placements: 2× earnings for 4h (HUD button), instant-fill grill (button at
   stall), double offline earnings (on the welcome-back toast). Real SDK comes only
   after the game is wrapped; the interface keeps it swappable.
10. **Analytics events interface** — `track(event, props)` logging to console for now:
    session_start, unlock, upgrade, ad_watched, prestige. These define the funnel later.

## Phase 4 — Ship as app

11. **PWA** — mirror block-puzzle's `vite-plugin-pwa` + icon generation (sharp script);
    theme: dark navy `#0b0d22` + lantern gold.
12. **Capacitor wrap** — copy block-puzzle's `capacitor.config.ts` approach.
13. Store assets: the unlock-lighting moment is the 3-second ad clip — design the
    screenshot/video flow around it.

## Explicitly out of scope (don't build without a new decision)

- Real ad SDK integration, IAP, server-side anything, level-based content,
  multiplayer/leaderboards, localization beyond English.

## Known debt / quirks

- `Stall.update` redraws the progress bar every frame (fine at this scale).
- Depth sorting is y-based and approximate; revisit only if visibly wrong after camera work.
- `Worker` class name shadows DOM `Worker` — local import wins; leave as is.
- Dev-server port is 5174 to avoid clashing with block-puzzle's 5173.
