# Rebuild Changelog — September 19, 2026
## Claude Opus 4 (Antigravity) + Albert

---

### Phase 1: Fix What Users See

#### 1A. Fix Odds Format — THE #1 Bug ✅
**Files changed:** `src/lib/market/odds-api.ts`
**What:** Added `&oddsFormat=american` to both Odds API fetch URLs (mains + props).
**Why:** The API defaults to decimal odds (1.91, 2.15). Every downstream function assumed American (-110, +150). This single bug caused:
- All odds displaying as "+100" 
- All predictions showing 97-99%
**Root cause chain:** `1.91` (decimal) → treated as American → `100/(1.91+100) = 98.1%`

#### 1B. Set hardRockPrice/consensusPrice on Quotes ✅
**Files changed:** `src/lib/market/live-board.ts` (quotesFromOddsApi function)
**What:** Every quote now sets `hardRockPrice` (when source is Hard Rock) and `consensusPrice` from the bookmaker odds. Also added `homeSpread` and `total` to base quotes.
**Why:** Without these fields, `getAmOdds()` in game-page.tsx fell through to a default of `d=2.0` → always showing "+100".

#### 1C. Fix getAmOdds() and getProb() Display Functions ✅
**Files changed:** `src/components/app/game-page.tsx`
**What:** Added decimal odds detection as safety net. If a value between 1-20 is encountered, it's converted to American format before display. Shows "—" instead of "+100" when no odds available.
**Why:** Even after the API fix, stale cached data in the DB might still contain decimal values until the 12-hour TTL expires.

#### 1D. Remove Fake AI Stats ✅
**Files changed:** `src/routes/games.tsx`
**What:** Replaced hash-modulo fake "AI Matchup Projection" with real market-implied probability derived from moneyline odds. De-vigged for fair display. Bar hidden when no odds available. Renamed to "Market Projection".
**Before:** `hash % 25 + 50` = literal fake percentage
**After:** Real no-vig implied probability from moneyline odds

#### 1E. Kill Double-Counting in latents.ts ✅
**Files changed:** `src/lib/market/latents.ts`
**What:** Removed the 11-multiplier chain on line 163 that re-applied venue, rest, availability, process, recency, splits, matchup, officials, mlbPark, ncaafBlowout, nhlGoalie factors to muH/muA.
**Why:** These factors were ALREADY computed inside `buildChance()` → `report.home` → `latentFromScores()`. Multiplying them again inflated z-scores catastrophically → `normalCdf(z)` returned 0.98-0.999.

#### 1F. Rebalance dynamicBlend Weights ✅
**Files changed:** `src/lib/market/engine.ts`
**What:** Changed blend weights from (50% sim, 30% pool, 20% market) to (10% sim, 10% pool, 80% market). Removed `sharpMultiplier` probability multiplication.
**Why:** 
- The market consensus (Pinnacle/Circa/Sharp lines) reflects millions in wagered money — it IS the most reliable signal (80%+ weight).
- Sim was getting 50% weight on a broken 1D CDF with double-counted inputs.
- `blended *= 1.05` violated probability axioms — P(A) + P(not A) would exceed 1.0.
- Sharp money signal now shifts weight via addition, not multiplication.

#### 1G. Remove Hardcoded API Key (Security) ✅
**Files changed:** `src/lib/market/odds-api.ts`
**What:** Removed hardcoded fallback `c5fa171c7620da6c912ff69d843db37d` from source code. Now requires `ODDS_API_KEY` env var.
**Why:** API key was committed to git history, visible to anyone with repo access.
**ACTION REQUIRED:** Add `ODDS_API_KEY` to Vercel env vars if not already set.

#### 1H. Fix formatAm Helper ✅
**Files changed:** `src/routes/games.tsx`
**What:** Fixed the `formatAm()` odds formatter to handle decimal odds safely, matching the game-page fix.

---

### Summary of Phase 1 Changes

| File | Changes |
|------|---------|
| `src/lib/market/odds-api.ts` | `&oddsFormat=american` on both URLs, removed hardcoded API key |
| `src/lib/market/live-board.ts` | Set hardRockPrice/consensusPrice on all quotes, add homeSpread/total |
| `src/components/app/game-page.tsx` | Decimal odds safety in getAmOdds/getProb |
| `src/routes/games.tsx` | Real market projections replacing fake hash, formatAm decimal safety |
| `src/lib/market/latents.ts` | Removed double-counting 11-multiplier chain |
| `src/lib/market/engine.ts` | Market-first weights (80/10/10), removed sharpMultiplier |

---

### Phase 2: Security Hardening

#### 2A. Delete Exposed Debug Endpoints ✅
**Files deleted:** `src/routes/api/auth-debug.ts`, `src/routes/api/auth-callback-test.ts`
**Why:** `/api/auth-debug` publicly leaked session cookies, user count, env var presence, config state. Zero authentication required to read it.

#### 2B. Add authMiddleware + Admin Check to All Mutations ✅
**Files changed:** `src/lib/market/server.ts`
**Protected endpoints:**
| Function | Risk Without Auth |
|----------|------------------|
| `parseTicketImage` | Burns xAI API quota |
| `getPredictionLogs` | Leaks all prediction data |
| `fetchRealPropsFn` | Burns Odds API quota (500/month) |
| `lockPredictionFn` | Writes fake predictions to DB |
| `getTuningFn` | Reads proprietary algorithm settings |
| `saveTuningFn` | **Writes** algorithm settings (most dangerous) |
| `getBrainStatsFn` | Leaks full brain intelligence data |

All now require: authenticated session (authMiddleware) + verified admin role (assertAdmin).

#### 2C. Protect /api/admin/strategy ✅
**Files changed:** `src/routes/api/admin/strategy.ts`
**What:** Added server-side session + admin verification before any Gemini API call.
**Why:** Anyone could hit this endpoint and trigger unlimited Gemini API calls burning your quota.

#### 2D. Fix Connection Pooling ✅
**Files changed:** `src/lib/db.ts`, `src/lib/auth/server.ts`
**What:** Set `max: 2` on both Postgres connection pools.
**Why:** Default `pg` pool is `max: 10`. Two pools × 10 = 20 connections per cold start. Neon serverless limits are typically 50-100. Multiple concurrent Vercel functions could exhaust the limit, causing "too many connections" errors.

---

### Phase 3: Fix Grading Pipeline

#### 3A. Rewrite Grade Cron ✅
**Files changed:** `src/routes/api/cron/grade.ts`
**What:** Complete rewrite. Was using `parseInternalEventId()` which only matched `espn-SPORT-ID` format. All events now use `oddsapi-SPORT-UUID`. New approach uses `fetchLiveScores()` + fuzzy team name matching via `teamsMatch()`, plus `gradeMarket()` from `grade-tape.ts` which correctly handles `ml`, `moneyline`, `spread`, and `total` market types.
**Before:** 0 predictions ever graded (regex returned null for every Odds API event)
**After:** Matches predictions to completed games by team name across ESPN/MLB/NHL scoreboards

#### 3B. Rewrite Sweeper ✅
**Files changed:** `src/lib/market/sweeper.ts`
**What:** Same problem — was trying to resolve Odds API event IDs to ESPN event IDs (always returned null). Rewritten to use `fetchLiveScores()` + `teamsMatch()` + `gradeMarket()`.

#### 3C. Fix Cron Schedules ✅
**Files changed:** `vercel.json`
**What:** 
- **Sweep**: Was `0 3 * * *` (once at 11pm EDT). Now `30 16,18,20,22,0,2 * * *` (6 runs across game windows: noon, 2pm, 4pm, 6pm, 8pm, 10pm EDT)
- **Grade**: Was `0 10 * * *` (once at 6am EDT). Now `0 1,3,5,7,9,13 * * *` (6 runs spread through the day: 9pm, 11pm, 1am, 3am, 5am, 9am EDT)
**Why:** Previous schedule ran sweep once/day at 11pm and grade once/day at 6am, missing 95%+ of game completions

---

### Phase 4: Dead Code Cleanup

#### 4A. Delete markov.ts ✅
**Files deleted:** `src/lib/market/markov.ts` (65 lines)
**Why:** 0 imports anywhere in the codebase. Used football terms ("Run", "Pass", "Foul") in an NBA transition matrix. `runMonteCarlo()` function returned string "End". 100% dead code.

#### 4B. Delete narrative.ts ✅
**Files deleted:** `src/lib/market/narrative.ts`
**Why:** 0 imports. `applyNarrativeToMeans` and `applyNarrativeToProps` were never called. Guarded by `narrativeTags` parameter that no data feed provides.

#### 4C. Delete syndicate.ts ✅
**Files deleted:** `src/lib/market/syndicate.ts`
**Why:** 0 imports. All 7 functions guarded on params (`syndicateAction`, `syndicateMoney`, `reverseLine`) that no data feed provides → all returned null.

#### 4D. Increase Autopsy Batch Size ✅
**Files changed:** `src/routes/api/cron/autopsy.ts`
**What:** `LIMIT 5` → `LIMIT 20`
**Why:** With grading pipeline now functional, losses will start accumulating. 5 per cron run would create a growing backlog.

#### 4E. Sport-Specific Modules (Kept)
**Files kept:** `nfl-matchup.ts`, `mlb-park.ts`, `ncaaf-blowout.ts`, `nhl-goalie.ts`, `hoops-variance.ts`, `officials-registry.ts`
**Why:** All are imported by `latents.ts` and structurally correct — they return `{muH: 1, muA: 1, empty: true}` when no sport-specific data is available (which is always, for now). They'll activate automatically when real data feeds are added. Safe to keep; deleting would break imports.
