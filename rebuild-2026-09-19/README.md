# SportsLock Rebuild — September 19, 2026
## Conducted by: Claude Opus 4 (Antigravity) + Albert

### Purpose
Complete audit and rebuild following Grok's 142-commit day (Sept 18, 2026).
Three independent code auditors identified critical bugs, dead code, and security vulnerabilities.
This folder documents every change made during the rebuild.

### Key Decisions
- **Dead Alpha modules**: Keep file structure, gut dead functions. Architecture concepts are sound but need real data feeds.
- **Odds API key**: Remove hardcoded key from source. User should rotate key on the-odds-api.com.
- **Database**: Consolidate to `desk_settings` as single source of truth. Remove `desk_tuning_raw`.
- **Blend weights**: Market-first (80% market, 10% sim, 10% pool).

### Phase Plan
| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | 🔄 IN PROGRESS | Fix what users see (odds format, predictions, fake stats) |
| Phase 2 | ⬜ Pending | Security (exposed keys, unprotected endpoints) |
| Phase 3 | ⬜ Pending | Grading pipeline (grade.ts, sweep cron, autopsy) |
| Phase 4 | ⬜ Pending | Dead code cleanup, DB schema fixes |
| Phase 5 | ⬜ Pending | Honest engine architecture |
