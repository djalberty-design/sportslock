# 🔬 The Honest Critique: Grok's 142-Commit Day

> Three independent code auditors tore apart every module, every function, every data flow.
> This is the unfiltered truth.

---

## ✅ What's Genuinely Good

Before the bad news, credit where it's due:

1. **Auth gate architecture** — The signup → approval → admin flow is solid design. `desk_allowlist` + `desk_access_requests` is the right pattern. Cookie rename from `__Host-` fixed the real login problem.

2. **Prediction logging schema** — `prediction_logs` table design is sound (event_id, market_type, model_probability, edge, snapshot JSONB, status, ai_autopsy). Good foundation for self-improvement.

3. **Odds API caching layer** — Two-tier cache (in-memory + Postgres `odds_api_cache`) with TTL is a legitimate architecture for a 500-request/month budget. The concept is correct.

4. **Admin dashboard structure** — 6 sub-pages under `/admin` with tabs (Engine Bay, Terminal, Predictions, Autopsy, Brain Intel) is well-organized. The React code renders real UI.

5. **Team logo mapping** — `logos.ts` has all 4 major pro leagues (NFL/MLB/NBA/NHL) properly mapped with ~120 entries. ESPN CDN fallback is the right approach.

6. **Sport filter component** — Clean, reusable pill-based filter that correctly filters by `r.sport`.

7. **File organization** — Separating concerns into `syndicate.ts`, `narrative.ts`, `officials.ts`, `markov.ts`, `copula.ts` etc. is good architecture *in principle*.

---

## 🔴 What's Broken Right Now (Causes Visible Bugs)

### The #1 Bug: Decimal Odds Treated as American Odds

> [!CAUTION]
> **This single bug causes BOTH the "+100 everywhere" AND the "97-99% everywhere" problems.**

The Odds API returns **decimal odds** by default (e.g. `1.91`, `2.15`). The fetch URL in `odds-api.ts` **never passes `&oddsFormat=american`**. But every downstream function assumes American format (-110, +150, etc.).

**The chain reaction:**
- `parseAmerican(1.91)` → returns `1.91` (not null, not converted)
- `quotesFromOddsApi()` sets `q.price = 1.91` but **never sets `hardRockPrice` or `consensusPrice`**
- `getAmOdds()` checks `rawP < -100 || rawP > 100` → `false` for `1.91` → falls through to default → **always returns `+100`**
- `getProb()` treats `1.91` as positive American odds → `100 / (1.91 + 100)` = **98.1%**
- Every game, every bet, every market: **+100 odds, 97-99% probability**

**Fix:** Add `&oddsFormat=american` to the API URL, OR convert decimal to American in `quotesFromOddsApi()`.

### The Grading Pipeline Is 100% Dead

- `grade.ts` uses regex `/^espn-([A-Z0-9]+)-(.+)$/` to parse event IDs
- All events now have Odds API IDs (`oddsapi-NFL-...`)
- **Regex returns null → every prediction is skipped → 0 predictions ever graded**
- `autopsy.ts` queries `WHERE status = 'LOSS'` — but nothing is ever marked LOSS
- The Brain Intelligence Dashboard shows 0% win rate because no predictions are graded
- **The entire self-improvement feedback loop is broken**

### The Sweep Cron Misses 95%+ of Games

- Runs once daily at `0 3 * * *` UTC = **11:00 PM EDT**
- Sweeps games starting within 2 hours (11pm–1am EDT)
- **Misses all afternoon and evening games** (1pm, 4pm, 7pm, 8pm ET)
- NFL Sunday 1pm slate, primetime, MLB day games — all skipped

### Fake AI Stats on Matchups Page

```typescript
// src/routes/games.tsx lines 160-163
const hash = g.eventId.split("").reduce((a, b) => a + b.charCodeAt(0), 0);
const aiProb = 50 + (hash % 25);  // Literal fake percentage
const aiFavorite = hash % 2 === 0 ? g.home : g.away;
```

Users see "AI: 67% favoring Bills" — it's a hash modulo, not a prediction.

---

## 🟡 What's "Quantitative Theater" (Looks Impressive, Does Nothing)

> [!WARNING]
> This is the hardest section to read. The "Alpha Rewrite" — which the ROADMAP marks as "100% COMPLETE" across 9 phases — is largely dead code that never executes at runtime.

### The Module-by-Module Truth

| Module | Lines of Code | Runtime Effect | Verdict |
|--------|:---:|:---:|---------|
| `markov.ts` | ~80 | **Zero** — 0 imports anywhere | 🗑️ Pure dead code. Uses football terms ("Run", "Pass") in an NBA matrix. Returns the string "End" with no score tracking. |
| `narrative.ts` | ~90 | **Zero** — `applyNarrativeToMeans` has 0 imports. `applyNarrativeToProps` is guarded by `narrativeTags` which is never passed. | 🗑️ Dead code |
| `syndicate.ts` | ~200 | **Zero** — Every function null-guards on parameters (`oLineRank`, `batterStrength`, `isFreshman`, etc.) that **no data feed ever provides**. All return `null` 100% of the time. | 🗑️ Dead code |
| `officials-registry.ts` | ~80 | **Zero** — Contains 14 hardcoded referees including **retired Angel Hernandez**. Fake `isFatigued` and `grudgePlayers` fields that are never populated. `engine.ts` never passes `officials` into `chanceInput`. | 🗑️ Meme data |
| `officials.ts` | ~150 | **Zero** — Receives empty array `[]` because `chanceInput` omits `officials`. Returns `{ muH: 1, muA: 1 }` (no-op multiplier). | 🗑️ Dead code |
| `nfl-matchup.ts` | ~60 | **Zero** — Requires `homeQbEpa`, `PBWR`, `PRWR` that no API provides. Returns `empty: true`. | 🗑️ Dead code |
| `mlb-park.ts` | ~50 | **Zero** — Requires `barometricPressure`, `humidity` that no feed provides. Returns `empty: true`. | 🗑️ Dead code |
| `ncaaf-blowout.ts` | ~40 | **Zero** — Requires `homeTalentRating` (never fed). Returns `empty: true`. | 🗑️ Dead code |
| `nhl-goalie.ts` | ~40 | **Zero** — Requires `homeGoalieGsax` (never fed). Returns `empty: true`. | 🗑️ Dead code |
| `hoops-variance.ts` | ~40 | **Zero** — Requires `homeThreePointRate` (never fed). Returns `empty: true`. | 🗑️ Dead code |
| `sim.ts` `runMonteCarlo()` | ~40 | **Zero** — The 10,000-simulation Monte Carlo function is **never called**. `drawPaths()` returns `[g]` (a single object). The "Monte Carlo" is actually a 1D normal CDF. | 🎭 Theatrical |
| `copula.ts` | ~100 | **Distorts SGP pricing** — `updateCopulaCalibration` is never called. Regex treats receiving yards as passing yards. | ⚠️ Harmful |

**Bottom line:** Of the ~1,000 lines of "Alpha Rewrite" code, approximately **0 lines affect production predictions**. The documentation (`ROADMAP.md`, `THE_BRAIN_BIBLE.md`) describes a system that doesn't exist at runtime.

### The Double-Counting Catastrophe in `latents.ts`

The code that *does* run has a critical math bug:

1. `buildChance()` computes `report.home` using rest, venue, form, recency, injuries, splits, matchup
2. `latentFromScores()` converts `report.home` → baseline means (`muH`, `muA`)
3. **Then line 163 multiplies `muH` again by** `venueMeans * restMeans * avail * processMeans * recencyMeans * splitMeans * matchupMeans * officialMeans * ...` (11 multipliers)
4. These factors were **already baked into** `report.home` — they're counted twice
5. The score delta `muH - muA` gets artificially inflated → z-scores explode → `normalCdf(z)` outputs 0.98–0.999
6. `dynamicBlend()` gives this broken sim **50% weight** (vs only 20% to actual market odds)
7. Result: Every prediction converges to 97–99%

### The `dynamicBlend` Weights Are Backwards

```
wSim = 0.5    ← 50% weight on a broken 1D CDF with double-counted inputs
wPool = 0.3   ← 30% weight on a Bayesian pool that also has double-counted factors  
wMarket = 0.2 ← 20% weight on THE ACTUAL MARKET (the most reliable signal)
```

In professional quantitative sports modeling, the market (Pinnacle/Circa no-vig line) should carry **80-90% of the weight**. It reflects millions of dollars of sharp money. Giving it only 20% and trusting a toy simulation at 50% is mathematically indefensible.

Additionally, `blended *= sharpMultiplier` (multiplying a probability by 1.05) **violates probability axioms** — complementary probabilities no longer sum to 1.0.

---

## 🔴 Security Vulnerabilities

### HIGH SEVERITY

1. **Hardcoded API Key in Source Code**
   - `odds-api.ts:3`: `export const ODDS_API_KEY = "c5fa171c7620da6c912ff69d843db37d"`
   - Committed to git, visible to anyone with repo access. Key should be rotated.

2. **Public Debug Endpoint Leaking Cookies**
   - `/api/auth-debug` returns session cookies, user count, env var flags — zero authentication required.

3. **Unprotected Admin Mutations**
   - `saveTuningFn` — anyone can change engine parameters (kelly, minEdge, maxLegs)
   - `lockPredictionFn` — anyone can write to prediction_logs
   - `parseTicketImage` — anyone can burn xAI API quota
   - `fetchRealPropsFn` — anyone can burn Odds API quota
   - `/api/admin/strategy` — anyone can trigger Gemini API calls
   - `getBrainStatsFn`, `getPredictionLogs` — proprietary data publicly readable

4. **Admin Routes: Client-Side Only Protection**
   - `/admin` checks `isAdmin` in React render only — no `beforeLoad` server check
   - `/admin/brain-intel` has **NO admin check at all** — fully public

5. **Preview OAuth Secret Hardcoded**
   - `src/lib/auth/preview.ts:20`: `PREVIEW_CLIENT_SECRET = "8bcdb7fc5a33874ad..."`

### MEDIUM SEVERITY

6. **`trustedOrigins` Variable Shadowed** — Dynamically built array on lines 101-107 of `server.ts` is completely overridden by a hardcoded literal on line 149. Preview deployments will get 403 CSRF errors.

7. **Duplicate Database Connection Pools** — `db.ts` and `auth/server.ts` each create independent `new Pool()` with default `max: 10`. Serverless = 20 connections per cold start.

8. **`useSecureCookies: false`** — Turns off `__Secure-` prefix in production, reducing cookie-tossing defenses.

---

## 🟡 Database & Infrastructure Issues

1. **Duplicate migration prefix** — Both `0002_desk.sql` and `0002_tuning.sql` share `0002_`
2. **Duplicate settings tables** — `desk_settings` and `desk_tuning_raw` store the same parameters, are never synced
3. **Phantom table** — `desk_ledger` created in code (`ledger-api.ts`), not in migrations
4. **Missing indexes** — `prediction_logs.created_at`, `(status, ai_autopsy)` composite
5. **Missing foreign keys** — `desk_ledger_bets.user_id` → `user.id`, `desk_access_requests.user_id`
6. **NCAAF/NCAAB logos** — 0 teams mapped. All show broken ESPN URLs.
7. **ESPN code dead** — Line 739 of `live-board.ts` disables ESPN entirely. ~345 lines of ESPN quote-building code are dead.

---

## 📊 Scorecard

| Category | Grade | Notes |
|----------|:-----:|-------|
| **Auth & Access Control** | C+ | Core flow works, but admin routes unprotected server-side |
| **Data Pipeline (Odds)** | F | Decimal/American confusion breaks everything |
| **Prediction Engine** | F | Double-counting + dead modules = 97-99% on everything |
| **UI/UX** | B- | Looks good, but displays fake/broken data |
| **Grading & Feedback Loop** | F | 0 predictions ever graded. Entire pipeline dead. |
| **Security** | D | Exposed keys, unprotected mutations, public debug endpoints |
| **Database** | C | Schema is OK but duplicated tables, missing indexes/FKs |
| **Documentation** | D | Describes a system that doesn't exist at runtime |
| **Cron Jobs** | F | Sweep misses 95% of games, grade/autopsy never fire |

---

---

# 🛠️ Implementation Plan: The Real Fix

> Priority order. Each phase is independently deployable.
> Estimated scope: ~3 focused sessions.

---

## Phase 1: EMERGENCY — Fix What Users See (Session 1)

> [!IMPORTANT]
> These fixes make the app display correct data immediately.

### 1A. Fix Odds Format (THE critical bug)
**File:** `src/lib/market/odds-api.ts`
- Add `&oddsFormat=american` to ALL fetch URLs (lines ~90, ~140)
- OR: Add a `decimalToAmerican()` converter in `quotesFromOddsApi()`
- Set `hardRockPrice` and `consensusPrice` on every quote from the Odds API
- **Verification:** Odds should show realistic values (-150, +130, -110, etc.)

### 1B. Fix `getAmOdds()` and `getProb()` Fallbacks
**File:** `src/components/app/game-page.tsx`
- `getAmOdds()`: Remove the `rawP < -100 || rawP > 100` gate — it fails on decimal odds
- `getProb()`: Add decimal odds detection (`rawP > 0 && rawP < 20` → treat as decimal)
- **Verification:** Prediction bars should show realistic percentages (45-65% range)

### 1C. Remove Fake AI Stats
**File:** `src/routes/games.tsx`
- Delete the hash-modulo fake AI probability (lines 160-163)
- Show real `fairProb` from the engine, or show nothing

### 1D. Kill the Double-Counting in `latents.ts`
**File:** `src/lib/market/latents.ts`
- **Remove line 163's 11-multiplier chain** — `muH` and `muA` should come from `buildChance()` output cleanly without re-applying the same factors
- **Verification:** `fairProb` values should distribute across 0.30–0.70 range instead of 0.97–0.99

### 1E. Rebalance `dynamicBlend` Weights
**File:** `src/lib/market/engine.ts`
- Change weights to: `wSim = 0.10`, `wPool = 0.10`, `wMarket = 0.80`
- **Remove `blended *= sharpMultiplier`** — probability multiplication violates axioms
- Apply sharp money signal as a separate advisory indicator, not a probability multiplier

**Deploy Phase 1 → users see real odds and realistic predictions**

---

## Phase 2: SECURITY — Lock Down the App (Session 1 continued)

### 2A. Remove Exposed Secrets
- Delete hardcoded `ODDS_API_KEY` from `odds-api.ts:3` — use `process.env.ODDS_API_KEY` only
- Delete `/api/auth-debug` and `/api/auth-callback-test` routes entirely
- Rotate the Odds API key (get a new one from the-odds-api.com)

### 2B. Add Auth to All Admin Mutations
**Files:** `src/lib/market/server.ts`, `src/routes/api/admin/strategy.ts`
- Wrap `saveTuningFn`, `lockPredictionFn`, `fetchRealPropsFn`, `getBrainStatsFn`, `getPredictionLogs` with `authMiddleware` + `requireAdmin`
- Wrap `parseTicketImage` with `authMiddleware` (at minimum)
- Add `authMiddleware` to `/api/admin/strategy`

### 2C. Server-Side Admin Route Protection
**Files:** `src/routes/admin.tsx`, `src/routes/admin/brain-intel.tsx`
- Add `beforeLoad` server check that validates admin role
- Apply to ALL admin child routes

### 2D. Fix Connection Pooling
**File:** `src/lib/db.ts`, `src/lib/auth/server.ts`
- Set `max: 2` on both pools for serverless
- Add `idleTimeoutMillis: 10000`
- Consider sharing a single pool

**Deploy Phase 2 → app is secure**

---

## Phase 3: GRADING — Make the Feedback Loop Work (Session 2)

### 3A. Fix `grade.ts` Event ID Parsing
**File:** `src/routes/api/cron/grade.ts`
- Replace ESPN-only regex with one that handles both formats:
  - `oddsapi-{sport}-{id}` → extract sport + lookup by team names + date
  - `espn-{sport}-{id}` → existing logic
- Match `"ml"` (from sweep) to moneyline grading logic

### 3B. Fix Sweep Cron Timing
**File:** `vercel.json`
- Change sweep from once-daily to every 2 hours: `"0 */2 * * *"`
- OR: Widen the sweep window from 2 hours to 24 hours

### 3C. Fix Autopsy Batch Size
**File:** `src/routes/api/cron/autopsy.ts`
- Increase `LIMIT 5` to `LIMIT 20` to clear Sunday slates in one pass

### 3D. Fix `sweeper.ts` for Odds API Events
**File:** `src/lib/market/sweeper.ts`
- Remove the early-return `null` for Odds API format events
- Implement team-name + date matching against ESPN final scores

### 3E. Consolidate Ledger Tables
- Delete phantom `desk_ledger` table creation in `ledger-api.ts`
- Point all sweeper code to `desk_ledger_bets`
- Create a proper migration `0005_cleanup.sql`

**Deploy Phase 3 → predictions get graded, Brain Intel dashboard shows real data**

---

## Phase 4: CLEANUP — Remove Dead Code & Fix DB (Session 2 continued)

### 4A. Delete Dead "Alpha" Modules
Delete entirely (0 runtime effect):
- `src/lib/market/markov.ts`
- Remove all unused imports of dead functions

Gut the dead code paths from (keep the files but remove functions that never execute):
- `syndicate.ts` — keep `applyAirDensityMultiplier` concept but remove hardcoded magic numbers
- `narrative.ts` — remove both functions
- `officials-registry.ts` — delete the 14 fake referee entries
- `nfl-matchup.ts`, `mlb-park.ts`, `ncaaf-blowout.ts`, `nhl-goalie.ts`, `hoops-variance.ts` — delete or stub

### 4B. Delete Dead ESPN Code
**File:** `src/lib/market/live-board.ts`
- Remove `quotesFromEspnEvent()` and all ESPN scoreboard parsing (lines 1-345)
- Keep only `quotesFromOddsApi()` path since ESPN is disabled

### 4C. Fix Database Schema
- Rename `0002_tuning.sql` → `0005_tuning.sql` (fix duplicate prefix)
- Consolidate `desk_tuning_raw` into `desk_settings` (one table, not two)
- Add missing indexes: `prediction_logs(created_at DESC)`, `(status, ai_autopsy)`
- Add missing FK: `desk_ledger_bets.user_id → user.id`

### 4D. Fix NCAAF/NCAAB Logos
**File:** `src/lib/market/logos.ts`
- Add top 25 + Power 5 conference teams (~65 entries)
- Use numeric ESPN team IDs for NCAA (e.g. `194` for Ohio State)

### 4E. Fix `trustedOrigins` Shadowing
**File:** `src/lib/auth/server.ts`
- Remove the hardcoded override on line 149
- Use the dynamically computed `trustedOrigins` from lines 101-107

**Deploy Phase 4 → clean codebase, no dead code, proper schema**

---

## Phase 5: HONEST ENGINE — Build What Actually Works (Session 3)

> [!NOTE]
> This is what the "Alpha Rewrite" should have been — a system where market odds are king and the model adds genuine edge only where it has real data.

### 5A. Market-First Architecture
- The Pinnacle/consensus no-vig line IS the baseline (80% weight)
- Model adjustments are SMALL deltas (±1-3%) based on REAL, AVAILABLE data
- Available data that can actually be ingested: injuries (ESPN API), rest days (schedule math), home/away (already present), weather (free APIs for outdoor sports)

### 5B. Honest `chance.ts` Rebuild
- Don't throw away core layers (log5, pythag, form, venue) when market odds exist
- Use them as VALIDATION signals, not primary drivers
- If model disagrees with market by >10%, flag it for review rather than trusting model

### 5C. Real Monte Carlo (Optional, Phase 5+)
- If we want real simulation, `drawPaths` should actually call `runMonteCarlo`
- Use proper inputs (not double-counted ones)
- But honestly: a well-calibrated CDF with correct inputs is better than a broken Monte Carlo

### 5D. Accurate Documentation
- Update `ROADMAP.md` and `THE_BRAIN_BIBLE.md` to reflect reality
- Mark what's implemented vs. aspirational
- Remove claims of "100% COMPLETE" for modules that don't run

---

## Phase Priorities

```
MUST DO NOW:     Phase 1 (users see correct data)
                 Phase 2 (security holes closed)

MUST DO SOON:    Phase 3 (grading pipeline works)
                 Phase 4 (dead code removed, DB fixed)

SHOULD DO:       Phase 5 (honest engine architecture)
```

---

## Questions for You

1. **Do you want me to start executing Phase 1 now?** The odds format fix is a 2-line change that immediately fixes the "+100 / 97%" display bug.

2. **The Odds API key `c5fa171c...` is in the git history forever.** Do you want to rotate it (get a new key from the-odds-api.com)?

3. **How do you feel about the dead Alpha modules?** I can delete them entirely, or I can keep the file structure and just remove the dead functions so the architecture is there if you ever want to wire in real data feeds.

4. **The `desk_tuning_raw` vs `desk_settings` duplication** — which table do you want to keep as the source of truth for engine parameters?