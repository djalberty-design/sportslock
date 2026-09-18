/** Super admin vs approved user vs pending visitor. */

export const OWNER_ADMIN_EMAIL = process.env.ADMIN_EMAIL || "djalberty@gmail.com";

export const ADMIN_EMAILS = [OWNER_ADMIN_EMAIL] as const;

export type DeskRole = "admin" | "user";

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const e = normalizeEmail(email);
  if (!e) return false;
  return ADMIN_EMAILS.some((a) => normalizeEmail(a) === e);
}

export function roleOf(email: string | null | undefined, listedRole?: DeskRole | null): DeskRole {
  if (isAdminEmail(email)) return "admin";
  return listedRole === "admin" ? "admin" : "user";
}

export function looksLikeEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

/** What admin can do that a regular user cannot. */
export const ADMIN_POWERS = [
  {
    id: "allowlist",
    title: "Manage allowlist",
    line: "Add or revoke approved emails without redeploying. Super admin cannot be revoked.",
  },
  {
    id: "tune",
    title: "Algorithm & thresholds",
    line: "Safest floor, Kelly multiplier, combo-leg cap, and which sports feed the board.",
  },
  {
    id: "ledger",
    title: "Ledger management",
    line: "Edit, settle, void, or delete tickets in the master ledger. See aggregate Hit / Miss.",
  },
  {
    id: "status",
    title: "System status",
    line: "Live health of ESPN, Kalshi, and Polymarket feeds.",
  },
  {
    id: "pin",
    title: "Pin The Call",
    line: "Choose which single sits on the gold ribbon. Users still see it as research, not a guarantee.",
  },
  {
    id: "hide",
    title: "Hide a ticket",
    line: "Take a ticket off AI Picks / Games / Combos for every approved user.",
  },
] as const;
