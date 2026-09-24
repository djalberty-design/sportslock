import type { QuoteLine } from "./types";
import { readOddsApiCache, writeOddsApiCache } from "./odds-api";
import { mlbHalf, mlbInningLabel } from "./live-period";
export { formatLivePeriod } from "./live-period";

export type LiveScore = {
  sport: string;
  home: string;
  away: string;
  homeAbbr?: string;
  awayAbbr?: string;
  homeScore: number;
  awayScore: number;
  inPlay: boolean;
  complete: boolean;
  scheduled?: boolean;
  period?: string;
  clock?: string;
  statusText?: string;
  source: string;
};

const LIVE_TTL_MS = 2 * 60 * 1000;

const mem = (globalThis as any).__liveScoreCache || {
  scores: null as LiveScore[] | null,
  at: 0,
};
(globalThis as any).__liveScoreCache = mem;

const ESPN_WEB = "https://site.web.api.espn.com/apis/site/v2/sports";
const ESPN_UA = "Mozilla/5.0 (compatible; SportsLock/1.0; +https://x.ai)";

const ESPN_SCOREBOARD: { sport: string; path: string }[] = [
  { sport: "NFL", path: "football/nfl" },
  { sport: "NCAAF", path: "football/college-football" },
  { sport: "NBA", path: "basketball/nba" },
  { sport: "NCAAB", path: "basketball/mens-college-basketball" },
  { sport: "MLB", path: "baseball/mlb" },
  { sport: "NHL", path: "hockey/nhl" },
];

function compact(s?: string | null): string {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function lastToken(s?: string | null): string {
  const parts = String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/);
  return parts[parts.length - 1] || "";
}

export function teamsMatch(a?: string | null, b?: string | null, abbr?: string | null): boolean {
  const ca = compact(a);
  const cb = compact(b);
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  if (ca.includes(cb) || cb.includes(ca)) return true;
  const ab = compact(abbr);
  if (ab && (ca === ab || cb === ab)) return true;
  const la = lastToken(a);
  const lb = lastToken(b);
  return Boolean(la && lb && la.length >= 4 && la === lb);
}

export function applyLiveScores(quotes: QuoteLine[], scores: LiveScore[]): QuoteLine[] {
  if (!scores.length) return quotes;
  return quotes.map((q) => {
    const hit = scores.find(
      (s) =>
        (!s.sport || !q.sport || s.sport === q.sport) &&
        teamsMatch(s.home, q.home, s.homeAbbr) &&
        teamsMatch(s.away, q.away, s.awayAbbr),
    );
    if (!hit) return q;
    return {
      ...q,
      inPlay: hit.inPlay,
      homeScore: hit.homeScore,
      awayScore: hit.awayScore,
      period: hit.period,
      clock: hit.clock,
      statusText: hit.statusText,
    };
  });
}

async function fetchJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": ESPN_UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function fromMlb(json: any): LiveScore[] {
  const out: LiveScore[] = [];
  for (const day of json?.dates ?? []) {
    for (const g of day.games ?? []) {
      const state = String(g.status?.abstractGameState || "");
      const inPlay = state === "Live";
      const complete = state === "Final";
      if (!inPlay && !complete) continue;
      const home = g.teams?.home?.team?.name;
      const away = g.teams?.away?.team?.name;
      if (!home || !away) continue;
      const ls = g.linescore || {};
      const homeScore = Number(g.teams?.home?.score ?? ls.teams?.home?.runs);
      const awayScore = Number(g.teams?.away?.score ?? ls.teams?.away?.runs);
      const inning = ls.currentInning;
      const half = ls.inningState;
      out.push({
        sport: "MLB",
        home,
        away,
        homeAbbr: g.teams?.home?.team?.abbreviation,
        awayAbbr: g.teams?.away?.team?.abbreviation,
        homeScore: Number.isFinite(homeScore) ? homeScore : 0,
        awayScore: Number.isFinite(awayScore) ? awayScore : 0,
        inPlay,
        complete,
        period: inning != null ? String(inning) : undefined,
        clock: half || undefined,
        statusText: inPlay
          ? [mlbHalf(half), mlbInningLabel(ls.currentInningOrdinal || inning)].filter(Boolean).join(" ")
          : g.status?.detailedState,
        source: "mlb-statsapi",
      });
    }
  }
  return out;
}

function nhlName(team: any): string {
  return team?.placeName?.default && team?.name?.default
    ? `${team.placeName.default} ${team.name.default}`
    : team?.name?.default || team?.commonName?.default || team?.abbrev || "";
}

function fromNhl(json: any): LiveScore[] {
  const out: LiveScore[] = [];
  for (const g of json?.games ?? []) {
    const state = String(g.gameState || "").toUpperCase();
    const inPlay = state === "LIVE" || state === "CRIT";
    const complete = state === "OFF" || state === "FINAL";
    if (!inPlay && !complete) continue;
    const home = nhlName(g.homeTeam);
    const away = nhlName(g.awayTeam);
    if (!home || !away) continue;
    const period = g.periodDescriptor?.number;
    const clock = g.clock?.timeRemaining || g.clock?.display || undefined;
    out.push({
      sport: "NHL",
      home,
      away,
      homeAbbr: g.homeTeam?.abbrev,
      awayAbbr: g.awayTeam?.abbrev,
      homeScore: Number(g.homeTeam?.score ?? 0),
      awayScore: Number(g.awayTeam?.score ?? 0),
      inPlay,
      complete,
      period: period != null ? String(period) : undefined,
      clock,
      statusText: inPlay
        ? [period != null ? `P${period}` : null, clock].filter(Boolean).join(" ")
        : state,
      source: "nhl-web",
    });
  }
  return out;
}

function fromEspnBoard(json: any, sport: string): LiveScore[] {
  const out: LiveScore[] = [];
  for (const ev of json?.events ?? []) {
    const comp = ev.competitions?.[0];
    if (!comp) continue;
    const state = String(comp.status?.type?.state || "");
    const inPlay = state === "in";
    const complete = state === "post" || Boolean(comp.status?.type?.completed);
    if (!inPlay && !complete) continue;
    const homeC = (comp.competitors ?? []).find((c: any) => c.homeAway === "home");
    const awayC = (comp.competitors ?? []).find((c: any) => c.homeAway === "away");
    const home = homeC?.team?.displayName;
    const away = awayC?.team?.displayName;
    if (!home || !away) continue;
    const period = comp.status?.period;
    const clock = comp.status?.displayClock;
    out.push({
      sport,
      home,
      away,
      homeAbbr: homeC?.team?.abbreviation,
      awayAbbr: awayC?.team?.abbreviation,
      homeScore: Number(homeC?.score ?? 0),
      awayScore: Number(awayC?.score ?? 0),
      inPlay,
      complete,
      period: period != null ? String(period) : undefined,
      clock,
      statusText: comp.status?.type?.shortDetail || comp.status?.type?.detail,
      source: "espn-scoreboard",
    });
  }
  return out;
}

async function pullFresh(): Promise<LiveScore[]> {
  const bags: LiveScore[][] = [];
  try {
    const mlb = await fetchJson("https://statsapi.mlb.com/api/v1/schedule?sportId=1&hydrate=linescore,team");
    if (mlb) bags.push(fromMlb(mlb));
  } catch {}
  try {
    const nhl = await fetchJson("https://api-web.nhle.com/v1/score/now");
    if (nhl) bags.push(fromNhl(nhl));
  } catch {}

  for (const row of ESPN_SCOREBOARD) {
    try {
      const board = await fetchJson(`${ESPN_WEB}/${row.path}/scoreboard`);
      if (board) bags.push(fromEspnBoard(board, row.sport));
    } catch {}
  }
  return bags.flat();
}

export async function fetchLiveScores(): Promise<LiveScore[]> {
  if (mem.scores && Date.now() - mem.at < LIVE_TTL_MS) return mem.scores;
  const cached = await readOddsApiCache("live-scores");
  if (cached?.data?.scores && Array.isArray(cached.data.scores)) {
    const age = Date.now() - cached.fetchedAt.getTime();
    if (age < LIVE_TTL_MS) {
      mem.scores = cached.data.scores;
      mem.at = cached.fetchedAt.getTime();
      return mem.scores;
    }
  }
  const scores = await pullFresh();
  mem.scores = scores;
  mem.at = Date.now();
  try {
    await writeOddsApiCache("live-scores", { source: "live-scores", scores });
  } catch {}
  return scores;
}
