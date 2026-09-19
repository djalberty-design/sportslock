# Brain tape + suggestions — plan (locked 2026-09-18 evening)

Goal: closed tape of game markets, then human-approved suggestions. No LLM edit of `engine.ts`. No Feed props.

## H1 — Market tape (shipped, confirmed 10:35 ET)

1245 snaps / 134 events. Finals off Matchups. Live Status open writes the tape.

## H2 — Grade the tape (shipped)

WIN / LOSS / PUSH off StatsAPI / NHL / ESPN web. Team-name match. Live stays pending.

## H3 — Autopsy buckets (shipped)

model_miss / echoed_book / high_variance / settled. Autopsy page reads `market_tape`.

## H4 — Suggestion queue (shipping now)

New Overseer tab **Suggestions**. Built from graded counts.

- Slice needs 8+ decided snaps (WIN+LOSS) to propose a sport/market note
- Below that: one honest card, sample too small, do not move Kelly / EV floor
- Accept / Reject / Later write `brain_suggestions` only
- Rejected fingerprints stay quiet 14 days; Later 2 days
- **Does not change the engine**

## H5 — Engine reads accepted overrides (next)

Only after an Accept. Haircuts / sit flags / tuning writes wait for that slice.

## Out of scope

Feed props, player boards, auto-apply, Odds API `/scores`.
