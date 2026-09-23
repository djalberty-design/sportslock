/**
 * Historical ESPN Scores — fetch final scores for past dates.
 * ESPN's scoreboard API accepts a `dates=YYYYMMDD` parameter to return
 * completed games for any historical date. This is FREE with no API key.
 *
 * Used by the grading system to grade predictions from past days that
 * weren't graded in real-time (the live scoreboard only returns today).
 */

import type { LiveScore } from "./live-scores";
import { readOddsApiCache, writeOddsApiCache } from "./odds-api";

const ESPN_WEB = "https://site.web.api.espn.com/apis/site/v2/sports";
const UA = "Mozilla/5.0 (compatible; SportsLock/1.0; +https://x.ai)";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h — final scores don't change

const SPORT_PATHS: Record<string, string> = {
  NFL: "football/nfl",
  NCAAF: "football/college-football",
  NBA: "basketball/nba",
  NCAAB: "basketball/mens-college-basketball",
  MLB: "baseball/mlb",
  NHL: "hockey/nhl",
};

/** Format Date to YYYYMMDD for ESPN API (using America/New_York timezone) */
function toDateStr(d: Date): string {
  const nyDate = d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  return nyDate.replace(/-/g, "");
}

/** Fetch JSON with timeout */
async function fetchJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Parse ESPN scoreboard JSON into LiveScore[] (same format as live-scores.ts) */
function parseEspnBoard(json: any, sport: string): LiveScore[] {
  const out: LiveScore[] = [];
  for (const ev of json?.events ?? []) {
    const comp = ev.competitions?.[0];
    if (!comp) continue;
    const state = String(comp.status?.type?.state || "");
    const complete = state === "post" || Boolean(comp.status?.type?.completed);
    if (!complete) continue; // only want final scores
    const homeC = (comp.competitors ?? []).find((c: any) => c.homeAway === "home");
    const awayC = (comp.competitors ?? []).find((c: any) => c.homeAway === "away");
    const home = homeC?.team?.displayName;
    const away = awayC?.team?.displayName;
    if (!home || !away) continue;
    out.push({
      sport,
      home,
      away,
      homeAbbr: homeC?.team?.abbreviation,
      awayAbbr: awayC?.team?.abbreviation,
      homeScore: Number(homeC?.score ?? 0),
      awayScore: Number(awayC?.score ?? 0),
      inPlay: false,
      complete: true,
      source: "espn-historical",
    });
  }
  return out;
}

/** Parse MLB historical API (different format from ESPN) */
function parseMlbBoard(json: any): LiveScore[] {
  const out: LiveScore[] = [];
  for (const day of json?.dates ?? []) {
    for (const g of day.games ?? []) {
      const status = g.status?.statusCode;
      if (status !== "F" && status !== "FO") continue;
      const home = g.teams?.home?.team?.name;
      const away = g.teams?.away?.team?.name;
      if (!home || !away) continue;
      out.push({
        sport: "MLB",
        home,
        away,
        homeScore: Number(g.teams?.home?.score ?? 0),
        awayScore: Number(g.teams?.away?.score ?? 0),
        inPlay: false,
        complete: true,
        source: "mlb-historical",
      });
    }
  }
  return out;
}

/**
 * Fetch all final scores for a specific date across all sports.
 * Results are cached for 24h since final scores don't change.
 */
export async function fetchHistoricalScores(date: Date): Promise<LiveScore[]> {
  const dateStr = toDateStr(date);
  const cacheKey = `hist-scores:${dateStr}`;

  // Check cache first
  const cached = await readOddsApiCache(cacheKey);
  if (cached?.data?.scores && Array.isArray(cached.data.scores)) {
    const age = Date.now() - cached.fetchedAt.getTime();
    if (age < CACHE_TTL) {
      return cached.data.scores;
    }
  }

  const allScores: LiveScore[] = [];

  // Fetch ESPN sports (NFL, NCAAF, NBA, NCAAB)
  for (const [sport, path] of Object.entries(SPORT_PATHS)) {
    if (sport === "MLB" || sport === "NHL") continue; // handled separately
    try {
      const url = `${ESPN_WEB}/${path}/scoreboard?dates=${dateStr}`;
      const json = await fetchJson(url);
      if (json) allScores.push(...parseEspnBoard(json, sport));
    } catch {}
  }

  // MLB has its own API
  try {
    const mlbDate = date.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const mlbUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${mlbDate}&hydrate=linescore,team`;
    const mlbJson = await fetchJson(mlbUrl);
    if (mlbJson) allScores.push(...parseMlbBoard(mlbJson));
  } catch {}

  // NHL — use ESPN for historical (nhl-web API doesn't support date param easily)
  try {
    const nhlPath = SPORT_PATHS.NHL;
    const url = `${ESPN_WEB}/${nhlPath}/scoreboard?dates=${dateStr}`;
    const json = await fetchJson(url);
    if (json) allScores.push(...parseEspnBoard(json, "NHL"));
  } catch {}

  // Cache the results
  if (allScores.length > 0) {
    try {
      await writeOddsApiCache(cacheKey, { source: "historical", date: dateStr, scores: allScores });
    } catch {}
  }

  return allScores;
}

/**
 * Get all unique dates that have ungraded predictions in market_tape or prediction_logs.
 * Dates are calculated in US Eastern time (America/New_York) to match league schedules.
 */
export async function getUngradedDates(): Promise<Date[]> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql.query<{ game_date: string }>(
    `SELECT DISTINCT game_date FROM (
       SELECT (COALESCE(start, snapped_at) AT TIME ZONE 'America/New_York')::date::text AS game_date
       FROM market_tape
       WHERE (status IS NULL OR status = 'PENDING')
         AND COALESCE(start, snapped_at) < now() - interval '3 hours'
       UNION
       SELECT (created_at AT TIME ZONE 'America/New_York')::date::text AS game_date
       FROM prediction_logs
       WHERE status = 'PENDING'
         AND created_at < now() - interval '3 hours'
     ) sub
     WHERE game_date IS NOT NULL
     ORDER BY game_date DESC
     LIMIT 30`,
  );
  // Anchor at 12:00:00 UTC so date calculations never shift dates in US timezones
  return rows.map((r) => new Date(`${r.game_date}T12:00:00Z`));
}

/**
 * Fetch historical scores for all dates with ungraded predictions.
 * Returns all scores combined, ready for the grading function.
 */
export async function fetchAllHistoricalForGrading(): Promise<LiveScore[]> {
  const dates = await getUngradedDates();
  if (!dates.length) return [];

  const all: LiveScore[] = [];
  for (const d of dates) {
    const scores = await fetchHistoricalScores(d);
    all.push(...scores);
  }
  return all;
}
