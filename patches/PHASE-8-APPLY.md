# Phase 8 apply

Already on `phase-8-chart-modes-and-overseer`:
- `src/routes/admin.tsx` operator tabs (Today / Why we missed / Inbox / Access)
- `src/lib/market/weight-proposal.ts` propose-only (`phase4Live` is false)

Apply the rest (exclude those two files):

```bash
git checkout phase-8-chart-modes-and-overseer
git pull
git apply --exclude=src/routes/admin.tsx --exclude=src/lib/market/weight-proposal.ts patches/phase-8-rest.patch
git add src/components/quant/distribution-chart.tsx src/routes/picks.tsx src/routes/admin/dashboard.tsx
git commit -m "fix(phase-8): ML/TD probability gauges, no 0.5 curve, honest calibrate alert"
git push
npm run ship
```

Do not invent scores. Do not print +392% EV. Do not pass marketType=prop for TD props.
