import { nowEtDayKey } from "./slate-day.ts";
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

function parseEvents(json: any, sport: string) {
  const events = Array.isArray(json?.events) ? json.events : [];
  const out: {
    sport: string;
    home: string;
    away: string;
    homeAbbr: string;
    awayAbbr: string;
    start: string;
  }[] = [];
  for (const e of events) {
    const comps = e?.competitions?.[0]?.competitors || [];
    const home = comps.find((c: any) => c.homeAway === "home");
    const away = comps.find((c: any) => c.homeAway === "away");
    const homeName = home?.team?.displayName || "";
    const awayName = away?.team?.displayName || "";
    if (!homeName || !awayName) continue;
    const homeAbbr = (home?.team?.abbreviation || teamAbbrFromName(homeName) || "").toUpperCase();
    const awayAbbr = (away?.team?.abbreviation || teamAbbrFromName(awayName) || "").toUpperCase();
    out.push({
      sport,
      home: homeName,
      away: awayName,
      homeAbbr,
      awayAbbr,
      start: e.date || e.competitions?.[0]?.date || new Date().toISOString(),
    });
  }
  return out;
}

export async function fetchEspnTodayEvents(sport: string) {
  const path = SPORT_PATH[sport];
  if (!path) return [];
  const dates = nowEtDayKey().replace(/-/g, "");
  for (const host of ESPN_HOSTS) {
    try {
      const res = await fetch(`${host}/${path}/scoreboard?dates=${dates}`, {
        headers: { Accept: "application/json", "User-Agent": UA },
      });
      if (!res.ok) continue;
      const json = await res.json();
      const rows = parseEvents(json, sport);
      if (rows.length) return rows;
    } catch {
      // try next host
    }
  }
  return [];
}

export async function mergeEspnTodaySchedule(quotes: QuoteLine[]): Promise<QuoteLine[]> {
  const sports = ["MLB", "NFL", "NCAAF", "NBA", "NHL"];
  const slates = await Promise.all(sports.map((s) => fetchEspnTodayEvents(s)));
  const events = slates.flat();
  if (!events.length) {
    console.warn("[espn-today] no scoreboard events for", nowEtDayKey());
    return quotes;
  }
  console.log("[espn-today]", events.length, "espn events", nowEtDayKey());

  const extra: QuoteLine[] = [];
  for (const ev of events) {
    const already = quotes.some((q) => {
      if (q.sport && q.sport !== ev.sport) return false;
      return teamsOverlap(q.home || q.homeAbbr || "", q.away || q.awayAbbr || "", ev.home, ev.away)
        || teamsOverlap(q.homeAbbr || "", q.awayAbbr || "", ev.homeAbbr, ev.awayAbbr);
    });
    if (already) continue;
    const eventId = `espn-${ev.sport}-${norm(ev.away)}-${norm(ev.home)}-${nowEtDayKey()}`;
    const base = {
      eventId,
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
      source: "espn-schedule",
      scheduleOnly: true,
    } as any;
    extra.push({ ...base, marketType: "ml", side: "home", selection: ev.home, price: undefined });
    extra.push({ ...base, marketType: "ml", side: "away", selection: ev.away, price: undefined });
  }
  console.log("[espn-today] added", extra.length / 2, "schedule-only games");
  return extra.length ? [...quotes, ...extra] : quotes;
}
