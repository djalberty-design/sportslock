/** League-scoped names so Houston / Minnesota never pick a school or the wrong pro club. */

export const MLB_NAME: Record<string, string> = {
  houston: "Houston Astros",
  astros: "Houston Astros",
  hou: "Houston Astros",
  minnesota: "Minnesota Twins",
  twins: "Minnesota Twins",
  min: "Minnesota Twins",
  rays: "Tampa Bay Rays",
  tampabay: "Tampa Bay Rays",
  tb: "Tampa Bay Rays",
  yankees: "New York Yankees",
  twinsmin: "Minnesota Twins",
};

export function leagueOfficialName(sport: string, raw?: string | null): string | null {
  const key = String(raw || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!key) return null;
  const s = String(sport || "").toUpperCase();
  if (s === "MLB" || s.includes("BASEBALL")) return MLB_NAME[key] || null;
  return null;
}
