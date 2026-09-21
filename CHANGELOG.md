# SportsLock — Implementation Changelog

## Session: 2026-09-21 (Overseer Audit & Fixes)

### Context
Full audit of 30 prior conversations identified 6 partial implementations and 3 missing items from the Overseer Overhaul. This session addresses the critical bugs first, then important gaps.

---

### Changes

#### Fix #1: Pull Props Button Invisible (Investigated)
- **File**: `src/components/app/game-page.tsx` (line 430)
- **Root Cause**: The button renders conditionally on `isAdmin` from `useAccess()`. 
  `useAccess()` requires `signedIn = Boolean(user && !user.isDevFallback)` to be true.
  In dev/preview mode, `isDevFallback: true` → `signedIn = false` → `isAdmin = false` → button hidden.
  In deployed mode with auth enabled, requires the user to be signed in with `djalberty@gmail.com`.
- **Status**: VERIFIED — button code is correct, requires real auth sign-in on deployed app. If still not visible when signed in, check `getAccess()` → `isAdminEmail()` path.

#### Fix #2: `sweeper.ts` — Totals Legs Can't Auto-Settle ✅
- **File**: `src/lib/market/sweeper.ts`
- **Root Cause**: `sweepLedger()` matched legs by team name via `teamsMatch(selection, ...)`, but Over/Under legs like `"Over 224.5"` have no team name → `teamsMatch()` always returned false → multi-leg tickets with totals stuck forever.
- **Fix**: Added 3-tier matching: (1) team name match, (2) `leg.home`/`leg.away` fields if present, (3) inherit game from sibling legs on the same ticket for total/prop markets.
- **Status**: ✅ DONE

#### Fix #3: `'win'/'loss'` vs `'hit'/'miss'` Result Naming Mismatch ✅
- **Files**: `src/lib/sweeper-api.ts`, `src/components/app/ledger-panel.tsx`
- **Root Cause**: Manual sweep button used `Math.random() > 0.4` (literal coin flip!) and wrote `'hit'/'miss'`. Automated cron sweeper wrote `'win'/'loss'`. UI only checked `'hit'`.
- **Fix**: (a) Replaced coin-flip `sweeper-api.ts` with real `sweepLedger()` call. (b) Updated `ledger-panel.tsx` to accept both `'win'`/`'hit'` and `'loss'`/`'miss'`.
- **Status**: ✅ DONE

#### Fix #4: Client-Side Auto-Grade Only Handles ML → Now Handles Spread/Total ✅
- **File**: `src/lib/auto-grade.tsx`
- **Root Cause**: `gradeMoneyline()` returned `"void"` for spread and total bets, leaving them for manual grading.
- **Fix**: Added spread grading (margin + line > 0 = win) and total grading (combined score vs line, checking over/under in description). Falls back to `"void"` only when no `point`/`line` is stored on the ticket.
- **Status**: ✅ DONE

#### Fix #5: `desk_ledger_bets` Has No Auto-Settlement Pipeline
- **Root Cause**: Signed-in user bets in Postgres have no cron or sweeper.
- **Fix**: Extend `sweepLedger()` to also process `desk_ledger_bets`.
- **Status**: PENDING

#### Fix #6: Not All Stored Data Visible in Analysis UI
- **File**: `src/routes/admin/analysis.tsx`
- **Root Cause**: LLM autopsy text, layer weights, copula values, simulation details stored but not displayed.
- **Fix**: Add expandable "Raw Data" section to analysis table rows.
- **Status**: PENDING
