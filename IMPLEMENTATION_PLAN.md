# SportsLock Comprehensive Recovery & Enhancement Plan

> Based on deep audit of 3 research agents scanning every file, all your saved docs (`THE_BRAIN_BIBLE.md`, `ROADMAP.md`, `BIBLE.md`, `SPORTS_LOCK_ALGORITHM.md`, `SPORTS_LOCK_BLUEPRINT.md`), and 2 prior Antigravity sessions.

---

## Phase 0 — CRITICAL BUG: Picks Pipeline Crash (TDZ)

> [!CAUTION]
> **This bug silently crashes the ENTIRE AI picks pipeline**, which is why the SportsLock AI Feed, The Lab, and Gold Ribbon Parlays show nothing.

#### Root Cause
In [picks.ts](file:///C:/Users/alber/Documents/sports-lock_G/src/lib/market/picks.ts#L1121):
- **Line 1121** uses `finalPropRows` → but it's not declared until **Line 1143**
- JavaScript throws `ReferenceError: Cannot access 'finalPropRows' before initialization`
- This crashes `buildDeskPicks()`, so `picks` is always `null` → AI Feed shows "No Gold Ribbon Parlays"

#### Fix
Move the `finalPropRows` declaration (lines 1142-1146) to **before** line 1121.

#### Also Fix: `index.tsx` reads `picks?.sgp` but Gold Ribbons live in `picks?.ribbon`
The SportsLock AI Feed page displays `picks?.sgp` (Same-Game Parlays), but per your algorithm spec, Gold Ribbon Parlays are in `picks?.ribbon`. Will fix to show `ribbon` first, then `sgp` below.

---

## Phase 1 — Team Logos: Fix Broken Images

> [!IMPORTANT]
> Logos show as broken image icons because `quotesFromOddsApi()` generates bad abbreviations like "LIO" (from "Detroit Lions") instead of "DET" that ESPN's CDN expects.

#### Changes

##### [MODIFY] [logos.ts](file:///C:/Users/alber/Documents/sports-lock_G/src/lib/market/logos.ts)
Add a **full team-name → ESPN abbreviation mapping** (~120 teams across NFL/MLB/NBA/NHL/NCAAF/NCAAB). Example: `"Detroit Lions" → "det"`, `"Buffalo Bills" → "buf"`. Export a `teamAbbr(fullName: string, sport: string)` helper.

##### [MODIFY] [live-board.ts](file:///C:/Users/alber/Documents/sports-lock_G/src/lib/market/live-board.ts#L1000)
Replace the naive `g.home_team.split(" ").pop()?.substring(0,3)` with the new `teamAbbr()` lookup. This fixes both the logo URLs and the abbreviation display.

##### [NEW] Shared `<TeamLogo>` component
Extract the `TeamMark` pattern from [hard-rock-sheet.tsx](file:///C:/Users/alber/Documents/sports-lock_G/src/components/app/hard-rock-sheet.tsx#L819-L845) into a reusable component with:
- `onError` fallback → styled initials circle (already working in Hard Rock sheet)
- Use it in `games.tsx`, `picks.tsx`, `board-page.tsx`, `game-page.tsx`, `sportslock-parlay-card.tsx`

---

## Phase 2 — Sport Filters on ALL Pages

The `SportFilter` component already exists in [sport-filter.tsx](file:///C:/Users/alber/Documents/sports-lock_G/src/components/app/sport-filter.tsx) and works on the legacy board. It just needs to be added to 3 pages:

#### Changes

| Page | File | What to Add |
|------|------|-------------|
| **Matchups** | [games.tsx](file:///C:/Users/alber/Documents/sports-lock_G/src/routes/games.tsx) | Import `SportFilter` + `applySportFilter`, filter games list |
| **The Lab** | [picks.tsx](file:///C:/Users/alber/Documents/sports-lock_G/src/routes/picks.tsx) | Import `SportFilter`, filter props by sport |
| **AI Feed** | [index.tsx](file:///C:/Users/alber/Documents/sports-lock_G/src/routes/index.tsx) | Import `SportFilter`, filter parlays by sport |

Sports shown: **ALL · NFL · MLB · NHL · NBA · CFB · CBB** (mapping NCAAF→CFB, NCAAB→CBB in display labels).

---

## Phase 3 — Disable Player Props on AI Picks (Per Your Request)

#### Changes

##### [MODIFY] [picks.ts](file:///C:/Users/alber/Documents/sports-lock_G/src/lib/market/picks.ts)
- Set `props: []` in `buildDeskPicks` return (skip the `rankRows(finalPropRows...)` call)
- Keep `allProps` populated for The Lab's manual use later
- Add a `PROPS_ENABLED = false` flag so you can re-enable easily

##### [MODIFY] [index.tsx](file:///C:/Users/alber/Documents/sports-lock_G/src/routes/index.tsx)
- Remove any prop-card rendering from the AI Feed
- Show Gold Ribbon parlays (`picks?.ribbon`) as primary, SGP catalog below

---

## Phase 4 — Manual "Fetch Props" Button on Matchups

Per your 3-Layer Architecture spec from your previous session: Admin can press a button to pull real player props for a specific game (costs 1 API request).

#### Current State
This **already works** in [game-page.tsx](file:///C:/Users/alber/Documents/sports-lock_G/src/components/app/game-page.tsx#L131-L138) — the `"Fetch Real Props (1 Req)"` button exists and is admin-only.

#### Enhancement
- Add a small **⚡ Fetch Props** button directly on each game card in `/games` (Matchups page), visible only to admin
- Show the current Odds API quota (`x / 500 remaining`) in the Matchups header so you know your budget

---

## Phase 5 — Admin Dashboard Expansion

Your admin currently has 2 tabs (Engine Bay + Telemetry). Both are partially mock. Here's the full buildout:

#### [MODIFY] [admin.tsx](file:///C:/Users/alber/Documents/sports-lock_G/src/routes/admin.tsx)
Add new tabs to the admin nav:

| Tab | Route | Purpose |
|-----|-------|---------|
| **Engine Bay** | `/admin/brain` | Algorithm tuning sliders (exists, needs save-to-DB) |
| **Telemetry** | `/admin/terminal` | Live brain connections status (needs real data) |
| **Prediction Log** | `/admin/predictions` | NEW — View all logged predictions with W/L/P grading |
| **AI Autopsy** | `/admin/autopsy` | NEW — Review why predictions were wrong |
| **Quota & Health** | `/admin/health` | NEW — API quota, feed status, connection health |

#### [NEW] `/admin/predictions` — Prediction Results Tracker
- Query `prediction_logs` table via existing `getPredictionLogs` server function
- Display: Event, Selection, Model Prob, Edge, Status (WON/LOST/PUSH/PENDING), Actual Result
- Color-coded rows: green=won, red=lost, yellow=pending
- Summary stats at top: Win Rate, ROI, Avg Edge on Winners vs Losers

#### [NEW] `/admin/autopsy` — AI Autopsy Review
- Show predictions where `status = 'LOST'` and `ai_autopsy IS NOT NULL`
- Display the AI's analysis of why the model was wrong
- This uses the existing `autopsy.ts` cron that already writes to `ai_autopsy`

#### [MODIFY] `/admin/terminal` — Make It Real
Replace the hardcoded mock log with **live brain status**:
- Real-time connection indicators for each data source:
  - ✅ The Odds API (last fetch time, quota remaining)
  - ✅/❌ ESPN (disabled per your request)
  - ✅/❌ Kalshi (last fetch, contract count)
  - ✅/❌ Polymarket (last fetch, contract count)
  - ✅/❌ Action Network tape (last fetch)
  - ✅/❌ Postgres DB (connection status)
- Show the last `buildLiveSnapshot()` execution time and result summary

#### [MODIFY] `/admin/brain` — Wire "Lock in Settings"
- Save Kelly/MaxLegs/MinEdge to a `brain_config` DB table (new migration)
- Load on page mount, persist on "Lock in Settings" click
- Engine reads these values instead of hardcoded defaults

---

## Phase 6 — Ticket Click-Through Flow

#### Current State
- Clicking a game card on Matchups does **nothing** (no onClick)
- Only the small "Open Game Ticket →" footer link works
- The game detail page (`/game/$eventId`) has the full SGP builder with leg toggling

#### Enhancement

##### [MODIFY] [games.tsx](file:///C:/Users/alber/Documents/sports-lock_G/src/routes/games.tsx)
- Make the **entire game card clickable** → navigates to `/game/$eventId`
- Make individual odds buttons (Spread, Total, Winner) clickable → navigate to game page with that market pre-selected

##### [MODIFY] [game-page.tsx](file:///C:/Users/alber/Documents/sports-lock_G/src/components/app/game-page.tsx)
- Show simulation info panel when a leg is selected (Monte Carlo script classification, probability bar, edge delta)
- "Lock It In" → actually persist to `prediction_logs` via `logPrediction()` (partially wired, needs completion)
- Show final Hard Rock line adjustment input (user enters the line they see on Hard Rock's app)

##### Parlay Legs
- Each leg in a parlay shows the same simulation detail (prob, edge, correlation type)
- Tapping a leg expands it with the Gaussian bell curve from `sportslock-parlay-card.tsx`

---

## Phase 7 — Prediction Logging & Self-Reflection

#### Current State (Already Built!)
Your cron system is actually well-architected:
1. **`sweep.ts`** — Logs daily model plays to `prediction_logs`
2. **`grade.ts`** — Resolves outcomes (WON/LOST/PUSH) after games finish
3. **`autopsy.ts`** — Sends lost predictions to LLM for analysis, writes `ai_autopsy`

#### What's Missing
- **No UI surfaces these results** — the data exists in Postgres but nothing displays it
- Phase 5's new admin tabs will fix this
- Need to verify the cron routes are actually being called (Vercel cron config)

#### [MODIFY] Verify cron configuration
Check `vercel.json` for cron schedule entries pointing to `/api/cron/sweep`, `/api/cron/grade`, `/api/cron/autopsy`. If missing, add them.

---

## Phase 8 — Brain Algorithm Audit

Based on the deep audit of `chance.ts` (1011 lines), `engine.ts` (1095 lines), `live-board.ts` (1075 lines), `research.ts` (1416 lines), and your saved specs:

### Issues Found

| File | Issue | Severity |
|------|-------|----------|
| `picks.ts:1121` | **TDZ crash** — `finalPropRows` used before declaration | 🔴 Critical |
| `chance.ts` | Hardcoded `marginSigma` / `homeFieldLogit` per sport — brittle if scoring environments change | 🟡 Medium |
| `live-board.ts:1000` | Bad team abbreviation generation for logos | 🟡 Medium |
| `engine.ts` | `scoreQuotes` filters work correctly; `twoWayNoVig` devig math is solid | ✅ Good |
| `form.ts` | EWMA λ=0.82, `formTrend` rising/falling/flat — matches your spec | ✅ Good |
| `looks.ts` | xG/EPA/KenPom underlying stats integration working | ✅ Good |
| `sim.ts` | Box-Muller Monte Carlo + Abramowitz-Stegun CDF for production — matches BIBLE.md | ✅ Good |
| `copula.ts` | Clayton Archimedean Copula for SGP tail dependence — matches your spec | ✅ Good |

### Verification Plan
- Fix the TDZ crash → verify `buildDeskPicks` returns populated `ribbon`, `props`, `sgp`
- Confirm devig math matches `SPORTS_LOCK_ALGORITHM.md` formulas
- Verify `buildChance` layer weights match your spec (0.5 sim / 0.3 pool / 0.2 market)
- Run the app and confirm AI Feed populates with real Gold Ribbon parlays

---

## Execution Order

| Order | Phase | Impact | Effort |
|-------|-------|--------|--------|
| **1st** | Phase 0: Fix TDZ crash | 🔴 Unlocks entire AI pipeline | 5 min |
| **2nd** | Phase 1: Fix team logos | 🟡 Visual fix for matchups | 30 min |
| **3rd** | Phase 2: Sport filters | 🟡 UX improvement across 3 pages | 20 min |
| **4th** | Phase 3: Disable player props | 🟢 Per your request | 5 min |
| **5th** | Phase 4: Manual fetch props button | 🟢 Admin convenience | 15 min |
| **6th** | Phase 6: Ticket click-through | 🟡 Core UX flow | 30 min |
| **7th** | Phase 5: Admin dashboard | 🟡 Creator tools | 45 min |
| **8th** | Phase 7: Verify cron pipelines | 🟡 Prediction tracking | 15 min |
| **9th** | Phase 8: Algorithm audit verification | 🟢 Quality assurance | 20 min |

**Total estimated time: ~3 hours of implementation**

---

## Open Questions

> [!IMPORTANT]
> **1. CFB/CBB Display Labels**: Your `ALL_SPORTS` uses `NCAAF`/`NCAAB` internally. You said "cfb, cbb" — should the filter buttons display as **CFB/CBB** or **NCAAF/NCAAB**?

> [!IMPORTANT]
> **2. Admin Access**: The admin pages are currently unprotected (anyone can visit `/admin`). Should I gate them behind your `djalberty@gmail.com` super-admin check from `admin.ts`?

> [!IMPORTANT]
> **3. Vercel Crons**: The `sweep.ts`, `grade.ts`, and `autopsy.ts` cron routes exist but I need to verify they're configured in `vercel.json`. If not, they've never actually run. Want me to set them up (daily sweep at 11pm ET, grade at 6am ET, autopsy at 7am ET)?