/**
 * Hard Rock last mile. There is no stable public game-page URL we can mint
 * from team names, so the link is a sport lobby. The copy string is the
 * actual execution aid: tap to paste team / market / line / price.
 */
export function getHardRockUrl(sport?: string): string {
  const base = "https://www.hardrock.bet";
  const s = String(sport || "").toLowerCase();
  let path = "";
  if (s.includes("ncaaf")) path = "/sports/football/ncaa";
  else if (s.includes("nfl") || s.includes("football")) path = "/sports/football/nfl";
  else if (s.includes("mlb") || s.includes("baseball")) path = "/sports/baseball/mlb";
  else if (s.includes("ncaab")) path = "/sports/basketball/ncaa";
  else if (s.includes("nba") || s.includes("basketball")) path = "/sports/basketball/nba";
  else if (s.includes("nhl") || s.includes("hockey")) path = "/sports/hockey/nhl";
  else path = "/sports";
  return `${base}${path}`;
}

export type HardRockLastMile = {
  url: string;
  kind: "lobby";
  copyText: string;
  note: string;
};

export function hardRockLastMile(input: {
  sport?: string;
  matchup?: string;
  pick?: string;
  price?: number | null;
}): HardRockLastMile {
  const price =
    input.price == null || !Number.isFinite(input.price)
      ? ""
      : input.price > 0
        ? `+${Math.round(input.price)}`
        : `${Math.round(input.price)}`;
  const bits = [input.matchup, input.pick, price ? `Hard Rock ${price}` : "Hard Rock"].filter(Boolean);
  return {
    url: getHardRockUrl(input.sport),
    kind: "lobby",
    copyText: bits.join(" · "),
    note: "Lobby link only. Copy the ticket and photograph the slip after you place it.",
  };
}
