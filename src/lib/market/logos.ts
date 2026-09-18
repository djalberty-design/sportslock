/** ESPN public team marks — same art Hard Rock shows next to the matchup. */

const LEAGUE_LOGO: Record<string, string> = {
  NFL: "nfl",
  NBA: "nba",
  MLB: "mlb",
  NHL: "nhl",
  NCAAF: "ncaa",
  NCAAB: "ncaa",
};

/**
 * Maps Odds API full team names → ESPN CDN abbreviations.
 * ESPN uses lowercase abbreviations in the URL path.
 * e.g. "Detroit Lions" → "det" → https://a.espncdn.com/i/teamlogos/nfl/500/det.png
 */
const TEAM_ABBR: Record<string, string> = {
  // ── NFL ──
  "Arizona Cardinals": "ari", "Atlanta Falcons": "atl", "Baltimore Ravens": "bal",
  "Buffalo Bills": "buf", "Carolina Panthers": "car", "Chicago Bears": "chi",
  "Cincinnati Bengals": "cin", "Cleveland Browns": "cle", "Dallas Cowboys": "dal",
  "Denver Broncos": "den", "Detroit Lions": "det", "Green Bay Packers": "gb",
  "Houston Texans": "hou", "Indianapolis Colts": "ind", "Jacksonville Jaguars": "jax",
  "Kansas City Chiefs": "kc", "Las Vegas Raiders": "lv", "Los Angeles Chargers": "lac",
  "Los Angeles Rams": "lar", "Miami Dolphins": "mia", "Minnesota Vikings": "min",
  "New England Patriots": "ne", "New Orleans Saints": "no", "New York Giants": "nyg",
  "New York Jets": "nyj", "Philadelphia Eagles": "phi", "Pittsburgh Steelers": "pit",
  "San Francisco 49ers": "sf", "Seattle Seahawks": "sea", "Tampa Bay Buccaneers": "tb",
  "Tennessee Titans": "ten", "Washington Commanders": "wsh",

  // ── MLB ──
  "Arizona Diamondbacks": "ari", "Atlanta Braves": "atl", "Baltimore Orioles": "bal",
  "Boston Red Sox": "bos", "Chicago Cubs": "chc", "Chicago White Sox": "chw",
  "Cincinnati Reds": "cin", "Cleveland Guardians": "cle", "Colorado Rockies": "col",
  "Detroit Tigers": "det", "Houston Astros": "hou", "Kansas City Royals": "kc",
  "Los Angeles Angels": "laa", "Los Angeles Dodgers": "lad", "Miami Marlins": "mia",
  "Milwaukee Brewers": "mil", "Minnesota Twins": "min", "New York Mets": "nym",
  "New York Yankees": "nyy", "Oakland Athletics": "oak", "Philadelphia Phillies": "phi",
  "Pittsburgh Pirates": "pit", "San Diego Padres": "sd", "San Francisco Giants": "sf",
  "Seattle Mariners": "sea", "St. Louis Cardinals": "stl", "Tampa Bay Rays": "tb",
  "Texas Rangers": "tex", "Toronto Blue Jays": "tor", "Washington Nationals": "wsh",

  // ── NBA ──
  "Atlanta Hawks": "atl", "Boston Celtics": "bos", "Brooklyn Nets": "bkn",
  "Charlotte Hornets": "cha", "Chicago Bulls": "chi", "Cleveland Cavaliers": "cle",
  "Dallas Mavericks": "dal", "Denver Nuggets": "den", "Detroit Pistons": "det",
  "Golden State Warriors": "gs", "Houston Rockets": "hou", "Indiana Pacers": "ind",
  "Los Angeles Clippers": "lac", "Los Angeles Lakers": "lal", "Memphis Grizzlies": "mem",
  "Miami Heat": "mia", "Milwaukee Bucks": "mil", "Minnesota Timberwolves": "min",
  "New Orleans Pelicans": "no", "New York Knicks": "ny", "Oklahoma City Thunder": "okc",
  "Orlando Magic": "orl", "Philadelphia 76ers": "phi", "Phoenix Suns": "phx",
  "Portland Trail Blazers": "por", "Sacramento Kings": "sac", "San Antonio Spurs": "sa",
  "Toronto Raptors": "tor", "Utah Jazz": "uta", "Washington Wizards": "wsh",

  // ── NHL ──
  "Anaheim Ducks": "ana", "Arizona Coyotes": "ari", "Boston Bruins": "bos",
  "Buffalo Sabres": "buf", "Calgary Flames": "cgy", "Carolina Hurricanes": "car",
  "Chicago Blackhawks": "chi", "Colorado Avalanche": "col", "Columbus Blue Jackets": "cbj",
  "Dallas Stars": "dal", "Detroit Red Wings": "det", "Edmonton Oilers": "edm",
  "Florida Panthers": "fla", "Los Angeles Kings": "la", "Minnesota Wild": "min",
  "Montreal Canadiens": "mtl", "Nashville Predators": "nsh", "New Jersey Devils": "nj",
  "New York Islanders": "nyi", "New York Rangers": "nyr", "Ottawa Senators": "ott",
  "Philadelphia Flyers": "phi", "Pittsburgh Penguins": "pit", "San Jose Sharks": "sj",
  "Seattle Kraken": "sea", "St. Louis Blues": "stl", "Tampa Bay Lightning": "tb",
  "Toronto Maple Leafs": "tor", "Utah Hockey Club": "uta", "Vancouver Canucks": "van",
  "Vegas Golden Knights": "vgk", "Washington Capitals": "wsh", "Winnipeg Jets": "wpg",
};

/**
 * Resolve an ESPN abbreviation from a full team name (Odds API style).
 * Falls back to last-word-substring if no mapping found.
 */
export function teamAbbrFromName(fullName: string): string {
  const mapped = TEAM_ABBR[fullName];
  if (mapped) return mapped;
  const lower = fullName.toLowerCase();
  for (const [key, val] of Object.entries(TEAM_ABBR)) {
    if (key.toLowerCase() === lower) return val;
  }
  const last = fullName.split(" ").pop() || fullName;
  return last.substring(0, 3).toLowerCase();
}

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

export function resolveTeamLogo(
  sport?: string,
  opts?: {
    logo?: string | null;
    abbr?: string | null;
    name?: string | null;
    espnTeamId?: string | null;
  },
): string | null {
  if (opts?.logo) return opts.logo;
  const fromName = opts?.name ? teamAbbrFromName(opts.name) : undefined;
  const abbr = (opts?.abbr && String(opts.abbr).trim()) || fromName;
  return espnLogoUrl(sport || "", abbr || undefined, opts?.espnTeamId || undefined);
}

export function resolveLegTeam(leg: any, quote?: any) {
  const sport = String(leg?.sport || quote?.sport || "");
  const homeName = String(leg?.home || quote?.home || "");
  const awayName = String(leg?.away || quote?.away || "");
  const homeAbbr = leg?.homeAbbr || quote?.homeAbbr || (homeName ? teamAbbrFromName(homeName) : undefined);
  const awayAbbr = leg?.awayAbbr || quote?.awayAbbr || (awayName ? teamAbbrFromName(awayName) : undefined);
  const homeLogo = resolveTeamLogo(sport, {
    logo: leg?.homeLogo || quote?.homeLogo,
    abbr: homeAbbr,
    name: homeName,
    espnTeamId: quote?.homeEspnId || leg?.homeEspnId,
  });
  const awayLogo = resolveTeamLogo(sport, {
    logo: leg?.awayLogo || quote?.awayLogo,
    abbr: awayAbbr,
    name: awayName,
    espnTeamId: quote?.awayEspnId || leg?.awayEspnId,
  });
  const sel = String(leg?.selection || "");
  const selLow = sel.toLowerCase();
  const sideHome = Boolean(
    (homeName && sel.includes(homeName)) ||
      (homeAbbr && selLow.includes(String(homeAbbr).toLowerCase())) ||
      leg?.side === "home",
  );
  const sideAway = Boolean(
    (awayName && sel.includes(awayName)) ||
      (awayAbbr && selLow.includes(String(awayAbbr).toLowerCase())) ||
      leg?.side === "away",
  );
  const side = sideHome && !sideAway ? "home" : sideAway && !sideHome ? "away" : "game";
  const selectionLogo = side === "home" ? homeLogo : side === "away" ? awayLogo : homeLogo || awayLogo;
  return { sport, homeName, awayName, homeAbbr, awayAbbr, homeLogo, awayLogo, selectionLogo, side };
}
