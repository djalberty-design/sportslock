# Phase 10 apply

```bash
git checkout phase-10-tickets-pull-filters
git pull
git apply --ignore-whitespace --ignore-space-change patches/phase-10.patch
git add src/lib/desk-store.ts src/components/app/desk-page.tsx src/lib/market/odds-api.ts src/lib/market/morning-pull.ts src/routes/index.tsx src/routes/picks.tsx
git commit -m "fix(phase-10): hard-delete tickets, morning pull, sport-scoped feed"
git push
npm run ship
```

P0 tickets + pull. P1 sport filter wraps singles/catalogs/Lab architect. P2 Gold empty -> best single, not a junk parlay.
No billing. Weights frozen.
