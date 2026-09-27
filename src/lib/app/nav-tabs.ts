/** Phase 5 primary nav. One slip, three doors. Arbitrage stays off the bar. */
export const PRIMARY_TABS = [
  { to: "/", label: "Picks" },
  { to: "/picks", label: "Lab" },
  { to: "/games", label: "Games" },
  { to: "/ticket", label: "Ticket" },
  { to: "/results", label: "Ledger" },
] as const;

export const OFF_NAV_ROUTES = ["/arbitrage"] as const;

export function isPrimaryTab(path: string): boolean {
  return PRIMARY_TABS.some((tab) => tab.to === path);
}
