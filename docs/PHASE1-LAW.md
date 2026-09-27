# Phase 1 production law (2026-09-27)

Supersedes `GROK-2026-09-18-CURRENT.md` §6 item 3 wherever they conflict.

- **Fair blend:** `0.10 sim / 0.10 pool / 0.80 market` in `dynamic-weights.ts`. Market floor ~70%. Circuit breaker reverts to 0.10/0.10/0.80. The 0.50/0.30/0.20 sentence is retired copy — do not re-implement it.
- **De-vig:** `twoWayNoVig` in `engine.ts` is the **power method** (solve k so p_home^k + p_away^k = 1). Not naive proportional. Do not swap methods without a model-version bump.
- **CLV cents:** `evenDistance(bet) - evenDistance(close)` on the American scale. Locked -105 / closed -120 → +15. Not `clvPct / 10`.
- **Copula ρ:** provisional hardcoded values. Sequential pairwise Clayton. Not Gaussian. Not an n-copula. Do not show ρ on a straight.
- **Park pressure:** omitted unless a station feed supplies inHg. Do not invent 29.92.
- **Weight calibration:** win-rate steering is off. `calibrateWeights()` records sample size when n ≥ 50 but does not move `wSim`/`wPool`/`wMarket`. Phase 4 replaces the objective with time-split Brier/CLV.
