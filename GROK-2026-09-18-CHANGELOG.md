# Grok changelog — 2026-09-18

Session with DJ Alberty.

## Code — guest desk (same day, after archive)

Login is optional so the public desk can be audited on production. Admin rights stay on the signed-in creator email.

### Changed

- `src/components/app/access-gate.tsx` — unsigned visitors get the overhaul desk. No redirect to `/login`. No Access Pending wall. Session spinner only.
- `src/lib/auth/gates.tsx` — signed-out control is **Sign in** → `/login` (was **Owner** → `/admin/terminal`).
- `src/routes/login.tsx` — copy says the desk is open without an account.

### Unchanged on purpose

- `/admin` still checks `isAdmin`.
- Fetch Props / quota badge still `isAdmin` on `/games`.
- Email/password and Google button still on `/login`.
- `getBoardSnapshot` was already unauthenticated.

### Docs

- `GROK-2026-09-18-CURRENT.md` §1, §3, §4, §9 updated for guest desk.
