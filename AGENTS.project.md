# Sports Lock — project law

Read with [`GROK-2026-09-18-CURRENT.md`](./GROK-2026-09-18-CURRENT.md). That file wins if anything here drifts.

Auth ON (Google is currently broken on production; email/password works). Database ON. Persist `sports-lock-v1`. Serve `0.0.0.0:8080` via `npm run dev` / `startup.sh`. Super admin `djalberty@gmail.com`. Unapproved visitors see Access Pending. Never invent Hard Rock fills. Never claim a lock. Site never places a bet. Florida: college athlete props blocked; DK/FD sportsbooks are not live FL tickets. Photograph Hard Rock to lock. 1-800-GAMBLER.

**Current IA (overhaul, 2026-09-18):** AI Feed `/`, Matchups `/games`, The Lab `/picks`, game ticket `/game/$eventId`, Admin `/admin`. Player props on the AI Feed are off (Odds API quota + ESPN block). ESPN is not the live board; Odds API + Postgres cache is.

Hidden object is latent game `G` + usage `U` + live state `S`. Fair blends 0.5 sim / 0.3 pool / 0.2 market when all three exist. Displayed % is `calibratedChance`, clipped at 99%. College player usage may move the game; college player tickets stay blocked. Empty process looks = Looked. Same inputs → same ranking. Combos prune to the top 15–20 highest-edge legs before enumeration.

Archived specs (do not treat as current): `archive/`.
