/** ESPN public team marks — same art Hard Rock shows next to the matchup. */

import { NCAA_ID as NCAA_CATALOG } from "./ncaa-ids";

const LEAGUE_LOGO: Record<string, string> = {
  NFL: "nfl",
  NBA: "nba",
  MLB: "mlb",
  NHL: "nhl",
  NCAAF: "ncaa",
  NCAAB: "ncaa",
  CFB: "ncaa",
  CBB: "ncaa",
};

const TEAM_ABBR: Record<string, string> = {
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

export function teamAbbrFromName(fullName: string): string {
  const mapped = TEAM_ABBR[fullName];
  if (mapped) return mapped;
  const official = officialTeamName("", fullName);
  if (official && TEAM_ABBR[official]) return TEAM_ABBR[official];
  const lower = fullName.toLowerCase();
  for (const [key, val] of Object.entries(TEAM_ABBR)) {
    if (key.toLowerCase() === lower) return val;
  }
  const last = fullName.split(" ").pop() || fullName;
  return last.substring(0, 3).toLowerCase();
}

export function normalizeSport(sport?: string | null): string {
  const raw = String(sport || "").trim();
  const upper = raw.toUpperCase();
  if (LEAGUE_LOGO[upper]) return upper;
  const key = raw.toLowerCase();
  if (key.includes("ncaaf") || key.includes("college-football") || key.includes("americanfootball_ncaaf") || key === "cfb") return "NCAAF";
  if (key.includes("ncaab") || key.includes("college-basket") || key.includes("basketball_ncaab") || key === "cbb") return "NCAAB";
  if (key.includes("nfl") || key.includes("americanfootball_nfl")) return "NFL";
  if (key.includes("mlb") || key.includes("baseball_mlb")) return "MLB";
  if (key.includes("nba") || key.includes("basketball_nba")) return "NBA";
  if (key.includes("nhl") || key.includes("icehockey_nhl")) return "NHL";
  return upper;
}

export function isCollegeSport(sport?: string | null): boolean {
  const s = normalizeSport(sport);
  return s === "NCAAF" || s === "NCAAB" || s.includes("NCAA") || s === "CFB" || s === "CBB" || s.includes("COLLEGE");
}

function isLetterNcaaLogo(url?: string | null): boolean {
  return Boolean(url && /teamlogos\/ncaa\/500\/[a-z]+\.png/i.test(url));
}

export function espnLogoUrl(sport: string, abbr?: string, espnTeamId?: string): string | null {
  const leagueKey = normalizeSport(sport);
  const id = String(espnTeamId || "").replace(/[^0-9]/g, "");
  if (id && isCollegeSport(leagueKey)) return `https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png`;
  const league = LEAGUE_LOGO[leagueKey] || (isCollegeSport(leagueKey) ? "ncaa" : undefined);
  if (!league) return null;
  if (league === "ncaa") {
    if (id) return `https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png`;
    return null;
  }
  if (!abbr) return null;
  const a = abbr.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!a) return null;
  return `https://a.espncdn.com/i/teamlogos/${league}/500/${a}.png`;
}

export function teamNick(full: string | undefined, abbr?: string, short?: string): string {
  const s = (short || "").trim();
  if (s && s.length <= 18 && !/\bat\b/i.test(s)) return s;
  const parts = (full || "").trim().split(/\s+/);
  if (parts.length >= 2) return parts.slice(-1)[0] ?? (full || "");
  return full || "";
}

function compactKey(s: string): string {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const GENERIC_TOKEN = new Set(["state", "university", "college", "city", "bay", "sox", "team", "the", "of", "st", "fc"]);

const NICK_TO_OFFICIAL: Record<string, string> = {
  rays: "Tampa Bay Rays", ray: "Tampa Bay Rays", tb: "Tampa Bay Rays",
  astros: "Houston Astros", ast: "Houston Astros", hou: "Houston Astros",
  athletics: "Oakland Athletics", as: "Oakland Athletics", oak: "Oakland Athletics", ath: "Oakland Athletics",
  yankees: "New York Yankees", mets: "New York Mets", dodgers: "Los Angeles Dodgers",
  giants: "San Francisco Giants", cubs: "Chicago Cubs", braves: "Atlanta Braves",
  phillies: "Philadelphia Phillies", guardians: "Cleveland Guardians", orioles: "Baltimore Orioles",
  twins: "Minnesota Twins", mariners: "Seattle Mariners", rangers: "Texas Rangers",
  angels: "Los Angeles Angels", padres: "San Diego Padres", rockies: "Colorado Rockies",
  diamondbacks: "Arizona Diamondbacks", brewers: "Milwaukee Brewers", cardinals: "St. Louis Cardinals",
  pirates: "Pittsburgh Pirates", reds: "Cincinnati Reds", nationals: "Washington Nationals",
  marlins: "Miami Marlins", royals: "Kansas City Royals", tigers: "Detroit Tigers",
  bluejays: "Toronto Blue Jays", jays: "Toronto Blue Jays",
  lions: "Detroit Lions", chiefs: "Kansas City Chiefs", bills: "Buffalo Bills",
  eagles: "Philadelphia Eagles", cowboys: "Dallas Cowboys", packers: "Green Bay Packers",
  niners: "San Francisco 49ers", ravens: "Baltimore Ravens", steelers: "Pittsburgh Steelers",
  dolphins: "Miami Dolphins", jets: "New York Jets", patriots: "New England Patriots",
  vikings: "Minnesota Vikings", bears: "Chicago Bears", saints: "New Orleans Saints",
  buccaneers: "Tampa Bay Buccaneers", bucs: "Tampa Bay Buccaneers", seahawks: "Seattle Seahawks",
  rams: "Los Angeles Rams", chargers: "Los Angeles Chargers", broncos: "Denver Broncos",
  raiders: "Las Vegas Raiders", commanders: "Washington Commanders", texans: "Houston Texans",
  colts: "Indianapolis Colts", jaguars: "Jacksonville Jaguars", titans: "Tennessee Titans",
  browns: "Cleveland Browns", bengals: "Cincinnati Bengals", falcons: "Atlanta Falcons",
  panthers: "Carolina Panthers", lakers: "Los Angeles Lakers", celtics: "Boston Celtics",
  warriors: "Golden State Warriors", knicks: "New York Knicks", nets: "Brooklyn Nets",
  heat: "Miami Heat", bucks: "Milwaukee Bucks", sixers: "Philadelphia 76ers",
  nuggets: "Denver Nuggets", timberwolves: "Minnesota Timberwolves", thunder: "Oklahoma City Thunder",
  mavericks: "Dallas Mavericks", suns: "Phoenix Suns", kings: "Sacramento Kings",
  clippers: "Los Angeles Clippers", pelicans: "New Orleans Pelicans", grizzlies: "Memphis Grizzlies",
  rockets: "Houston Rockets", spurs: "San Antonio Spurs", jazz: "Utah Jazz",
  pistons: "Detroit Pistons", cavaliers: "Cleveland Cavaliers", hawks: "Atlanta Hawks",
  magic: "Orlando Magic", hornets: "Charlotte Hornets", blazers: "Portland Trail Blazers",
  bulls: "Chicago Bulls", pacers: "Indiana Pacers", lightning: "Tampa Bay Lightning",
  bruins: "Boston Bruins", islanders: "New York Islanders", devils: "New Jersey Devils",
  flyers: "Philadelphia Flyers", penguins: "Pittsburgh Penguins", capitals: "Washington Capitals",
  hurricanes: "Carolina Hurricanes", leafs: "Toronto Maple Leafs", canadiens: "Montreal Canadiens",
  senators: "Ottawa Senators", sabres: "Buffalo Sabres", redwings: "Detroit Red Wings",
  blackhawks: "Chicago Blackhawks", wild: "Minnesota Wild", flames: "Calgary Flames",
  oilers: "Edmonton Oilers", canucks: "Vancouver Canucks", kraken: "Seattle Kraken",
  knights: "Vegas Golden Knights", avalanche: "Colorado Avalanche", stars: "Dallas Stars",
  predators: "Nashville Predators", blues: "St. Louis Blues", sharks: "San Jose Sharks",
  ducks: "Anaheim Ducks",
};

const NCAA_ID: Record<string, { id: string; name: string }> = { ...NCAA_CATALOG };

const OFFICIAL_BY_KEY: Record<string, string> = {};
for (const name of Object.keys(TEAM_ABBR)) {
  OFFICIAL_BY_KEY[compactKey(name)] = name;
  OFFICIAL_BY_KEY[TEAM_ABBR[name]] = name;
  const nick = name.split(/\s+/).pop() || "";
  if (nick && !GENERIC_TOKEN.has(nick.toLowerCase()) && nick.length >= 4) {
    OFFICIAL_BY_KEY[compactKey(nick)] = name;
  }
}
for (const [k, v] of Object.entries(NICK_TO_OFFICIAL)) OFFICIAL_BY_KEY[k] = v;

export function officialTeamName(sport: string, raw?: string | null, hint?: string | null): string {
  const league = normalizeSport(sport);
  const source = String(raw || "").trim();
  const hintText = String(hint || "").trim();
  if (isCollegeSport(league)) {
    const fromHint = NCAA_ID[compactKey(hintText)];
    if (fromHint && source.length <= 4) return fromHint.name;
    const fromRaw = NCAA_ID[compactKey(source)];
    if (fromRaw) return fromRaw.name;
  }
  if (!source) return hintText;
  if (OFFICIAL_BY_KEY[compactKey(source)]) return OFFICIAL_BY_KEY[compactKey(source)];
  const lower = source.toLowerCase();
  for (const name of Object.keys(TEAM_ABBR)) {
    if (name.toLowerCase() === lower) return name;
    if (source.length >= 4 && name.toLowerCase().endsWith(lower) && !GENERIC_TOKEN.has(lower)) return name;
  }
  if (source.split(/\s+/).length >= 2) return source;
  if (hintText.split(/\s+/).length >= 2 && compactKey(hintText).includes(compactKey(source))) return hintText;
  return source;
}

export function ncaaIdFor(name?: string | null): string | undefined {
  const raw = String(name || "").trim();
  if (!raw) return undefined;
  const direct = NCAA_ID[compactKey(raw)]?.id;
  if (direct) return direct;
  const parts = raw.split(/\s+/).filter(Boolean);
  for (let i = parts.length; i >= 1; i--) {
    const key = compactKey(parts.slice(0, i).join(" "));
    if (!key || GENERIC_TOKEN.has(key) || key.length < 4) continue;
    const hit = NCAA_ID[key]?.id;
    if (hit) return hit;
  }
  return undefined;
}

export function resolveTeamLogo(
  sport?: string,
  opts?: { logo?: string | null; abbr?: string | null; name?: string | null; espnTeamId?: string | null },
): string | null {
  const league = normalizeSport(sport);
  const given = String(opts?.logo || "");
  if (given && !isLetterNcaaLogo(given) && !(given.includes("/ncaa/") && !isCollegeSport(league))) return given;
  if (given.includes("/ncaa/") && !isCollegeSport(league)) {
    /* fall through to pro league path */
  } else if (given && !isLetterNcaaLogo(given)) {
    return given;
  }
  const official = officialTeamName(league || "", opts?.name || opts?.abbr || "");
  if (isCollegeSport(league)) {
    const ncaaId = String(opts?.espnTeamId || ncaaIdFor(official) || ncaaIdFor(opts?.name) || ncaaIdFor(opts?.abbr) || "").replace(/[^0-9]/g, "");
    if (ncaaId) return espnLogoUrl("NCAAF", undefined, ncaaId);
  }
  const abbr = TEAM_ABBR[official] || (opts?.abbr && String(opts.abbr).trim().toLowerCase()) || teamAbbrFromName(official);
  return espnLogoUrl(league || "", abbr || undefined);
}

export function matchSnapshotEvent(snapshot: any, leg: any) {
  const quotes: any[] = snapshot?.quotes ?? [];
  const briefs: any[] = snapshot?.briefs ?? [];
  if (leg?.eventId) {
    const quote = quotes.find((q) => q.eventId === leg.eventId);
    const brief = briefs.find((b) => b.eventId === leg.eventId);
    if (quote || brief) return { quote, brief };
  }
  const sport = String(leg?.sport || "");
  const homeK = compactKey(leg?.home || "");
  const awayK = compactKey(leg?.away || "");
  const quote = quotes.find((q) => {
    if (sport && q.sport && q.sport !== sport) return false;
    const h = compactKey(`${q.home || ""}${q.homeAbbr || ""}`);
    const a = compactKey(`${q.away || ""}${q.awayAbbr || ""}`);
    const homeHit = !homeK || h.includes(homeK) || homeK.includes(compactKey(q.home || "")) || homeK === compactKey(q.homeAbbr || "");
    const awayHit = !awayK || a.includes(awayK) || awayK.includes(compactKey(q.away || "")) || awayK === compactKey(q.awayAbbr || "");
    return homeHit && awayHit;
  });
  const brief = quote ? briefs.find((b) => b.eventId === quote.eventId) : undefined;
  return { quote, brief };
}

export function resolveLegTeam(leg: any, quote?: any) {
  const sport = String(leg?.sport || quote?.sport || "");
  const rawHome = String(leg?.home || quote?.home || "");
  const rawAway = String(leg?.away || quote?.away || "");
  const sel = String(leg?.selection || "");
  const homeName = officialTeamName(sport, rawHome || quote?.home, sel);
  const awayName = officialTeamName(sport, rawAway || quote?.away, "");
  const homeAbbr = TEAM_ABBR[homeName] || quote?.homeAbbr || (homeName ? teamAbbrFromName(homeName) : undefined);
  const awayAbbr = TEAM_ABBR[awayName] || quote?.awayAbbr || (awayName ? teamAbbrFromName(awayName) : undefined);
  const college = isCollegeSport(sport);
  const homeLogo = resolveTeamLogo(sport, {
    logo: leg?.homeLogo || quote?.homeLogo,
    abbr: homeAbbr,
    name: homeName,
    espnTeamId: college ? quote?.homeEspnId || leg?.homeEspnId || ncaaIdFor(homeName) : quote?.homeEspnId,
  });
  const awayLogo = resolveTeamLogo(sport, {
    logo: leg?.awayLogo || quote?.awayLogo,
    abbr: awayAbbr,
    name: awayName,
    espnTeamId: college ? quote?.awayEspnId || leg?.awayEspnId || ncaaIdFor(awayName) : quote?.awayEspnId,
  });
  const selLow = sel.toLowerCase();
  const sideHome = Boolean(
    (homeName && sel.includes(homeName)) || (rawHome && sel.includes(rawHome)) || (homeAbbr && selLow.includes(String(homeAbbr).toLowerCase())) || leg?.side === "home",
  );
  const sideAway = Boolean(
    (awayName && sel.includes(awayName)) || (rawAway && sel.includes(rawAway)) || (awayAbbr && selLow.includes(String(awayAbbr).toLowerCase())) || leg?.side === "away",
  );
  const side = sideHome && !sideAway ? "home" : sideAway && !sideHome ? "away" : "game";
  const selectionLogo = side === "home" ? homeLogo : side === "away" ? awayLogo : homeLogo || awayLogo;
  const matchup = [awayName, homeName].filter(Boolean).join(" at ") || "Matchup";
  return { sport, homeName, awayName, homeAbbr, awayAbbr, homeLogo, awayLogo, selectionLogo, side, matchup };
}
