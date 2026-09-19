# Brain tape + suggestions — current

Closed loop as of late 2026-09-18:

1. **Tape** — pregame / live / final game markets (`market_tape`)
2. **Grade** — WIN / LOSS / PUSH from StatsAPI / NHL / ESPN web
3. **Buckets** — model_miss / echoed_book / high_variance / settled
4. **Suggestions** — Accept / Reject / Later
5. **Overrides** — accepted sit / chance haircut apply in `rankDesk`

Predictions admin now reads this tape, not the old Angels `prediction_logs` rows.

DJ answers 2026-09-18 late:

1. Users see **all** tape predictions. That is the log the autopsy grades.
2. Live latent `S` keeps running after first pitch. Score / period / clock change the rank fingerprint. Live tape snaps every 5 minutes.
3. Grey Matchups cells stay empty and say **later**.
4–5. One ticket hit % everywhere. Gold stays strict. Catalog is the rest.

Still held: Feed props, player boards, auto-apply without Accept, Odds API `/scores`.
Still broken: Google OAuth. Hard Rock fill is off-site.
