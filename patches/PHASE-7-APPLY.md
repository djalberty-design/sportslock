# Phase 7 apply

Scorecard labels are already on `phase-7-honest-copy`.
Apply the rest (do not invent L10 opponents):

```bash
git checkout phase-7-honest-copy
git pull
git apply patches/phase-7-rest.patch
git add src/components/quant/distribution-chart.tsx src/routes/picks.tsx src/routes/games.tsx src/routes/results.tsx src/components/app/ai-top-singles.tsx src/components/app/desk-page.tsx src/components/app/shell.tsx
git commit -m "fix(phase-7): hide fake L10, no 21.5 fallback, plain-English helpers"
git push
npm run ship
```

Then Vercel green and squash-merge the PR.
