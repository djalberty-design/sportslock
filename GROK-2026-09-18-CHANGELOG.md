# Grok changelog — 2026-09-18

Session with DJ Alberty.

## Code — guest desk (same day, after archive)

Login is optional so the public desk can be audited on production. Admin rights stay on the signed-in creator email.

### Changed

- `src/components/app/access-gate.tsx` — unsigned visitors get the overhaul desk. No redirect to `/login`. No Access Pending wall. Session spinner only.
- `src/lib/auth/gates.tsx` — signed-out control is **Sign in** → `/login` (was **Owner** → `/admin/terminal`).
- `src/routes/login.tsx` — copy says the desk is open without an account.

### Unchanged on purpose

- `/admin` still checks `isAdmin`.
- Fetch Props / quota badge still `isAdmin` on `/games`.
- Email/password and Google button still on `/login`.
- `getBoardSnapshot` was already unauthenticated.

### Docs

- `GROK-2026-09-18-CURRENT.md` §1, §3, §4, §9 updated for guest desk.

## Code — Phase A honest prices (evening)

Default wager is $10. Ticket and Feed no longer invent +100 / 98% / hash projections.

### Added

- `src/lib/market/book-price.ts` — book American, implied chance, slip parlay price, $10 default.
- `GROK-2026-09-18-PLAN.md` — full phased plan.

### Changed

- `src/components/app/game-page.tsx` — book prices on rows; chance band; straight vs multi-leg from selected legs only; lock modal rejects extreme Americans; wager defaults to $10.
- `src/components/app/sportslock-parlay-card.tsx` — HIT PROB uses calibrated `chance`; $10 default; payout follows American; removed 50+i*5 fake leg math.
- `src/routes/games.tsx` — matchup bar uses scan chance or book implied, not `50 + hash % 25`.

### Not in this push

- Daily Odds API / ESPN crons (Phase D).
- My Action ledger wiring (Phase C).
- Feed mix filters (Phase B).
- Live scores (Phase E).
