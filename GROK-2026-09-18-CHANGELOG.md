# Grok changelog — 2026-09-18

Session with DJ Alberty. Docs only. No application code changed.

## Decisions recorded

- Product IA = current overhaul (AI Feed / Matchups / Lab / Admin), not the old five-desk blueprint.
- Google sign-in broken on production; email/password with Gmail works and grants admin.
- Player props off on the AI Feed for Odds API quota + ESPN block.

## Files

### Added

- `GROK-2026-09-18-CURRENT.md` — current product / principles / implementation.
- `GROK-2026-09-18-CHANGELOG.md` — this file.
- `archive/README.md` — how to read the archive.

### Moved to `archive/` (renamed `OUTDATED-*`)

- `IMPLEMENTATION_PLAN.md`
- `ROADMAP.md`
- `THE_BRAIN_BIBLE.md`
- `SPORTS_LOCK_BLUEPRINT.md`
- `SPORTS_LOCK_ALGORITHM.md`
- `SPORTS_LOCK_ALGORITHM_v2.md`
- `BIBLE.md`
- `plan.md`
- `attachments/SPORTS_LOCK_ALGORITHM.md`

### Updated

- `README.md` — points at current law.
- `AGENTS.project.md` — points at current law; IA lines updated to the overhaul.

### Not moved (size)

- `artifacts/sports-lock-master-spec.md` — outdated Sep 12/13 spec, ~1MB. Treat as archive-in-place.
