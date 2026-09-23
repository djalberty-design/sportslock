# SportsLock Engineering Handoff & Continuity Brief

> **Context**: This document provides full continuity between development sessions. Any new agent thread should read this file first.

---

## 1. Project Overview & Current State
- **Repo**: `c:\Users\alber\Documents\sports-lock_G` (`djalberty-design/sportslock`)
- **Branch**: `main` (auto-deploys to Vercel production on push)
- **Status**: Clean working tree. Production build passes, all APIs stable.

---

## 2. Recent Commits & Delivered Features

### Commit `123d4e8` (Latest)
- **Track Record Overhaul (`/results`)**:
  - Filtered to AI prediction favorites only (`recommended = true` or `prob >= 0.50`).
  - Added PostgreSQL `DISTINCT ON` deduplication so each market has only 1 pick, resolving the 50/50 win-rate issue and reflecting the true ~60% AI win rate.
  - Added sport filters (`ALL`, `MLB`, `NFL`, `NCAAF`), win rate badge, lines, edges, and final scores.
- **Parlay Live Status Guard (`src/components/app/desk-page.tsx`)**:
  - Settled or past-day parlays will never show live in-game status banners.
  - Only active, open straight bets placed within 16 hours can match live quotes.
  - Multi-game parlays hide single-game matchup headers.

### Commit `14f7737`
- **My Action (`/ticket?id=`) Hard Rock Bet Redesign**:
  - Full aesthetic match to Hard Rock Bet betting slips (Straight Bets, Multi-leg Parlays, SGPs).
  - Shows total wager, total odds, potential payout, net profit celebration banner, and deep link to Hard Rock Bet.
  - Removed forced manual [Hit]/[Miss] buttons.
- **100% Automated Settlement Engine (`src/lib/market/server.ts` & `src/lib/auto-grade.tsx`)**:
  - Automatically queries ESPN live/historical scores and graded tape.
  - Auto-evaluates spreads, totals, moneylines, and multi-leg parlays hands-free.
- **Overseer Analysis Workbench Fixes (`/admin/analysis`)**:
  - Renamed snapshot dates to **Game Date** (`r.start`) with secondary snapshot date.
  - Added auto-grow on demand: "Grade Now" snaps active live games into `market_tape` before grading.

### Commit `7428ee4`
- **MLB Prop Pulls**: Corrected The Odds API v4 market keys (`batter_home_runs`, `pitcher_strikeouts`, etc.), eliminating HTTP 422 errors.
- **The Lab Completed Games Filter**: Excluded started and completed games.
- **Timezone Alignment**: Fixed UTC date boundary shifts in historical scoring (`America/New_York`).
- **Clayton Copula SGP**: Joint fair probability calculations for correlated same-game parlays.

---

## 3. Key Architecture & File Map

| Path | Purpose |
| :--- | :--- |
| `src/routes/results.tsx` | Track Record page with AI prediction favorites, filters, and verified win rates. |
| `src/components/app/desk-page.tsx` | "My Action" paper betting desk, Hard Rock Bet tickets, auto-settlement. |
| `src/routes/picks.tsx` | The Lab & AI Picks parlay builder interface. |
| `src/components/app/parlay-slip.tsx` | Parlay Slip builder with Clayton copula joint probability calculations. |
| `src/routes/admin/analysis.tsx` | Overseer Analysis Workbench, CLV tracking, calibration curves. |
| `src/lib/market/server.ts` | Server functions: `settlePaperTicketsFn`, `batchGradeFn`, `getAllEnrichedPropsFn`. |
| `src/lib/market/grade-tape.ts` | Market tape grading logic against ESPN live and historical APIs. |
| `src/lib/market/odds-api.ts` | The Odds API v4 fetcher for odds, spreads, and player props. |
| `src/lib/db.ts` | PostgreSQL Neon connection (`market_tape`, `prediction_logs`, etc.). |

---

## 4. Next Priorities / Backlog
1. **The Brains / Self-Improvement Autonomous Loop**:
   - Automated post-grade tape autopsy: analyze which models/sports underperformed.
   - Dynamic weight adjustment: tune model blend weights based on 7-day and 30-day calibration.
2. **The Lab Enhancements**:
   - Support for all AI model tickets beyond player props.
   - High hit percentage sorting hierarchy with decent payout balancing.
   - Player headshots and team logos integration across tickets.
3. **Automated Background Cron**:
   - Ensure Vercel cron or GitHub Actions trigger tape grading and settlement on schedule.
