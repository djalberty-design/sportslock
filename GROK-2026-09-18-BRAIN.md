# Brain tape + suggestions — plan (locked 2026-09-18 evening)

Closed tape of game markets. Human Accept before anything changes the scan. No LLM edit of `engine.ts`. No Feed props.

## H1 tape — shipped / confirmed 10:35 ET
## H2 grade — shipped
## H3 autopsy buckets — shipped
## H4 suggestion queue — shipped

Suggestions tab. Accept / Reject / Later store `brain_suggestions` only until H5.

## H5 — Engine reads accepted overrides (shipping now)

Accept of a sport/market card writes `brain_overrides`.

- `chanceHaircut` — subtract from `fairProb` on that sport + market, clip 1–99%, recompute EV
- `action: sit` — stand down that slice unless the line is photographed / Hard Rock
- `hold-kelly` / sample-too-small / global echo — **no override** (notes only)
- Reject or Later deletes that fingerprint override

`rankDesk` applies overrides after Florida law, before ribbon picks. Kelly sliders stay manual in Engine Bay.

Loop is closed: tape → grade → buckets → suggestion → your Accept → scan change.

## Out of scope

Feed props, player boards, auto-apply without Accept, Odds API `/scores`.
