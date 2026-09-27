# Phase 6 remaining apply (Antigravity)

P0 chrome + Ledger disclaimer are already on `phase-6-slip-chrome-and-doors`.
This patch is the rest of the agreed P1/P2 slice. Do not rewrite the four files.

```bash
git checkout phase-6-slip-chrome-and-doors
git pull
git apply patches/phase-6-p1-p2.patch
git add src/routes/picks.tsx src/components/app/sportslock-parlay-card.tsx src/components/app/ticket-page.tsx src/components/app/board-page.tsx
git commit -m "fix(phase-6): Lab scope, feed add-to-slip, leftover /parlay links"
git push
```

Then wait for Vercel green on that SHA and squash-merge PR #8.

What the patch does:
- Lab `displayBets` deps include `todayFiltered` / `todayOnly`
- Lab toggle / isInSlip pass `eventId` + `player`
- Gold/Catalog **Add to Slip** (appends) + per-leg `+`; Lock It In stays
- ticket-page / board-page leftover `/parlay` links to `/picks`

Do not add a personal ledger toggle. Do not unfreeze weights. Do not add billing.
