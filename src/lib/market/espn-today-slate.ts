import { nowEtDayKey, etDayKey } from "./slate-day.ts";
import { teamAbbrFromName, espnLogoUrl } from "./logos.ts";
import type { QuoteLine } from "./types.ts";

const ESPN_HOSTS = [
  "https://site.api.espn.com/apis/site/v2/sports",
  "https://site.web.api.espn.com/apis/site/v2/sports",
];
const UA = "Mozilla/5.0 (compatible; SportsLock/1.0; +https://x.ai)";

const SPORT_PATH: Record<string, string> = {
  NFL: "football/nfl",
  NCAAF: "football/college-football",
  MLB: "baseball/mlb",
  NBA: "basketball/nba",
  NHL: "hockey/nhl",
  NCAAB: "basketball/mens-college-basketball",
};

const SPORT_TO_ODDS: Record<string, string> = {
  NFL: "americanfootball_nfl",
  NCAAF: "americanfootball_ncaaf",
  MLB: "baseball_mlb",
  NBA: "basketball_nba",
  NHL: "icehockey_nhl",
  NCAAB: "basketball_ncaab",
};

function norm(s: string) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function lastToken(s: string) {
  const parts = (s || "").trim().split(/\s+/);
  return norm(parts[parts.length - 1] || "");
}

function teamsOverlap(aHome: string, aAway: string, bHome: string, bAway: string) {
  const ah = norm(aHome);
  const aa = norm(aAway);
  const bh = norm(bHome);
  const ba = norm(bAway);
  if (!ah || !aa || !bh || !ba) return false;
  const homeHit = ah === bh || ah.includes(bh) || bh.includes(ah) || lastToken(aHome) === lastToken(bHome);
  const awayHit = aa === ba || aa.includes(ba) || ba.includes(aa) || lastToken(aAway) === lastToken(bAway);
  return homeHit && awayHit;
}

function alreadyOnBoard(quotes: QuoteLine[], sport: string, home: string, away: string, homeAbbr?: string, awayAbbr?: string) {
  return quotes.some((q) => {
    if (q.sport && q.sport !== sport) return false;
    return teamsOverlap(q.home || q.homeAbbr || "", q.away || q.awayAbbr || "", home, away)
      || teamsOverlap(q.homeAbbr || "", q.awayAbbr || "", homeAbbr || "", awayAbbr || "");
  });
}

function scheduleQuotes(ev: {
  sport: string;
  home: string;
  away: string;
  homeAbbr: string;
  awayAbbr: string;
  start: string;
  eventId: string;
  source: string;
}): QuoteLine[] {
  const base = {
    eventId: ev.eventId,
    sport: ev.sport,
    start: ev.start,
    home: ev.home,
    away: ev.away,
    homeAbbr: ev.homeAbbr,
    awayAbbr: ev.awayAbbr,
    homeLogo: espnLogoUrl(ev.sport, ev.homeAbbr) || undefined,
    awayLogo: espnLogoUrl(ev.sport, ev.awayAbbr) || undefined,
    delayed: false,
    inPlay: false,
    source: ev.source,
    scheduleOnly: true,
  } as any;
  return [
    { ...base, marketType: "ml", side: "home", selection: ev.home, price: undefined },
    { ...base, marketType: "ml", side: "away", selection: ev.away, price: undefined },
  ];
}

function parseEspnEvents(json: any, sport: string) {
  const events = Array.isArray(json?.events) ? json.events : [];
  const out: { sport: string; home: string; away: string; homeAbbr: string; awayAbbr: string; start: string }[] = [];
  for (const e of events) {
    const comps = e?.competitions?.[0]?.competitors || [];
    const home = comps.find((c: any) => c.homeAway === "home");
    const away = comps.find((c: any) => c.homeAway === "away");
    const homeName = home?.team?.displayName || "";
    const awayName = away?.team?.displayName || "";
    if (!homeName || !awayName) continue;
    out.push({
      sport,
      home: homeName,
      away: awayName,
      homeAbbr: (home?.team?.abbreviation || teamAbbrFromName(homeName) || "").toUpperCase(),
      awayAbbr: (away?.team?.abbreviation || teamAbbrFromName(awayName) || "").toUpperCase(),
      start: e.date || e.competitions?.[0]?.date || new Date().toISOString(),
    });
  }
  return out;
}

async function fetchEspnTodayEvents(sport: string) {
  const path = SPORT_PATH[sport];
  if (!path) return [];
  const dates = nowEtDayKey().replace(/-/g, "");
  for (const host of ESPN_HOSTS) {
    try {
      const res = await fetch(`${host}/${path}/scoreboard?dates=${dates}`, {
        headers: { Accept: "application/json", "User-Agent": UA },
      });
      if (!res.ok) continue;
      const rows = parseEspnEvents(await res.json(), sport);
      if (rows.length) return rows;
    } catch {}
  }
  return [];
}

async function fetchOddsEvents(sport: string) {
  const sportKey = SPORT_TO_ODDS[sport];
  const key = process.env.ODDS_API_KEY ?? "";
  if (!sportKey || !key) return [];
  try {
    const res = await fetch(`https://api.the-odds-api.com/v4/sports/${sportKey}/events?apiKey=${key}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    const today = nowEtDayKey();
    return data.flatMap((e: any) => {
      const home = String(e.home_team || "");
      const away = String(e.away_team || "");
      const start = String(e.commence_time || "");
      if (!home || !away || !e.id) return [];
      const day = etDayKey(start);
      if (day && day < today) return [];
      const ms = new Date(start).getTime() - Date.now();
      if (Number.isFinite(ms) && ms > 48 * 3600_000) return [];
      return [{
        sport,
        home,
        away,
        homeAbbr: teamAbbrFromName(home).toUpperCase(),
        awayAbbr: teamAbbrFromName(away).toUpperCase(),
        start,
        eventId: `oddsapi-${sport}-${e.id}`,
        source: "odds-api-events",
      }];
    });
  } catch {
    return [];
  }
}

export async function mergeEspnTodaySchedule(quotes: QuoteLine[]): Promise<QuoteLine[]> {
  const sports = ["MLB", "NFL", "NCAAF", "NBA", "NHL"];
  const [espnSlates, oddsSlates] = await Promise.all([
    Promise.all(sports.map((s) => fetchEspnTodayEvents(s))),
    Promise.all(sports.map((s) => fetchOddsEvents(s))),
  ]);
  const espnEvents = espnSlates.flat();
  const oddsEvents = oddsSlates.flat();
  console.log("[slate] espn", espnEvents.length, "odds-events", oddsEvents.length);

  const extra: QuoteLine[] = [];
  for (const ev of oddsEvents) {
    if (alreadyOnBoard(quotes, ev.sport, ev.home, ev.away, ev.homeAbbr, ev.awayAbbr)) continue;
    extra.push(...scheduleQuotes(ev));
  }
  const withOdds = extra.length ? [...quotes, ...extra] : quotes;
  const extraEspn: QuoteLine[] = [];
  for (const ev of espnEvents) {
    if (alreadyOnBoard(withOdds, ev.sport, ev.home, ev.away, ev.homeAbbr, ev.awayAbbr)) continue;
    extraEspn.push(...scheduleQuotes({
      ...ev,
      eventId: `espn-${ev.sport}-${norm(ev.away)}-${norm(ev.home)}-${nowEtDayKey()}`,
      source: "espn-schedule",
    }));
  }
  const out = extraEspn.length ? [...withOdds, ...extraEspn] : withOdds;
  console.log("[slate] added", extra.length / 2, "odds events +", extraEspn.length / 2, "espn events");
  return out;
}
