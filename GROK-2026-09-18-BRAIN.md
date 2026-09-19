# Brain tape + suggestions — plan (locked 2026-09-18 evening)

Goal: a closed tape of **game markets only**, then human-approved brain suggestions. Not an LLM that edits `engine.ts`. Not Feed props.

## H1 — Market tape (shipped, confirmed 10:35 ET)

1245 snaps / 134 events. Finals off Matchups. Live Status open writes the tape.

## H2 — Grade the tape (shipped)

Pending snaps grade WIN / LOSS / PUSH off StatsAPI / NHL / ESPN web complete scores. Team-name match. `ml` / spread / total. Live games stay pending. Live Status shows W-L-P.

## H3 — Autopsy buckets (shipping now)

After grade, tag each settled snap:

- **model_miss** — LOSS at ≥62% model, or WIN at ≤38%
- **echoed_book** — model within 2.5 pts of implied price
- **high_variance** — model 47–53% or |edge| < 3%
- **settled** — everything else

Template note, no LLM. AI Autopsy page reads `market_tape`, not the old empty `prediction_logs` list. Counts by bucket / sport / market. Does **not** change Engine Bay or `chance.ts`.

## H4 — Suggestion queue (next)

Overseer tab Brain Suggestions. Accept / Reject / Later.

## H5 — Engine reads accepted overrides only

## Out of scope

Feed props, player boards, auto-apply, Odds API `/scores`.
