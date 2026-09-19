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
