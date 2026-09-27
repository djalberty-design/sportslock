# Phase 11 apply

```bash
git checkout phase-11-props-and-et-board
git pull
git apply --ignore-whitespace patches/phase-11-rest.patch
git add src/lib/market/odds-api.ts src/components/app/game-page.tsx
git commit -m "fix(phase-11): keep player markets on props pull"
git push
npm run ship
```

Why props failed: normalizeEventBooks dropped every market that was not h2h/spreads/totals, then dropped outcome.description. NFL player props never survived the pull.
Why MLB was missing after Phase 10: Saturday stored board < 24h still counted as fresh on Sunday.
