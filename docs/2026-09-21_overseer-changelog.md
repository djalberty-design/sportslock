# SportsLock AI — Overseer Overhaul Changelog
## September 21, 2026

### Commit (Phase 2b) — Reliability Table Self-Correction

**The brain now corrects its own probability estimates based on actual results.**

- `post-grade-analysis.ts` now runs `updateReliabilityFromTape()` after every grading sweep
- Pulls last 500 graded predictions, builds a reliability table mapping predicted probability → actual hit rate per bucket
- Sets the active reliability table so `calibratedChance()` (used by ALL future predictions) uses empirical data instead of just model estimates
- Example: If the model predicts 70% but those picks only hit 62%, future 70% predictions get adjusted to ~62% (more honest probabilities)
- This is the Platt scaling / isotonic regression concept from the plan — implemented using the existing `calibrate.ts` infrastructure that was already built but NEVER FED with real data

---

### Commit `4d70b24` — Fix: Admin Props Button Now Visible

**ROOT CAUSE:** `game-page.tsx` used `selectIsAdmin` from desk-store which checks `adminEmail` field. `setAdminEmail` was NEVER CALLED anywhere in the app, so `adminEmail` was always `""`, so `isAdmin` was always `false`. The button code was deployed but invisible.

**FIX:** Switched to `useAccess()` hook which checks the server-side role via the access API. Same hook used by all other admin-gated UI (Overseer, shell nav, etc.).

The "Pull Props (1 Req)" button at top of game tickets now shows for `djalberty@gmail.com`.

---

**The closed feedback loop is now wired end-to-end.**

Every cron sweep now runs 6 steps: Ledger → Tape → Grade → Autopsy → Suggestions → **Analysis (NEW)**

**New Files:**
- `src/lib/market/post-grade-analysis.ts` — Self-improvement analysis pipeline:
  - **Segmented Brier Scores:** Computes prediction accuracy for each (sport × market) segment separately. NFL Moneyline accuracy vs NCAAF Spread accuracy vs NBA Total accuracy — see where the model excels and where it struggles.
  - **Calibration Drift Detection:** Compares recent 50 predictions' Brier to overall. If recent is worse by >0.02 → model is "drifting" and needs recalibration.
  - **Edge Profitability:** For each edge tier (High ≥5%, Low 2-5%, Micro <2%), computes actual win rate. 52.4% = break even at -110. If high-edge picks don't beat break-even → model is overconfident.
  - Stores all results in `brain_analysis_log` table for Dashboard to read.

**Modified Files:**
- `src/routes/api/cron/sweep-ledger.ts` — Added `runPostGradeAnalysis()` as step 6 of the cron pipeline
- `src/lib/market/server.ts` — Added `getLatestAnalysisFn` (read latest analysis) and `runAnalysisFn` (trigger manual analysis)
- `src/routes/admin/dashboard.tsx` — New "Self-Improvement Loop" section showing:
  - Calibration Drift indicator (Improving 📈 / Stable ➡️ / Drifting 📉)
  - Edge Profitability by tier with win rates
  - Best/worst segments (is the model beating the book in each sport × market?)
  - "Run Analysis Now" button for on-demand analysis

---

### Commit `1d506c3` — Phase 1: Self-Improving Brain - Historical Grading + Analysis Backend

**CRITICAL FIX: 1,307 stuck PENDING predictions**

The grading system (`gradeMarketTape`) only checked ESPN live scores, which return today's games only. Once a game day passed, predictions could never be graded — stuck PENDING forever.

**New Files:**
- `src/lib/market/historical-scores.ts` — Fetches ESPN final scores for ANY past date (free, no API key, no rate limit). Supports NFL, NCAAF, NBA, NCAAB (ESPN), MLB (mlb API), NHL. Caches results 24h.

**Modified Files:**
- `src/lib/market/grade-tape.ts` — Complete rewrite. 3-step grading pipeline:
  1. Grade with today's live ESPN scores (existing behavior)
  2. Grade with historical scores for past dates (NEW)
  3. Mark predictions >14 days old as EXPIRED (NEW)
  - Returns detailed stats: `{ graded, historical, expired }`
  - Grades ML, spread, AND total (all three supported)

- `src/lib/market/server.ts` — 3 new server functions:
  - `batchGradeFn` — Admin triggers manual batch grade of all pending
  - `applySuggestionFn` — Brain suggestions now ACTUALLY apply changes when accepted (chance haircuts, min edge, kelly adjustments). Previously, Accept just saved a status flag and did nothing.
  - `getAnalysisDataFn` — Full analysis workbench data with smart filters (sport, market, status, date range, edge tier), Brier score, calibration buckets, breakdowns by sport/market, paginated prediction rows

**Saved:**
- `docs/2026-09-21_overseer-overhaul-plan.md` — Approved implementation plan

---

### Commit `5f7fb45` — Overseer v2: Dashboard, Analysis Workbench, Engine Controls

**Tab consolidation: 9 confusing tabs → 5 clear tabs**

Old tabs (Live Status, Predictions, AI Autopsy, Suggestions, Brain Intel, Engine Bay, Overrides, Approvals, Activity) → moved to collapsible "Legacy views" section. Still accessible, not deleted.

**New Files:**

#### `src/routes/admin/dashboard.tsx` — 🧠 Dashboard
- Brain health at a glance
- Pending prediction alert with "Grade Now" button (triggers historical backfill)
- Win rate accuracy gauge (50% = random, 52.4% = break even, 55%+ = strong)
- System health indicators (Historical Grading, Live Scores, Odds API, Calibration, Suggestions)
- Tab guide explaining what each Overseer section does
- Every stat has a hover tooltip with explanation

#### `src/routes/admin/analysis.tsx` — 📊 Analysis Workbench
- **Smart Filters Bar:** Sport (NFL/NCAAF/MLB/NBA/NHL), Market (ML/Spread/Total), Status (Won/Lost/Push/Pending/Expired), Date Range, Edge Tier (High ≥5% / Low 2-5% / Micro <2%)
- **Performance Summary:** Total, Won, Lost, Push, Pending, Expired, Win Rate %, Brier Score
- **Calibration Curve:** Predicted probability vs actual hit rate per 10% bucket. Perfect = diagonal. Green = well-calibrated, Red = overconfident, Blue = underconfident
- **Breakdowns:** Win rate by sport and by market type with visual bars
- **Prediction Table:** Every prediction matching filters. Columns: Selection, Matchup, Market, Model %, Edge, Status (color-coded badges), Score, Date. Expandable rows. Paginated (50/page)
- **Grade All Pending** button at top

#### `src/routes/admin/engine.tsx` — ⚙️ Engine Controls
- **Engine Settings:** Kelly %, Max Parlay Legs, Min Edge % — each with full plain-English description
- **Active Suggestions:** Brain suggestions with "Accept & Apply" / "Reject" / "Later"
  - Accept now ACTUALLY applies the proposed change to the engine
  - Plain English explanations: "Mostly echoing the book" = model agrees with sportsbook, no edge. "Model too confident" = predicted win chance higher than actual win rate
  - Preview panel shows what will change before applying
- **Applied Adjustments:** Audit trail of every accepted suggestion with timestamp and what changed
- **Manual Overrides:** List of event-specific chance adjustments
- **How The Brain Works:** Full explanation of all 15 prediction engine layers with weight classes:
  - HIGH: Market Odds
  - MEDIUM: Opening Line, CLV, ESPN Power Index, Pythagorean Win%, Injuries
  - LOW: Kalshi, Polymarket, Form/Streaks, Home Field, Weather, Rest, Officials, Splits, H2H

**Modified Files:**
- `src/routes/admin.tsx` — New tab navigation. 5 primary tabs (Dashboard, Analysis, Engine, Approvals, Activity). Old 7 tabs under collapsible "Legacy views". Updated subtitle: "Self-improving prediction engine — every prediction tracked, graded, analyzed, and used to get smarter."

---

### What's Still Pending

- [ ] Post-grade analysis pipeline wired into cron (auto-run Brier segments, layer audits after every grading sweep)
- [ ] `pendingLayerHaircuts()` integration (exists in `ledger-law.ts` but never called in production)
- [ ] Copula calibration from empirical parlay data
- [ ] Calibration drift detection
- [ ] Edge profitability checks
- [ ] Gemini-powered natural language analysis summaries
- [ ] Admin props button fix (selectIsAdmin never set from auth flow)
- [ ] Client-side useAutoGrade improvements for My Action tickets
