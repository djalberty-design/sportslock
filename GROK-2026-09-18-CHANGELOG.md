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

Phase B is closed once those college marks paint after deploy.

## Code — Phase C Lock It In → My Action (evening)

Lock writes the device book and `prediction_logs`. The open-ticket chip counts opens. `/desk` sends you to `/ticket`. Empty `/ticket` is the personal book.

## Code — Phase C Feed Save actually writes (evening)

### Changed

- `src/components/app/sportslock-parlay-card.tsx` — $10 default; Save uses `paperFromLock` + `writePredictionLegs`; success link to `/ticket`.
- `src/components/app/game-page.tsx` — Lock It In writes `paperTickets` and `prediction_logs`.
- `src/lib/desk-store.ts` — `fastLog` records the ticket without requiring Start cash or debiting bankroll.

## Code — Phase D morning pull (evening)

### Changed

- `src/lib/market/odds-api.ts` — `CACHE_TTL` 12h → 26h. `writeOddsApiCache` exported. `getActiveSports` exported.
- `src/lib/market/morning-pull.ts` — `fetchOddsApiMains(true)` once, then one ESPN scoreboard GET per sport. Writes stamp key `morning-pull`.
- `src/routes/api/cron/morning-pull.ts` — GET/POST handler.
- `vercel.json` — `/api/cron/morning-pull` at `5 10 * * *` UTC (6:05 AM ET). Grade stays on `0 10`.

## Code — Phase E live scores (evening)

Odds API quotes hard-coded `inPlay: false` and never carried a score. Matchups already paints LIVE + score when those fields are set.

### Changed

- `src/lib/market/live-scores.ts` — MLB StatsAPI schedule + NHL `score/now`. ESPN scoreboard for NFL / NBA / NCAAF / NCAAB only if `odds_api_cache.morning-pull` marked that sport `ok`. 2-minute L1/L2 cache (`live-scores` key).
- `src/lib/market/odds-api.ts` — `readOddsApiCache` exported.
- `src/lib/market/with-live-scores.ts` — overlay helper.
- `src/lib/market/board-snapshot.ts` — board query uses the overlay.
- `src/lib/market/use-board.ts` — `getLiveBoardSnapshot` instead of raw `getBoardSnapshot`.
- `src/routes/api/cron/sweep.ts` — sweep reads the same overlay.

### Unchanged on purpose

- No Odds API `/scores`.
- No ESPN fetch when the morning probe is missing or 403.
- Official NBA CDN returned 403; NBA/NFL/college wait on ESPN-if-up.
- Feed player props stay off.
