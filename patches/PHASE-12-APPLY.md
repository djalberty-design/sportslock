# Phase 12 apply

```powershell
cd C:\Users\alber\Documents\sports-lock_G
git fetch origin
git checkout phase-12-full-espn-slate
git pull
```

Then add two edits if they are not already on the branch:

1. `src/lib/market/live-board.ts` after `quotes = quotesFromOddsApi(oddsApiMains);`
```
  quotes = await mergeEspnTodaySchedule(quotes).catch(() => quotes);
```
and import `{ mergeEspnTodaySchedule } from "./espn-today-slate.ts";`

2. `src/lib/market/odds-api.ts`
```
export const ODDS_BOOKS = "hardrockbet_fl,hardrockbet,draftkings,fanduel,betmgm";
```

Then:
```powershell
git add src/lib/market/espn-today-slate.ts src/lib/market/live-board.ts src/lib/market/odds-api.ts
git commit -m "fix(phase-12): show full ESPN today slate when books omit a game"
git push origin phase-12-full-espn-slate
npm run ship
```
