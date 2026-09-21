# SportsLock AI — Overseer Overhaul Plan
## Self-Improving Prediction Engine
### Approved: September 21, 2026

---

## Admin Decisions (Approved)

1. ✅ **Backfill all 1,307 stuck predictions** — All data is good data
2. ✅ **Auto-apply safe suggestions** with admin approval — only when certain to improve brain
3. ✅ **Use Gemini API for analysis** — no added costs (already have key)
4. ✅ **Admin user approvals remain** as separate tab

---

## The Problem

The brain has solid foundation (~1,011 lines of statistical modeling) but the feedback loop is broken:

```
PREDICT → GRADE → ANALYZE → ADJUST → PREDICT (better)
   ✅        ❌        ❌        ❌         ❌
```

- GRADE broken: 1,307/2,009 predictions stuck PENDING (ESPN only returns today's scores)
- ANALYZE has no tools: Can't filter/slice/drill into data
- ADJUST doesn't work: Accepting suggestions saves status but changes nothing
- No continuous improvement: Nothing scans for better methods

## Phases

### Phase 1: Complete Data Capture
- Historical ESPN scores API (free)
- Backfill all stuck predictions
- Grade ML + Spread + Total automatically
- Zero predictions left ungraded after 24h

### Phase 2: Self-Improvement Feedback Loop
- Wire up existing Brier scoring, layer haircuts, calibration
- Suggestions actually apply changes when accepted
- Post-grade analysis pipeline runs automatically
- Copula correlation updates from empirical data

### Phase 3: Analysis Workbench
- 5 tabs (Dashboard, Analysis Workbench, Engine Controls, Approvals, Activity)
- Smart filters (sport, market, status, date range, edge tier)
- Calibration curve visualization
- Layer-by-layer performance breakdown
- Expandable prediction rows showing all 15 layers

### Phase 4: Continuous Improvement Scanner
- Auto-detect calibration drift
- Layer usefulness auditing
- Edge profitability checks
- Gemini-powered natural language recaps

## Key Open Source References
- Bayesian precision-weighted combination (meta-analysis)
- Platt scaling / isotonic regression (calibration)
- Rolling Brier scores (proper scoring rules)
- Kelly Criterion (bankroll management)
- Copula correlation (parlay math)

---

*Full technical details in the Antigravity conversation artifact.*
