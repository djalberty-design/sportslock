/**
 * Hard Rock Bet sport-lobby URL. This is not slip injection and is not a
 * game-level deep link — Phase 3 may tighten the path if a stable game URL exists.
 */
export function getHardRockUrl(sport?: string): string {
  const base = "https://www.hardrock.bet";
  const s = String(sport || "").toLowerCase();
  let path = "";
  if (s.includes("nfl") || s.includes("football")) path = "/sports/football/nfl";
  else if (s.includes("ncaaf")) path = "/sports/football/ncaa";
  else if (s.includes("mlb") || s.includes("baseball")) path = "/sports/baseball/mlb";
  else if (s.includes("nba") || s.includes("basketball")) path = "/sports/basketball/nba";
  else if (s.includes("nhl") || s.includes("hockey")) path = "/sports/hockey/nhl";
  else path = "/sports";

  return `${base}${path}`;
}
