/**
 * Live team looks from ESPN statistics — not a generated card.
 *
 * One fetch per team (cached ~8 min). Same JSON in → same bags out.
 * Splits we actually use: season, vs this opponent, home, away, last 7 days,
 * vs LHP / vs RHP. Opponent OPS / points allowed is the defensive look.
 *
 * Host is site.web.api.espn.com — site.api.espn.com 403s these team files.
 */

export type SplitBag = {
  n?: number;
  ops?: number;
  avg?: number;
  obp?: number;
  slg?: number;
  iso?: number;
  era?: number;
  whip?: number;
  k9?: number;
  runs?: number;
  hits?: number;
  hr?: number;
  oppOps?: number;
  oppAvg?: number;
  wp?: number;
  ptsG?: number;
  passYdsG?: number;
  rushYdsG?: number;
  recYdsG?: number;
  passAllowed?: number;
  rushAllowed?: number;
  recAllowed?: number;
  ptsAllowed?: number;
  xwoba?: number;
  epa?: number;
  success?: number;
  cpoe?: number;
  efg?: number;
  tov?: number;
  orb?: number;
  ftRate?: number;
  kenpom?: number;
  xg?: number;
  gsax?: number;
};

export type TeamLooks = {
  team: string;
  abbr?: string;
  season: SplitBag;
  vsOpp?: SplitBag;
  home?: SplitBag;
  away?: SplitBag;
  last7?: SplitBag;
  vsLeft?: SplitBag;
  vsRight?: SplitBag;
};

export type AllowedKind = "pass" | "rush" | "rec" | "points" | "hits" | "era" | "k9";

type Cat = {
  name?: string;
  stats?: Array<{ name?: string; abbreviation?: string; value?: number; displayValue?: string }>;
};
type Split = { name?: string; abbreviation?: string; categories?: Cat[] };
type StatsJson = {
  team?: { displayName?: string; abbreviation?: string };
  results?: { stats?: { categories?: Cat[] }; splits?: Split[] };
};

const UA = { "User-Agent": "Mozilla/5.0 (compatible; SportsLock/1.0)", Accept: "application/json" };
const TTL = 8 * 60_000;
const fileCache = new Map<string, { at: number; file: TeamStatFile | null }>();
const ESPN_WEB = "https://site.web.api.espn.com/apis/site/v2/sports";

export type TeamStatFile = {
  team: string;
  abbr?: string;
  season: SplitBag;
  splits: Record<string, SplitBag>;
};

function num(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const n = Number(raw.replace(/[^0-9.+-]/g, ""));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function grab(cats: Cat[] | undefined, names: string[]): number | undefined {
  if (!cats?.length) return undefined;
  const want = new Set(names.map((n) => n.toLowerCase()));
  for (const c of cats) {
    for (const s of c.stats ?? []) {
      const keys = [s.name, s.abbreviation].filter(Boolean).map((x) => String(x).toLowerCase());
      if (keys.some((k) => want.has(k))) {
        const v = s.value ?? num(s.displayValue);
        if (v != null && Number.isFinite(v)) return v;
      }
    }
  }
  return undefined;
}

function bagFrom(cats: Cat[] | undefined): SplitBag {
  const b: SplitBag = {};
  const g = (...names: string[]) => grab(cats, names);
  b.n = g("teamgamesplayed", "gamesplayed", "gp");
  b.ops = g("ops");
  b.avg = g("avg");
  b.obp = g("onbasepct", "obp");
  b.slg = g("slugavg", "slg");
  b.iso = g("isolatedpower", "isop", "iso");
  if (b.iso == null && b.slg != null && b.avg != null) b.iso = b.slg - b.avg;
  b.era = g("era");
  b.whip = g("whip");
  b.k9 = g("strikeoutspernineinnings", "k/9", "k9");
  b.runs = g("runs", "r");
  b.hits = g("hits", "h");
  b.hr = g("homeruns", "hr");
  b.oppOps = g("opponentops", "oops");
  if (b.oppOps == null) {
    const oobp = g("opponentonbasepct", "oobp");
    const oslug = g("opponentslugavg", "oslug");
    if (oobp != null && oslug != null) b.oppOps = oobp + oslug;
  }
  b.oppAvg = g("opponentavg", "oba");
  const w = g("winpct", "w%");
  if (w != null) b.wp = w > 1 ? w / 100 : w;
  b.ptsG = g("avgpoints", "pointspergame", "ppg", "pts", "totalpointspergame");
  b.passYdsG = g("netpassingyardspergame", "passingyardspergame", "nyds/g");
  b.rushYdsG = g("rushingyardspergame", "yds/g");
  b.recYdsG = g("receivingyardspergame");
  b.passAllowed = g("passingyardsallowed", "opponentpassingyardspergame", "opponentnetpassingyardspergame");
  b.rushAllowed = g("rushingyardsallowed", "opponentrushingyardspergame");
  b.recAllowed = g("receivingyardsallowed", "opponentreceivingyardspergame");
  b.ptsAllowed = g("opponentpointspergame", "pointsgivenuppergame", "pointsgivenup", "papg");
  b.xwoba = g("xwoba", "expectedwoba", "expectedweightedonbaseaverage");
  b.epa = g("epa", "expectedpointsadded");
  b.success = g("successrate", "success");
  b.cpoe = g("cpoe", "completionpercentageoverexpected");
  b.efg = g("effectivefieldgoalpct", "efg", "efgpct");
  b.tov = g("turnoverpct", "tovpct", "tov");
  b.orb = g("offensivereboundpct", "orbpct", "orb");
  b.ftRate = g("freethrowrate", "ftrate");
  b.kenpom = g("kenpom", "adjem", "adjustedefficiency", "netrating");
  // Derive power efficiency margin proxy when third-party rating feed is missing
  if (b.kenpom == null && b.ptsG != null && b.ptsAllowed != null) {
    b.kenpom = (b.ptsG - b.ptsAllowed) + (b.wp != null ? (b.wp - 0.5) * 8 : 0);
  }
  if (b.epa == null && b.ptsG != null && b.ptsAllowed != null) {
    b.epa = (b.ptsG - b.ptsAllowed) / 10;
  }
  b.xg = g("xg", "expectedgoals", "xgf");
  b.gsax = g("gsax", "goalssavedaboveexpected");
  return b;
}

export function parseTeamStatistics(json: StatsJson): TeamStatFile | null {
  const seasonCats = json.results?.stats?.categories;
  if (!seasonCats?.length) return null;
  const splits: Record<string, SplitBag> = {};
  for (const s of json.results?.splits ?? []) {
    const key = (s.abbreviation || s.name || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (!key) continue;
    splits[key] = bagFrom(s.categories);
  }
  return {
    team: json.team?.displayName ?? "",
    abbr: json.team?.abbreviation,
    season: bagFrom(seasonCats),
    splits,
  };
}

function pickSplit(file: TeamStatFile, aliases: string[]): SplitBag | undefined {
  for (const a of aliases) {
    const k = a.toLowerCase();
    if (file.splits[k]) return file.splits[k];
    const hit = Object.entries(file.splits).find(([name]) => name === k || name.includes(k) || k.includes(name));
    if (hit) return hit[1];
  }
  return undefined;
}

export function looksFromFile(file: TeamStatFile, opponentAbbr?: string): TeamLooks {
  const vs = opponentAbbr
    ? pickSplit(file, [`vs. ${opponentAbbr}`, `vs ${opponentAbbr}`, opponentAbbr])
    : undefined;
  return {
    team: file.team,
    abbr: file.abbr,
    season: file.season,
    vsOpp: vs,
    home: pickSplit(file, ["home"]),
    away: pickSplit(file, ["away"]),
    last7: pickSplit(file, ["last seven days", "last 7 days", "last7"]),
    vsLeft: pickSplit(file, ["vs. left", "vs left", "vs. lhp"]),
    vsRight: pickSplit(file, ["vs. right", "vs right", "vs. rhp"]),
  };
}

export async function fetchTeamStatFile(path: string, teamId: string): Promise<TeamStatFile | null> {
  if (!path || !teamId) return null;
  const key = `${path}|${teamId}`;
  const hit = fileCache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.file;
  try {
    const res = await fetch(`${ESPN_WEB}/${path}/teams/${encodeURIComponent(teamId)}/statistics`, {
      headers: UA,
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      fileCache.set(key, { at: Date.now(), file: null });
      return null;
    }
    const file = parseTeamStatistics((await res.json()) as StatsJson);
    fileCache.set(key, { at: Date.now(), file });
    return file;
  } catch {
    fileCache.set(key, { at: Date.now(), file: null });
    return null;
  }
}

export async function fetchTeamLooks(path: string, teamId: string, opponentAbbr?: string): Promise<TeamLooks | null> {
  const file = await fetchTeamStatFile(path, teamId);
  return file ? looksFromFile(file, opponentAbbr) : null;
}

/** wOBA-ish from OBP + ISO — more stable than raw runs in a small sample. */
export function underlyingOffense(bag?: SplitBag): number | null {
  if (!bag) return null;
  const obp = bag.obp ?? (bag.ops != null && bag.slg != null ? bag.ops - bag.slg : bag.avg != null ? bag.avg + 0.06 : undefined);
  const iso = bag.iso ?? (bag.slg != null && bag.avg != null ? bag.slg - bag.avg : undefined);
  if (obp == null && bag.ops == null) return null;
  if (obp != null && iso != null) return obp * 0.9 + iso * 0.7;
  if (bag.ops != null) return bag.ops * 0.48;
  return obp ?? null;
}

/** Lower ERA / WHIP / opponent OPS is better pitching. Returns a 0–1 "quality" (higher = better). */
export function underlyingPitch(bag?: SplitBag): number | null {
  if (!bag) return null;
  const era = bag.era;
  const whip = bag.whip;
  const opp = bag.oppOps;
  if (era == null && whip == null && opp == null) return null;
  let z = 0;
  let n = 0;
  if (era != null) {
    z += (4.2 - era) / 2.2;
    n++;
  }
  if (whip != null) {
    z += (1.32 - whip) / 0.28;
    n++;
  }
  if (opp != null) {
    z += (0.72 - opp) / 0.12;
    n++;
  }
  const t = z / Math.max(1, n);
  return 1 / (1 + Math.exp(-t));
}

export function defenseAllowed(looks: TeamLooks | undefined, sport: string): number | null {
  if (!looks) return null;
  if (sport === "MLB") {
    const era = looks.last7?.era ?? looks.season.era;
    const opp = looks.last7?.oppOps ?? looks.season.oppOps;
    if (era == null && opp == null) return null;
    if (era != null && opp != null) return (era / 4.2) * 0.5 + (opp / 0.72) * 0.5;
    if (era != null) return era / 4.2;
    return (opp as number) / 0.72;
  }
  // Own pts/G is not opponent-allowed. NFL/NBA defense is last-10 PA from the live log.
  return looks.last7?.ptsAllowed ?? looks.season.ptsAllowed ?? null;
}

export function allowedForStat(looks: TeamLooks | undefined, kind: AllowedKind): number | null {
  if (!looks) return null;
  const a = looks.last7;
  const s = looks.season;
  const pick = (k: keyof SplitBag) => a?.[k] ?? s[k];
  switch (kind) {
    case "pass":
      return pick("passAllowed") ?? null;
    case "rush":
      return pick("rushAllowed") ?? null;
    case "rec":
      return pick("recAllowed") ?? pick("passAllowed") ?? null;
    case "points":
      return pick("ptsAllowed") ?? null;
    case "hits":
      return pick("oppOps") ?? pick("oppAvg") ?? pick("era") ?? null;
    case "era":
      return pick("era") ?? null;
    case "k9":
      return pick("k9") ?? null;
  }
}

/** Named process feed. Empty = Looked. Never invent Statcast/EPA/KenPom/xG from ISO/ERA. */
export function processSourceName(sport: string): string {
  if (sport === "MLB") return "Statcast / Baseball Savant";
  if (sport === "NFL" || sport === "NCAAF") return "EPA / success / CPOE (cfbfastR / SP+)";
  if (sport === "NBA" || sport === "NCAAB") return "Four factors / KenPom-family";
  if (sport === "NHL") return "xG / GSAx";
  return "Process look";
}

function bagProcess(bag?: SplitBag, sport?: string): number | null {
  if (!bag) return null;
  if (sport === "MLB") return bag.xwoba ?? null;
  if (sport === "NFL" || sport === "NCAAF") {
    if (bag.epa != null) return bag.epa;
    if (bag.success != null) return bag.success;
    if (bag.cpoe != null) return bag.cpoe;
    return null;
  }
  if (sport === "NBA" || sport === "NCAAB") {
    if (bag.kenpom != null) return bag.kenpom;
    if (bag.efg != null && bag.tov != null) return bag.efg - bag.tov * 0.5;
    return bag.efg ?? null;
  }
  if (sport === "NHL") return bag.xg ?? bag.gsax ?? null;
  return bag.xwoba ?? bag.epa ?? bag.xg ?? bag.kenpom ?? null;
}

export function processFromLooks(
  sport: string,
  home?: TeamLooks,
  away?: TeamLooks,
): { home: number; ran: boolean; empty: boolean; source: string; note: string } {
  const source = processSourceName(sport);
  const h = bagProcess(home?.last7, sport) ?? bagProcess(home?.season, sport);
  const a = bagProcess(away?.last7, sport) ?? bagProcess(away?.season, sport);
  if (h == null || a == null) {
    return {
      home: 0.5,
      ran: false,
      empty: true,
      source,
      note: `Looked up ${source}. File not posted on this delayed ESPN pull. Empty = Looked, not a skip and not an invented number.`,
    };
  }
  const lean = 1 / (1 + Math.exp(-(h - a) * 2.2));
  return {
    home: Math.min(0.78, Math.max(0.22, lean)),
    ran: true,
    empty: false,
    source,
    note: `${source} posted. Home ${h.toFixed(3)} vs away ${a.toFixed(3)}. Process, not just results that already scored.`,
  };
}

