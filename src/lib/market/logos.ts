/** ESPN public team marks â€” same art Hard Rock shows next to the matchup. */

const LEAGUE_LOGO: Record<string, string> = {
  NFL: "nfl",
  NBA: "nba",
  MLB: "mlb",
  NHL: "nhl",
  NCAAF: "ncaa",
  NCAAB: "ncaa",
};

export function espnLogoUrl(sport: string, abbr?: string, espnTeamId?: string): string | null {
  const league = LEAGUE_LOGO[sport];
  if (!league) return null;
  if ((sport === "NCAAF" || sport === "NCAAB") && espnTeamId) {
    const id = espnTeamId.replace(/[^0-9]/g, "");
    if (id) return `https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png`;
  }
  if (!abbr) return null;
  const a = abbr.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!a) return null;
  return `https://a.espncdn.com/i/teamlogos/${league}/500/${a}.png`;
}

export function teamNick(full: string | undefined, abbr?: string, short?: string): string {
  const s = (short || "").trim();
  if (s && s.length <= 18 && !/\bat\b/i.test(s)) return s;
  if (abbr && abbr.length <= 4) {
    const parts = (full || "").trim().split(/\s+/);
    if (parts.length >= 2) return parts.slice(-1)[0] ?? (full || "");
  }
  const parts = (full || "").trim().split(/\s+/);
  if (parts.length >= 2) return parts.slice(-1)[0] ?? (full || "");
  return full || "";
}
