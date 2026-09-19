# Phase 5 Changelog — Claude Opus 4 (Antigravity) Sept 19, 2026

## f11b55a — Fix 1+2: Single bet bug + wrong odds
- `game-page.tsx`: toggleLeg enforces same-market mutual exclusivity
- `game-page.tsx`: normalizePrice() helper, single bets use direct price

## f76c478 — Fix 4: 50/50 brain prediction tracking
- `market-tape.ts`: Added `recommended` column, marks best-edge side per market
- `grade-tape.ts`: Stats filter by recommended=true
- `autopsy-tape.ts`: Autopsy queries filter by recommended=true  
- `suggestions.ts`: Suggestion queries filter by recommended=true
- `sweep.ts`: Only logs recommended side to prediction_logs

## c9e343f — Fix 3: AI Picks value ranking
- `feed-mix.ts`: feedValueFilter blocks -500+ favorites and <35% coin-flips
- `feed-mix.ts`: Gold picks by best value, catalog capped at top 10
- `index.tsx`: Updated feed and gold ticket descriptions

## 35a6916 — Fix 5: Suggestions engine overhaul
- `suggestions.ts`: Sport-specific bias detection, edge calibration, auto-apply
- `suggestions.tsx`: Auto-applied section with Revoke button
- `tape-server.ts`: Revoke handler clears overrides

## 8e9d188 — Fix 6: Brain self-improvement system
- NEW `brain-learn.ts`: Nightly cron for Brier scores, sharpness, auto-tune
- `brain-intel.tsx`: Brain Learning Insights dashboard section
- `server.ts`: getBrainInsightsFn endpoint
- `vercel.json`: brain-learn cron at 6 UTC daily
