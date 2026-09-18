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

### Unchanged on purpose

- Mix chips stay.
- Phase C ledger write is next, only after go.

## Code — college logos via numeric ESPN ids (evening)

Matchups still printed HUR / DEA / COU circles. Odds API stores 3-letter leftovers. ESPN college art only exists at `/ncaa/500/{numericId}.png`. Letter URLs 404, then the card hides the image.

### Changed

- `src/lib/market/ncaa-ids.ts` plus `-a`/`-b` — ESPN numeric ids for FBS names.
- `src/lib/market/logos.ts` — drop letter-path NCAA urls; resolve by school name; never ask ESPN for `/ncaa/500/hur.png`.
- `src/routes/games.tsx` — Matchups render through `resolveTeamLogo`.
