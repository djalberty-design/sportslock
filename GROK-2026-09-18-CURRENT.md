# SportsLock — Current Law

**Date:** Friday, September 18, 2026  
**Author:** Grok (working session with DJ Alberty)  
**Repo:** `djalberty-design/sportslock`  
**Commit this file was written against:** `0f7d295` (Thu Sep 17, 2026, 8:58pm EDT)  
**Live:** https://sports-lock-g.vercel.app  

This is the single current source of truth for product, principles, and what is actually implemented. Older plans live in `archive/` and are history only.

---

## 1. What this product is

SportsLock is a **Florida sports research desk**. It names tickets a user can take to **Hard Rock Bet**, or grade from a photographed slip. It is research.

- The site **never places a bet**.
- The site **never calls a lock** and never prints “guarantee” or 100%. Displayed chance clips at **99%**.
- Tagline: *Picking with Intelligence Creates Confidence.*
- Universe: **NFL, NBA, MLB, NHL, NCAAF, NCAAB**. Other sports stand down.
- College **player** tickets are blocked in Florida. College player usage may still move the **game** latent. No Florida college player ticket.
- DraftKings / FanDuel sportsbooks are not live Florida fills. DraftKings Fantasy is a separate, thinner desk.
- Kalshi and Polymarket are **research only**.
- 21+ Hard Rock / 18+ fantasy. 1-800-GAMBLER.
- Do not invent Hard Rock’s book. Do not scrape Hard Rock. Photo or Odds API.
- Empty feed = **Looked** (not a skip, not a guess). Never print **NO LOOK**. Never invent ESPN splits, last-10, EPA, xG, or handle.

Persist key: `sports-lock-v1`. Auth **on**. Database **on**. Super admin: `djalberty@gmail.com`.

---

## 2. Decisions locked on 2026-09-18

These override older docs.

| Topic | Decision |
|---|---|
| Product IA | **Current overhaul**, not the old five-desk blueprint (`/today`, `/board`, `/parlay`, `/live`, `/desk`). |
| Home `/` | **SportsLock AI Feed** — gold ribbon parlays. Not the bankroll start essay. |
| Player props on the AI Feed | **Off for now.** Odds API quota + ESPN block. Lab may still hold prop machinery for later. |
| Google OAuth button | **Does not work** on the live site as of this date. |
| Email/password with Gmail | **Works.** Creator account is recognized as admin. |
| ESPN | **Blocked / do not hammer.** Board is Odds API + Postgres cache. |
| Docs | This file is current. Everything listed in §10 is archived. |

---

## 3. Current information architecture

What a user actually hits on `main` today:

| Surface | Route | Role |
|---|---|---|
| AI Feed | `/` | Gold Ribbon parlays from `picks.ribbon`. Sport filter. |
| Matchups | `/games` | Games list, sport filter, admin Fetch Props + quota badge. Card → `/game/$eventId`. |
| The Lab | `/picks` | Props / research workbench. Sport filter. |
| Game ticket | `/game/$eventId` | Markets, sim panel, SGP legs, Lock It In → `prediction_logs`. |
| Ticket | `/ticket` | Breakdown / rules stamps. |
| Login | `/login` | Google (broken) + email/password (working). |
| Admin | `/admin` and children | Engine Bay, Live Status, Predictions, Autopsy, Brain Intel. Admin email only. |

Older blueprint desks (`/today`, `/board`, `/parlay`, `/live`, `/desk`) and “Start `/` is bankroll” are **not** current IA. Supporting components for some of those still exist in `src/components/app/` (live, desk, start, slate, DFS). Treat them as leftover surface, not the product map, until a later pass says otherwise.

Moods (Safest / Best Value / Pays more) remain engine law if the ranking code still applies them. They are not the homepage chrome right now.

---

## 4. Auth and access

- Signup required. Unapproved visitors see **Access Pending**.
- Admin / creator: `djalberty@gmail.com` (`src/lib/admin.ts`, overridable with `ADMIN_EMAIL`).
- Email/password against that Gmail **works** and grants admin.
- Google `signIn.social` / generic OAuth path **does not work** on production as of this date. Last night’s hotfixes: cookie `__Host-` prefix removed, auth-debug endpoint added, session vs access pending states split. Still not a working Google button.
- Debug leftovers on `main`: `/api/auth-debug`, `/api/auth-callback-test`. Do not treat these as product.

---

## 5. Data sources and quota

| Source | Status | Role |
|---|---|---|
| The Odds API | **Primary board.** Real ML / spread / total prices. 12h Postgres cache (`odds_api_cache`) so cold starts do not burn quota. | Schedule + lines |
| ESPN | **Blocked / disabled after 403 and rate limits.** Blueprint still describes live last-10 / gamelog / splits from ESPN. That contract is **suspended** until ESPN works again. Empty ESPN looks stay Looked — do not invent. | Suspended |
| Kalshi / Polymarket | Research overlays when the snapshot has them. | Research |
| Action Network tape | Research when posted. | Tickets % vs handle % |
| Hard Rock | Photo or delayed Odds API. No scrape. | Fill |
| Postgres | Cache, ledger, prediction logs, brain config. | Durable |

**Props:** fetching player props costs Odds API requests. Admin can press **Fetch Props** on a matchup (1 request). Global AI-Feed props are **off** until quota and ESPN recover.

Nightly / periodic jobs (`vercel.json`):

| Cron | UTC | Intent (ET) |
|---|---|---|
| `/api/cron/sweep` | `0 3 * * *` | 11pm ET — log model plays |
| `/api/cron/grade` | `0 10 * * *` | 6am ET — W/L/P |
| `/api/cron/autopsy` | `0 11 * * *` | 7am ET — loss analysis via xAI |
| `/api/cron/sweep-ledger` | `15,45 * * * *` | every 30 min — ledger |

Configured ≠ proven. Confirm in Vercel whether these fire and whether `prediction_logs` has rows.

---

## 6. Engine — what is built

Intent (from the Sep 17 Alpha rewrite, still the math story):

1. **Sharp anchor** — sportsbook no-vig line is the prior. Do not double-count public information against the market.
2. **Latents** — game `G`, usage `U`, live state `S`. Seeded paths. Same quotes → same ranking.
3. **Fair blend when all three exist:** 0.5 sim / 0.3 pool / 0.2 market.
4. **Alpha hooks** only when a market inefficiency trigger fires (weather, injuries, rest, officials, narrative, park, trench, altitude, freshman, etc.).
5. **SGP** — Monte Carlo game scripts + Clayton/Gumbel copula + joint grade. Ribbon is 2- or 3-leg mains with hit-rate floors, not lottery posters.
6. Displayed % is calibrated chance, clipped at 99%.

Code that exists under `src/lib/market/` for that story includes: `engine.ts`, `latents.ts`, `chance.ts`, `sim.ts`, `copula.ts`, `joint-grade.ts`, `props.ts`, `usage.ts`, `form.ts`, `looks.ts`, `research.ts`, `picks.ts`, `rank.ts`, `rules.ts`, `narrative.ts`, `officials.ts`, `syndicate.ts`, `markov.ts`, `tape.ts`, `florida.ts`, plus sport-specific modules.

**Honesty about “sealed.”** `THE_BRAIN_BIBLE.md` called the engine complete the same day Phases 8–12 had to patch TDZ crashes, mojibake, SGP side contamination, officials branches, and NaN pricing. The modules are in the tree. They are not proven clean in production. Next engine work is **verify**, not add another multiplier.

Desk pin strings in old docs (`2026.09.09-world`, `2026.09.10-master-v6`) drifted. Bump a single pin when ranking rules change; do not keep two.

---

## 7. What shipped (through Sep 17, 2026)

Already on `main`, in rough order:

- Alpha rewrite + sport plugins + SGP constructor
- Odds API as board when ESPN died; persistent quote cache; real book prices
- Phase 0: TDZ fix in `picks.ts`; AI Feed reads `picks.ribbon`
- Phase 1: ESPN abbreviation logo map + `onError` fallback
- Phase 2: sport filters on Feed / Matchups / Lab
- Phase 3 then Step 5: props flag exists; **current product decision is props off** (quota)
- Phase 4: admin Fetch Props + quota badge
- Phase 5: admin tabs + admin gate
- Phase 6: ticket click-through, sim panel, Lock It In → DB
- Phase 7: Vercel cron schedules + autopsy via xAI
- Phases 8–12: brain bug pass, Engine Bay persist, logos, officials, injury matching
- Steps 1–4: labels, prediction bars, logo fixes
- Step 6: log ML / spread / total / props
- Step 7: auth gate + admin email
- Step 8: Brain Intelligence dashboard
- Auth hotfixes (Google still broken)

---

## 8. Principles for any new work

1. Analyze current code. Propose. Wait for accept. Then implement.
2. Match existing code style. No generator comments, no new branding in source.
3. Document every change in `GROK-2026-09-18-CHANGELOG.md` (or a new dated Grok file if the calendar day changes).
4. Push to `main` only after explicit go. Vercel deploy follows the GitHub push.
5. Do not re-enable ESPN hammering or bulk prop fetches without a quota plan.
6. Do not revive archived docs as if they were current.
7. Florida honesty rules in §1 do not move.

---

## 9. Open work (not started this session)

Priority order for the plan we will write next:

1. **Auth** — Google button is broken; email path works. Decide: fix Google, or hide it and keep email.
2. **Confirm production** — AI Feed populated vs empty; crons firing; prediction rows existing.
3. **Enforce props-off** in `buildDeskPicks` so the Feed matches the quota decision (Step 5 had turned them on).
4. **Remove or hide debug routes** once auth is stable.
5. **IA leftovers** — old desk components vs current Feed / Matchups / Lab / Admin. Clean later, not first.
6. **Engine verification** — ribbon quality, Looked stamps, no invented ESPN stats.
7. **Hard Rock “Tail”** is still `alert("Redirecting to Hard Rock FL...")`. Stub.

Do not start new alpha plugins until 1–3 are settled.

---

## 10. Archive

Moved 2026-09-18 by Grok. History only.

| Archived file | Why it left the root |
|---|---|
| `archive/OUTDATED-IMPLEMENTATION-PLAN.md` | Recovery Phases 0–8; most of it shipped the same night. |
| `archive/OUTDATED-ROADMAP.md` | Alpha rewrite checklist; “brain 100% complete” overstated. |
| `archive/OUTDATED-THE-BRAIN-BIBLE.md` | Engine intent; still useful as history. |
| `archive/OUTDATED-SPORTS-LOCK-BLUEPRINT.md` | Old five-desk IA, auth-off, `/today` law. Honesty rules were folded into this file. |
| `archive/OUTDATED-SPORTS-LOCK-ALGORITHM.md` | Formula spec v1. |
| `archive/OUTDATED-SPORTS-LOCK-ALGORITHM-v2.md` | Duplicate of v1 at archive time. |
| `archive/OUTDATED-BIBLE.md` | Edition-1 floor. |
| `archive/OUTDATED-plan.md` | Early agent recon protocol. |
| `archive/OUTDATED-attachments-SPORTS-LOCK-ALGORITHM.md` | Extra copy of the algorithm spec. |

**Left in place, treat as outdated:**

- `artifacts/sports-lock-master-spec.md` (~1MB upload from Sep 12/13). Too large to duplicate. Do not use as current law.

**Still at repo root on purpose:**

- `README.md` — pointer to this file
- `AGENTS.md` — App Builder platform contract (not product law)
- `AGENTS.project.md` — short project constraints; defers to this file

---

## 11. Working agreement (this Grok session)

- Propose → review → implement → changelog → push on go.
- Today’s identifiable Grok docs: this file and `GROK-2026-09-18-CHANGELOG.md`.
- Code changes stay in the existing voice of the repo.
