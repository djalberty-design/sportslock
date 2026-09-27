# Phase 7 apply

Branch: `phase-7-honest-copy` (from `main` @ `80daac3`).

Already on the branch if this file landed: scorecard labels.
Apply the rest with:

```bash
git checkout phase-7-honest-copy
git pull
git apply patches/phase-7-honest-copy.patch
# if scorecard/shell hunks already applied:
git apply --reject patches/phase-7-honest-copy.patch || true
git add src/components/quant/distribution-chart.tsx src/routes/picks.tsx src/routes/games.tsx src/routes/results.tsx src/components/app/ai-top-singles.tsx src/components/app/desk-page.tsx src/components/app/shell.tsx src/components/app/public-scorecard-home.tsx
git commit -m "fix(phase-7): hide fake L10, no 21.5 fallback, plain-English helpers"
git push
```

Do not restore `generateDeterministicL10`. Do not invent opponent lists.
