# Brain tape + suggestions — current

Closed loop as of late 2026-09-18:

1. **Tape** — pregame / live / final game markets (`market_tape`)
2. **Grade** — WIN / LOSS / PUSH from StatsAPI / NHL / ESPN web
3. **Buckets** — model_miss / echoed_book / high_variance / settled
4. **Suggestions** — Accept / Reject / Later
5. **Overrides** — accepted sit / chance haircut apply in `rankDesk`

Predictions admin now reads this tape, not the old Angels `prediction_logs` rows.

Still held: Feed props, player boards, auto-apply without Accept, Odds API `/scores`.
Still broken: Google OAuth. Hard Rock fill is off-site.
