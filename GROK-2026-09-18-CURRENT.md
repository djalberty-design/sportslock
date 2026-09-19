# SportsLock — Current Law

**Date:** Friday, September 18, 2026  
**Author:** Grok (working session with DJ Alberty)  
**Repo:** `djalberty-design/sportslock`  
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
| ESPN | **Blocked / do not hammer.** Morning pull probes scoreboard once per sport and records 200 vs 403. Empty looks stay Looked. Live scores may reuse ESPN scoreboard only when that probe was 200. |
| Feed mix | Sport chips + same-game / same-sport / cross-sport / 2-leg / 3-leg. Cross-sport allowed. SOON follows snapshot quotes, not the ribbon. |
| Morning pull | 6:05 AM ET (`5 10 * * *` UTC). One Odds API mains force-fetch. One ESPN scoreboard probe per sport. 26h cache. Not a hijack of grade. |
| Live scores | MLB StatsAPI + NHL web API always. ESPN scoreboard for NFL/NBA/NCAAF/NCAAB only if morning probe `ok`. 2-minute cache. No Odds API `/scores`. |
| Docs | This file is current. Everything listed in §10 is archived. |

---

## 3. Current information architecture

What a user actually hits on `main` today:

| Surface | Route | Role |
|---|---|---|
| AI Feed | `/` | Gold Ribbon parlays from `picks.ribbon`. Sport filter + mix filter (same game / same sport / cross sport / 2-leg / 3-leg). SOON chips follow snapshot quotes, not the ribbon. |
| Matchups | `/games` | Games list, sport filter, admin Fetch Props + quota badge. Card → `/game/$eventId`. LIVE + score when overlay marks `inPlay`. |
| The Lab | `/picks` | Props / research workbench. Sport filter. |
| Game ticket | `/game/$eventId` | Markets, sim panel, SGP legs, Lock It In → paperTickets + `prediction_logs`. |
| My Action | `/ticket` | Personal book (open / hit / miss). `/ticket?id=` is still the breakdown. `/desk` redirects here. |
| Login | `/login` | Google (broken) + email/password (working). |
| Admin | `/admin` and children | Engine Bay, Live Status, Predictions, Autopsy, Brain Intel. Admin email only. |

Older blueprint desks (`/today`, `/board`, `/parlay`, `/live`) and “Start `/` is bankroll” are **not** current IA. `/desk` now redirects to My Action. Supporting components for some leftover surfaces still exist in `src/components/app/` (live, start, slate, DFS).

Moods (Safest / Best Value / Pays more) remain engine law if the ranking code still applies them. They are not the homepage chrome right now.

---

## 4. Auth and access

- Guest desk is open. Sign-in is optional for the public Feed / Matchups / Lab.
- Admin / creator: `djalberty@gmail.com` (`src/lib/admin.ts`, overridable with `ADMIN_EMAIL`).
- Email/password against that Gmail **works** and grants admin.
- Google `signIn.social` / generic OAuth path **does not work** on production as of this date.
- Debug leftovers on `main`: `/api/auth-debug`, `/api/auth-callback-test`. Do not treat these as product.

---

## 5. Data sources and quota

| Source | Status | Role |
|---|---|---|
| The Odds API | **Primary board.** Real ML / spread / total prices. Postgres cache so cold starts do not burn quota. | Schedule + lines |
| ESPN | **Blocked / disabled after 403 and rate limits.** Morning probe records status. Empty ESPN looks stay Looked — do not invent. | Suspended |
| MLB StatsAPI / NHL web | **Live scores.** 2-minute cache. | In-play overlay |
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
| `/api/cron/morning-pull` | `5 10 * * *` | 6:05am ET — Odds API mains + ESPN probe |
| `/api/cron/autopsy` | `0 11 * * *` | 7am ET — loss analysis via xAI |
| `/api/cron/sweep-ledger` | `15,45 * * * *` | every 30 min — ledger |

Odds API mains TTL is **26 hours**. Page views read L1 memory then L2 `odds_api_cache`. The morning job force-fetches and writes key `mains` plus stamp key `morning-pull`. Live scores write key `live-scores` (2 min).

---

## 6. Engine — what is built

Intent (from the Sep 17 Alpha rewrite, still the math story):

1. **Sharp anchor** — sportsbook no-vig line is the prior. Do not double-count public information against the market.
2. **Latents** — game `G`, usage `U`, live state `S`. Seeded paths. Same quotes → same ranking.
3. **Fair blend when all three exist:** 0.5 sim / 0.3 pool / 0.2 market.
4. **Alpha hooks** only when a market inefficiency trigger fires.
5. **SGP** — ribbon is 2- or 3-leg mains with hit-rate floors, not lottery posters. Cross-sport is allowed and filterable.
6. Displayed % is calibrated chance, clipped at 99%.

---

## 7. What shipped (through Sep 18, 2026)

- Overhaul IA: Feed / Matchups / Lab / game ticket / My Action / Admin
- Guest desk
- Phase A honest prices + $10 default
- Phase B Feed mix filters + snapshot SOON + full names + ESPN numeric college marks
- Phase C Lock It In writes My Action (`paperTickets` + `prediction_logs`)
- Phase D 6:05 AM ET Odds API mains + ESPN scoreboard probe, 26h cache
- Phase E live scores (MLB + NHL + ESPN-if-up) overlaid on the board snapshot

---

## 8. Principles for any new work

1. Analyze current code. Propose. Wait for accept. Then implement.
2. Match existing code style. No generator comments, no new branding in source.
3. Document every change in `GROK-2026-09-18-CHANGELOG.md`.
4. Push to `main` only after explicit go. Vercel deploy follows the GitHub push.
5. Do not re-enable ESPN hammering or bulk prop fetches without a quota plan.
6. Do not revive archived docs as if they were current.
7. Florida honesty rules in §1 do not move.

---

## 9. Open work

1. Phase F — local date+time stamp. Drop Just now / Optimal / v4.2.0.
2. Confirm morning-pull fires in Vercel and `odds_api_cache` has a `morning-pull` stamp. College/NBA/NFL live scores wait on that stamp.
3. Google button still broken; email path works.
4. Hard Rock fill is still off-site. Lock only writes the research book.

---

## 10. Archive

Moved 2026-09-18 by Grok. History only. See `archive/OUTDATED-*`.

---

## 11. Working agreement (this Grok session)

- One phase at a time. Push each phase to `main`.
- Today’s identifiable Grok docs: this file, `GROK-2026-09-18-PLAN.md`, and `GROK-2026-09-18-CHANGELOG.md`.
- Code changes stay in the existing voice of the repo.
