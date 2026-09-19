# Brain tape + suggestions — plan (locked 2026-09-18 evening)

Goal: a closed tape of **game markets only**, then human-approved brain suggestions. Not an LLM that edits `engine.ts`. Not Feed props.

Suggestions appear in Overseer. DJ Accept / Reject / Later. Accept writes overrides. Engine reads overrides. Nothing auto-applies.

## H1 — Market tape (shipped, confirmed 2026-09-18 10:35 ET)

Table `market_tape`. Writer on `/api/cron/sweep-ledger` and on Live Status open (`getTapeStats(true)`), because Hobby UTC crons were not writing.

DJ confirmed: **1245 snaps / 134 events**, Live Status LIVE, finished games gone from Matchups (129 events tracked).

Each snap: Odds API event id, sport, teams, start, ml / spread / total, side, selection, line, price, clipped model chance (1–99%), edge, phase, score, period/clock.

Phases: pregame (6h cap), live (20 min cap), final (once).

No props. Compact JSON only.

## H2 — Grade the tape (shipping now)

Settle pending `market_tape` rows against complete scores from MLB StatsAPI / NHL web / ESPN **web** host (same `fetchLiveScores` overlay). Match on sport + team names, not `espn-…` ids.

- `ml` / `moneyline` — home/away side or team name
- `spread` — side + line vs final margin
- `total` — over/under + line vs final sum
- Writes `WIN` / `LOSS` / `PUSH`, official home/away score, `graded_at`
- Does not use `site.api.espn.com`
- Does not grade props
- Live Status tape line includes W-L-P after open

Live games stay PENDING until Final.

## H3 — Autopsy buckets (next)

Wins and losses. Count-based buckets. Optional 2-sentence note. Not the learning step.

## H4 — Suggestion queue

Overseer tab **Brain Suggestions**. Accept / Reject / Later.

## H5 — Engine reads accepted overrides only

## Out of scope until later

Feed props, player boards, auto-apply, rewriting source from one loss, extra Odds API `/scores`.
