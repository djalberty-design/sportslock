import { leagueOfficialName } from "./league-names";
import { NCAA_ID as NCAA_CATALOG } from "./ncaa-ids";

export { leagueOfficialName };

/** If a pro quote carries a leftover NCAA url, drop it. */
export function stripWrongCollegeLogo(sport: string, url?: string | null): string | null {
  const u = String(url || "");
  const s = String(sport || "").toUpperCase();
  const college = s.includes("NCAA") || s === "NCAAF" || s === "NCAAB" || s === "CFB" || s === "CBB";
  if (!college && u.includes("/ncaa/")) return null;
  return url || null;
}
