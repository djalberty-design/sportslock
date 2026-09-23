# SportsLock Master Project Brief & Full Development History

> **For the incoming AI Agent**: This document provides the complete, unbroken context of the entire SportsLock development project across all sessions (including work done by Claude Opus 4.6 and Gemini 3.8 Flash). Read this file first before touching any code.

---

## 1. High-Level Product Vision: What We Are Building
**SportsLock** is an autonomous, AI-driven sports betting analytics platform and parlay laboratory. The user's vision centers around 5 core pillars:

1. **AI Picks Section (`/picks`)**:
   - Designed for casual users who want a simple, high-confidence AI-generated parlay or straight pick they can lock in with confidence.
2. **The Lab / Parlay Builder (`/picks` & `/builder`)**:
   - A powerhouse interactive workbench where users build their own custom parlays using the best possible data across **all sports (MLB, NFL, CFB/NCAAF, NBA)** and **all AI models / market types (Player Props, Spreads, Moneylines, Totals)**.
   - Must rank picks by highest hit probability and Expected Value (`EV = hitProb * decimalOdds`), balanced with decent payouts.
   - Completed and in-progress/live games must **never** appear here.
   - Correlated same-game legs use the **Clayton Copula** algorithm to compute accurate joint fair probabilities and show an `⚡ SGP` badge.
   - Includes team logos and player headshots for clean visual recognition.
3. **My Action / Ledger (`/ticket?id=` via `DeskPage`)**:
   - The user's active and historical betting slips, styled to closely mirror **Hard Rock Bet** digital slips.
   - **100% Automated Tracking & Settlement**: Once a game finishes, the user's tickets must automatically resolve to `WON`, `LOST`, or `PUSH` using live/historical ESPN scores and server tape without requiring manual button presses.
4. **Track Record Page (`/results`)**:
   - Public, transparent, and verified record of the AI's predictions.
   - Must **only** display the AI's actual recommended favorite pick per game market (never both sides of the same game), reflecting the AI's real ~60% win rate.
   - Features sport filter buttons (`ALL`, `MLB`, `NFL`, `NCAAF`), lines, edges, and final game scores.
5. **The Brain / Overseer (`/admin/analysis`)**:
   - The autonomous intelligence and self-improvement core.
   - Snaps every market line into `market_tape`, grades completed games against ESPN APIs, performs tape autopsies, and dynamically tunes model blend weights.

---

## 2. Chronological History of All Changes & Commits

### Phase 1: Claude Opus 4.6 Sprint (Commits `e9a1658` – `7428ee4`)

1. **Widen AI Model Sanity Range (`e9a1658`)**:
   - Broadened the model probability clamping bounds from `12-88%` to `3-97%` so extreme heavy favorites or longshot props can reflect realistic betting odds.
2. **The Lab Overhaul & EV Ranking (`2adeed8`)**:
   - Redesigned The Lab into a unified best-bets dashboard.
   - Implemented EV Score ranking to balance hit probability with attractive payouts.
3. **Sport Filters, Team Logos & Player Headshots (`eca05b3`, `7430eb1`)**:
   - Fixed sport filter showing 0 on "All Sports".
   - Integrated team logo SVGs and ESPN headshot image paths across props and matchup cards.
4. **Filtering Live and Completed Games (`67adabd`, `ec090f4`)**:
   - Users reported that players and teams from games that had already started (e.g. Rams @ Giants) were still showing up in The Lab.
   - Added start-time filtering (`start < now`) and cross-referencing with active in-play board matchups to strictly exclude live/finished games.
5. **Fix MLB Prop Pulls (The Odds API HTTP 422) (`7428ee4`)**:
   - **Issue**: Clicking the MLB prop pull button caused a `422 Unprocessable Entity` error from The Odds API.
   - **Fix**: The Odds API v4 baseball endpoint rejects generic keys like `player_home_runs` or `player_strikeouts`. Updated `odds-api.ts` and `server.ts` to use valid keys: `batter_home_runs`, `batter_hits`, `batter_total_bases`, `batter_rbis`, `batter_runs_scored`, `pitcher_strikeouts`, `pitcher_outs`.
6. **Overseer Timezone Alignment (`7428ee4`)**:
   - **Issue**: Historical game scores were missing late-evening games due to UTC date boundary shifts.
   - **Fix**: Grounded historical dates in `{ timeZone: "America/New_York" }` in `historical-scores.ts` and `prop-grader.ts`.
7. **Clayton Copula & Hard Rock Deep Links (`7428ee4`)**:
   - Added Clayton copula joint probability formula in `parlay-slip.ts` for correlated SGPs.
   - Added deep link generator (`hard-rock-links.ts`) directing users to Hard Rock Bet sections.
8. **Parlay Lock-In to My Action (`7428ee4`)**:
   - Enabled users to lock in multi-leg custom parlays built in The Lab directly to `localStorage` paper tickets / `prediction_logs`.

---

### Phase 2: Gemini 3.8 Flash Sprint (Commits `14f7737` – `010881f`)

1. **Overseer Analysis Date Clarity (`14f7737`)**:
   - **Issue**: User noticed games like *Minnesota @ Washington* and *Georgia Tech @ Stanford* labeled "9/21/2026 PENDING" with 0 graded, thinking grading was broken.
   - **Discovery**: These were College Football games scheduled for Saturday, September 26! The table was showing `snapped_at` (9/21), not the scheduled game date.
   - **Fix**: In `src/routes/admin/analysis.tsx`, renamed column to **Game Date** (`r.start`) with snapshot subtext, making future weekend matchups immediately clear.
2. **Overseer Auto-Grow Tape on Demand (`14f7737`)**:
   - **Issue**: Total predictions count in Overseer remained stuck at 2009.
   - **Fix**: Updated `batchGradeFn` in `src/lib/market/server.ts` so clicking "Grade Now" snaps all active board games into `market_tape` via `runMarketTape()` *before* grading, growing the total tape automatically.
3. **My Action Hard Rock Bet Ticket Redesign (`14f7737`)**:
   - Overhauled `<DeskPage />` in `src/components/app/desk-page.tsx`.
   - Created digital Hard Rock Bet-style cards:
     - Bet type badges (`STRAIGHT BET`, `2-LEG PARLAY`, `⚡ SAME GAME PARLAY`).
     - Status pills (`WAITING`, `LIVE`, `WON`, `LOST`, `PUSH`).
     - Numbered leg-by-leg breakdowns with individual checkmarks/crosses.
     - 3-column financial strip (`TOTAL WAGER`, `TOTAL ODDS`, `POTENTIAL PAYOUT`).
     - Won celebration bar showing net profit.
     - Direct `Hard Rock Bet ↗` button.
     - **Completely removed mandatory manual [Hit] / [Miss] / [Push] buttons**.
4. **100% Automated Settlement Engine (`14f7737`)**:
   - Built `settlePaperTicketsFn` in `src/lib/market/server.ts` and `useAutoGrade` in `src/lib/auto-grade.tsx`.
   - Tickets automatically check ESPN live scores, historical scores, and server-graded `market_tape` rows every 30 seconds.
   - Evaluates spreads (including MLB run lines), moneylines, and multi-leg parlay outcomes hands-free without any user action required.
5. **Fix Yesterday's Parlay Showing "Live" (`123d4e8`)**:
   - **Issue**: Ticket `#SL-RF7HR` placed Monday (*Rams + Kyren Williams anytime TD + SF Giants*) showed a pulsing red `Live: 1 - 2 (Top 6th)` banner on Tuesday night.
   - **Cause**: Game 2 of the Giants vs Twins series was live, and `desk-page.tsx` was looking up quotes matching `ticket.home` and `ticket.away` regardless of ticket age or whether it was already settled.
   - **Fix**: Restricted live quote matching strictly to `ticket.status === "open"` AND `isRecent` (within 16 hours) AND `isSingle` (straight bet). Guarded live banner with `isOpen && isLive && liveScore`.
6. **Track Record Overhaul (`/results`) (`123d4e8`)**:
   - **Issue**: Track Record showed 249-251 (~50/50) because it queried all rows in `market_tape`. `market_tape` logs both sides of every market (Over and Under, Spread + and -), guaranteeing one win and one loss per game.
   - **Fix**: In `src/routes/results.tsx`, filtered query to `recommended = true` (or `prob >= 0.50`) and added PostgreSQL `DISTINCT ON` deduplication so each market contains **only 1 pick**: the AI's actual prediction favorite.
   - **UI Polish**: Added real AI win rate badge (~60%), sport filter buttons (`ALL`, `MLB`, `NFL`, `NCAAF`), lines, edges, and final scores.

---

## 3. Key Architecture & File Map

| File Path | Role & Purpose |
| :--- | :--- |
| `src/routes/picks.tsx` | Main interface for **The Lab** and **AI Picks** parlay builder. |
| `src/components/app/parlay-slip.tsx` | Parlay Slip builder, Clayton Copula calculations, ticket lock-in. |
| `src/components/app/desk-page.tsx` | **My Action** tab, Hard Rock Bet ticket components, live status display. |
| `src/lib/auto-grade.tsx` | Client-side settlement loop connecting to server auto-grade endpoints. |
| `src/routes/results.tsx` | **Track Record** page with verified AI recommendations and sport filters. |
| `src/routes/admin/analysis.tsx` | **Overseer Analysis** workbench, CLV tracking, calibration curves. |
| `src/lib/market/server.ts` | Backend server functions (`batchGradeFn`, `settlePaperTicketsFn`, `getAllEnrichedPropsFn`). |
| `src/lib/market/grade-tape.ts` | Core grading logic matching market tape against ESPN live/historical endpoints. |
| `src/lib/market/odds-api.ts` | The Odds API v4 integration for game lines and player prop markets. |
| `src/lib/market/types.ts` | Data models (`PaperTicket`, `TapeRow`, `OddsQuote`, `MarketProp`). |
| `src/lib/db.ts` | Neon PostgreSQL client. |

---

## 4. Next Priorities & Immediate Backlog
1. **The Brains & Autonomous Self-Improvement**:
   - Automated post-grade tape autopsy: analyze which models and market types are performing best.
   - Dynamic weight adjustments: calibrate blend weights based on recent 7-day and 30-day performance.
2. **The Lab Multi-Model Expansion**:
   - Ensure all AI models (not just player props) are fully represented and sortable in The Lab.
   - Refine the sorting hierarchy (Hit % vs EV vs Payout).
   - Ensure team logos and player headshots load cleanly across all sports.
3. **Background Cron Automation**:
   - Ensure automated background crons regularly snap the tape and grade completed games.

---

## 5. Quick-Start Instruction for Next Chat
To resume seamlessly in a new chat, simply paste:

> **"Read HANDOFF.md and git log to see our latest progress, and let's continue with the next improvements."**
