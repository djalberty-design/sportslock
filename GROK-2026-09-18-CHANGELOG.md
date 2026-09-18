# Grok changelog — 2026-09-18

Session with DJ Alberty.

## Code — guest desk (same day, after archive)

Login is optional so the public desk can be audited on production. Admin rights stay on the signed-in creator email.

### Changed

- `src/components/app/access-gate.tsx` — unsigned visitors get the overhaul desk. No redirect to `/login`. No Access Pending wall. Session spinner only.
- `src/lib/auth/gates.tsx` — signed-out control is **Sign in** → `/login` (was **Owner** → `/admin/terminal`).
- `src/routes/login.tsx` — copy says the desk is open without an account.

## Code — Phase A honest prices (evening)

Default wager is $10. Ticket and Feed no longer invent +100 / 98% / hash projections.

## Code — Phase B Feed filters and logos (evening)

SOON chips follow the snapshot board. Mix chips let a guest keep or hide cross-sport ribbons.

## Code — AI Feed names and marks (same evening)

DJ's screenshot still printed `AST @ RAY` and `BIS @ HOR` with empty circles. Short codes and last-word leftovers were winning over official names.

### Changed

- `src/lib/market/logos.ts` — expand nicknames (`Astros`, `Rays`, `HOR`) to official names; NCAA numeric IDs for Sac State / NDSU and a few others; match snapshot quotes by team name when event ids differ.
- `src/components/app/sportslock-parlay-card.tsx` — header and each leg show both team marks plus **Away at Home** full names.

## Code — college logos via numeric ESPN ids (evening)

Matchups still printed HUR / DEA / COU circles. Odds API stores 3-letter leftovers. ESPN college art only exists at `/ncaa/500/{numericId}.png`. Letter URLs 404, then the card hides the image.

### Changed

- `src/lib/market/ncaa-ids.ts` plus `-a`/`-b` — ESPN numeric ids for FBS names.
- `src/lib/market/logos.ts` — drop letter-path NCAA urls; resolve by school name; never ask ESPN for `/ncaa/500/hur.png`.
- `src/routes/games.tsx` — Matchups render through `resolveTeamLogo`.

### How the logo bug was resolved

MLB marks loaded because ESPN serves `/mlb/500/{HOU|TB}.png`. College marks did not.

What the board actually stored:

- Odds API / cache often kept 3-letter leftovers (`HOR`, `BIS`, `HUR`, `DEA`) or nicknames (`Astros`, `Rays`) instead of official school names.
- Feed legs sometimes omitted `sport`, so the NCAA path was skipped and a letter filename was built instead.
- ESPN's college CDN 404s on `/ncaa/500/hor.png`. The card's `onError` then hid the `<img>`, leaving the letter circle.

What we did:

1. Nickname / alias map (`HOR` → Sacramento State, `BIS` / `Bison` → North Dakota State, `Astros` → Houston Astros, etc.).
2. `ncaaIdFor` walks the official name even when the sport tag is missing.
3. Numeric ESPN ids (NDSU `2449`, Sac State `16`, plus the FBS catalog in `ncaa-ids.ts`). Public CFB logo references — ESPN scoreboard scrape is 403.
4. `resolveTeamLogo` throws away any `/ncaa/500/[letters].png` URL so a bad cache logo cannot short-circuit the numeric lookup.
5. `matchSnapshotEvent` fuzzy-matches by team name when event ids on the ribbon and the snapshot disagree.
6. Matchups (`games.tsx`) stopped preferring `g.homeLogo` first and went through the same helper.

Obstacles along the way:

- First `logos.ts` push landed as a placeholder (empty helpers). Cards had no resolver at all until the real file shipped.
- NDSU was first mapped to the wrong ESPN id; bison art 404ed until it was set to `2449`.
- Vercel lagged a commit behind GitHub, so a hard refresh still showed letters after the fix was on `main`.
- Feed cards were already on the helper; Matchups were not. That is why MLB parlays looked fine while the college Matchups row stayed HUR / DEA.

Phase B is closed once those college marks paint after deploy.

## Code — Phase C Lock It In → My Action (evening)

Lock writes the device book and `prediction_logs`. The open-ticket chip counts opens. `/desk` sends you to `/ticket`. Empty `/ticket` is the personal book.

### Changed

- `src/routes/ticket.tsx` — no `id` → `DeskPage` (My Action). `id` still opens the breakdown.
- `src/routes/desk.tsx` — added so the generated `/desk` route exists; it navigates to `/ticket`.
- `src/components/app/ticket-lock.tsx` — chip goes to `/ticket`.
- `src/routes/index.tsx` — dropped `onTail` alert stub.
- `src/lib/market/lock-action.ts` — shared research lock helper.

## Code — Phase C Feed Save actually writes (evening)

Changelog last pass claimed the Feed modal wrote the book. The card on `main` still called empty `onTail` and closed.

### Changed

- `src/components/app/sportslock-parlay-card.tsx` — $10 default; Save uses `paperFromLock` + `writePredictionLegs`; success link to `/ticket`.
- `src/components/app/game-page.tsx` — Lock It In writes `paperTickets` and `prediction_logs`.
- `src/lib/desk-store.ts` — `fastLog` records the ticket without requiring Start cash or debiting bankroll.

### Unchanged on purpose

- Site still never places a bet.

## Code — Phase D morning pull (evening)

Last session described this as shipped. `main` still had a 12h TTL, no morning-pull route, and no cron row. This pass lands it.

### Changed

- `src/lib/market/odds-api.ts` — `CACHE_TTL` 12h → 26h. `writeOddsApiCache` exported. `getActiveSports` exported.
- `src/lib/market/morning-pull.ts` — `fetchOddsApiMains(true)` once, then one ESPN scoreboard GET per sport. Writes stamp key `morning-pull`.
- `src/routes/api/cron/morning-pull.ts` — GET/POST handler.
- `vercel.json` — `/api/cron/morning-pull` at `5 10 * * *` UTC (6:05 AM ET). Grade stays on `0 10`.

### Unchanged on purpose

- Feed player props stay off.
- No Odds API `/scores`.
- No ESPN retry loop or player-prop scrape. 403 is Looked.
- Admin Fetch Props on Matchups stays.
