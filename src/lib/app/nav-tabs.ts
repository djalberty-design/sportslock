/** Phase 2 primary nav. Lab / arbitrage / matchups stay as routes but off the bar. */
export const PRIMARY_TABS = [
  { to: "/", label: "Board" },
  { to: "/ticket", label: "Ticket" },
  { to: "/results", label: "Ledger" },
] as const;

export const OFF_NAV_ROUTES = ["/picks", "/arbitrage", "/games"] as const;

export function isPrimaryTab(path: string): boolean {
  return PRIMARY_TABS.some((tab) => tab.to === path);
}
