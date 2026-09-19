# Brain tape + suggestions — plan (locked 2026-09-18 evening)

Goal: a closed tape of **game markets only**, then human-approved brain suggestions. Not an LLM that edits `engine.ts`. Not Feed props.

Suggestions appear in Overseer. DJ Accept / Reject / Later. Accept writes overrides. Engine reads overrides. Nothing auto-applies.

## H1 — Market tape (shipping now)

Table `market_tape`. Writer on `/api/cron/sweep-ledger` (already `:15` and `:45` each hour).

Each snap: event id (Odds API), sport, teams, start, market (ml / spread / total), side, selection, line, price, clipped model chance (1–99%), edge, phase, score, period/clock.

Phases:

- **pregame** — at most once per 6 hours per event+market+side
- **live** — while `inPlay`, at most once per 20 minutes
- **final** — once when the overlay has a score and the game is no longer live

No props. No full desk dump. Compact JSON only.

Live Status shows tape counts.

## H2 — Grade the tape

Settle final snaps off StatsAPI / NHL / ESPN **web** host. Understand `oddsapi-…` ids and `ml` vs moneyline. WIN / LOSS / PUSH + official score. Do not use `site.api.espn.com`.

## H3 — Autopsy buckets

Wins and losses. Count-based buckets (variance, echoed the book, wrong-way vs close, sport/market miss). Optional 2-sentence note. Not the learning step.

## H4 — Suggestion queue

Overseer tab **Brain Suggestions**. One proposed knob per row. Accept / Reject / Later. Reject is remembered.

## H5 — Engine reads accepted overrides only

Scan/ribbon honor `brain_overrides` after DJ locks a suggestion.

## Out of scope until later

Feed props, player boards, auto-apply, rewriting source from one loss, extra Odds API `/scores`.
