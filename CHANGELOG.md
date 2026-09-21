# SportsLock — Implementation Changelog

## Session: 2026-09-21 (Overseer Audit & Fixes)

### Context
Full audit of 30 prior conversations identified 6 partial implementations and 3 missing items from the Overseer Overhaul. This session addresses the critical bugs first, then important gaps. A re-audit caught 7 additional bugs which were fixed in a second pass.

---

### Changes

#### Fix #1: Pull Props Button Invisible ✅
- **Files**: `src/routes/games.tsx`, `src/components/app/game-page.tsx`
- **Root Causes Found**:
  1. `/games` page used `useDeskStore(selectIsAdmin)` — `adminEmail` is **never populated**, so `isAdmin` was permanently `false` for everyone, completely hiding the "Fetch Props" button on every game card.
  2. `/game/$eventId` page had the Pull Props button 400px above in a sticky header. Users in the "Player Props" tab saw "Use the green button above" but couldn't find it.
  3. Auth gate: `useAccess()` requires real sign-in (not dev fallback).
- **Fix**: (a) Replaced `useDeskStore(selectIsAdmin)` with `useAccess()` in `games.tsx`. (b) Added Pull Props button directly inside the Player Props tab empty state in `game-page.tsx`. (c) Auth gate verified correct.
- **Status**: ✅ DONE

#### Fix #2: `sweeper.ts` — Totals Legs Can't Auto-Settle ✅
- **File**: `src/lib/market/sweeper.ts`, `src/lib/market/grade-tape.ts`
- **Root Cause**: `sweepLedger()` matched legs by team name via `teamsMatch(selection, ...)`, but Over/Under legs like `"Over 224.5"` have no team name → stuck forever.
- **Fix**: (a) Pre-scan all legs to find `ticketGame` before the grading loop (fixes totals-first leg order). (b) 3-tier fallback: team match → leg.home/away fields → sibling leg inheritance. (c) `gradeMarket()` now accepts `"totals"`, `"spreads"`, `"over_under"` as aliases.
- **Status**: ✅ DONE

#### Fix #3: `'win'/'loss'` vs `'hit'/'miss'` Result Naming Mismatch ✅
- **Files**: `src/lib/sweeper-api.ts`, `src/components/app/ledger-panel.tsx`
- **Root Cause**: Manual sweep button used `Math.random() > 0.4` (coin flip!). Automated cron wrote `'win'/'loss'`. UI only checked `'hit'`.
- **Fix**: (a) Replaced coin-flip with real `sweepLedger()`. (b) Stats accept both naming conventions. (c) Status column now shows color-coded WIN/LOSS/PENDING badges instead of raw `"settled"` text.
- **Status**: ✅ DONE

#### Fix #4: Client-Side Auto-Grade Only Handles ML → Now Handles Spread/Total ✅
- **Files**: `src/lib/auto-grade.tsx`, `src/lib/market/types.ts`
- **Root Cause**: `gradeMoneyline()` returned `"void"` for spreads/totals. `PaperTicket` type lacked `point`/`marketType` fields.
- **Fix**: (a) Added `point?: number` and `marketType?: string` to `PaperTicket`. (b) Auto-grader falls back to `quote.point` when `ticket.point` is missing. (c) Spread grading: margin + line > 0 = win. Total grading: combined score vs line.
- **Status**: ✅ DONE

#### Fix #5: `desk_ledger_bets` Has No Auto-Settlement Pipeline ✅
- **File**: `src/lib/market/sweeper.ts`
- **Root Cause**: Signed-in user bets in Postgres had no cron or sweeper.
- **Fix**: Added `sweepUserBets()` function. Refactored `sweepLedger()` to orchestrate both `sweepDeskLedger()` (multi-leg) and `sweepUserBets()` (single bets). Both use ESPN score matching + `gradeMarket()`.
- **Known Limitation**: `desk_ledger_bets` has no `line` column, so spread/total user bets can only auto-settle if `gradeMarket` can resolve from selection text. ML bets settle fully.
- **Status**: ✅ DONE

#### Fix #6: Not All Stored Data Visible in Analysis UI ✅
- **Files**: `src/lib/market/server.ts`, `src/routes/admin/analysis.tsx`
- **Root Cause**: Analysis query only selected 11 columns. Autopsy bucket/note, event ID, phase, in-play, and engine snapshot were hidden.
- **Fix**: (a) Extended SQL to include all fields. (b) Added safe `ALTER TABLE ADD COLUMN IF NOT EXISTS` for `bucket`/`autopsy_note` (prevents crash on fresh DB). (c) Expandable 3-column detail panel: Game Details, Timing & Identity, AI Analysis + collapsible raw engine snapshot JSON.
- **Status**: ✅ DONE

---

### Re-Audit Bugs Found & Fixed (Second Pass)

| Bug | Source | What Was Wrong | Fix |
|-----|--------|---------------|-----|
| `games.tsx` admin check | Re-audit | `selectIsAdmin` reads `adminEmail` which is never set → button permanently hidden | Switched to `useAccess()` |
| Props tab UX disconnect | Re-audit | Button was 400px above in header, not in the tab | Added button inside tab empty state |
| Sweeper loop order | Re-audit | If total leg is first, `ticketGame` was null → abort | Pre-scan legs before grading loop |
| `gradeMarket` strict match | Re-audit | Only accepted `"total"`, not `"totals"` | Added aliases |
| Ledger status display | Re-audit | Showed raw `"settled"` text, no WIN/LOSS indication | Color-coded badge showing result |
| Auto-grade missing line | Re-audit | `PaperTicket` had no `point` field → always void | Added field + quote fallback |
| Analysis SQL crash | Re-audit | `bucket`/`autopsy_note` columns might not exist | Safe `ADD COLUMN IF NOT EXISTS` |
