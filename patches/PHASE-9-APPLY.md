# Phase 9 apply

```bash
git checkout phase-9-honest-ledger
git pull
git apply patches/phase-9-p1.patch
git apply patches/phase-9-results.patch
git add src/routes/results.tsx src/components/app/board-page.tsx src/components/app/desk-page.tsx src/routes/games.tsx src/routes/picks.tsx
git commit -m "fix(phase-9): honest ledger chart, career totals, plain-English labels"
git push
npm run ship
```

P0 is results.tsx. P1 is four one-line labels. No clv-tracker math changes.
