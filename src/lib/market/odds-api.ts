import { getSql } from "../db.ts";
import { etDayKey, nowEtDayKey } from "./slate-day.ts";
import { planOddsCalls, recordOddsCalls } from "./quota-store.ts";
import { fillMissingEvents } from "./odds-events-fill.ts";

export const ODDS_API_KEY = process.env.ODDS_API_KEY ?? "";

export const CACHE_TTL = 1000 * 60 * 60 * 26;

const globalCache = (globalThis as any).__oddsApiCache || {
  mains: null as any,
  mainsLastFetch: 0,
  mainsEtDay: "" as string,
  props: {} as Record<string, any>,
  quotaRemaining: null as number | null,
  activeProps: null as any[] | null,
  activePropsLastFetch: 0,
};
(globalThis as any).__oddsApiCache = globalCache;

async function readDbCache(key: string): Promise<{ data: any; fetchedAt: Date } | null> {
  try {
    const sql = await getSql();
    const rows = await sql<{ data: any; fetched_at: string }>`
      SELECT data, fetched_at FROM odds_api_cache WHERE key = ${key}
    `;
    if (rows.length === 0) return null;
    return { data: rows[0].data, fetchedAt: new Date(rows[0].fetched_at) };
  } catch (e) {
    console.error("[odds-api] DB cache read failed:", e);
    return null;
  }
}

export async function readOddsApiCache(key: string) {
  return readDbCache(key);
}

export async function writeOddsApiCache(key: string, data: any): Promise<void> {
  try {
    if (key.startsWith("enriched-props:") || key === "mains") {
      globalCache.activeProps = null;
      globalCache.activePropsLastFetch = 0;
    }
    const sql = await getSql();
    await sql`
      INSERT INTO odds_api_cache (key, data, fetched_at)
      VALUES (${key}, ${JSON.stringify(data)}, NOW())
      ON CONFLICT (key) DO UPDATE SET data = ${JSON.stringify(data)}, fetched_at = NOW()
    `;
  } catch (e) {
    console.error("[odds-api] DB cache write failed:", e);
  }
}

export async function getActiveCachedProps(): Promise<any[]> {
  const now = Date.now();
  if (globalCache.activeProps && Array.isArray(globalCache.activeProps) && now - globalCache.activePropsLastFetch < 90_000) {
    return globalCache.activeProps;
  }
  try {
    const sql = await getSql();
    const rows = await sql<{ data: any; fetched_at: string }>`
      SELECT data, fetched_at FROM odds_api_cache
      WHERE key LIKE 'enriched-props:%'
      AND fetched_at > NOW() - INTERVAL '36 hours'
      ORDER BY fetched_at DESC
    `;
    const out: any[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      if (!Array.isArray(r.data)) continue;
      for (const p of r.data) {
        if (!p || typeof p !== "object") continue;
        if (p.eventId && !p.eventId.startsWith("oddsapi-") && p.sport) {
          p.eventId = `oddsapi-${p.sport}-${p.eventId}`;
        }
        if (p.start) {
          const s = new Date(p.start).getTime();
          if (!isNaN(s) && s < now) continue;
        }
        const key = `${p.eventId || ""}|${p.selection || ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(p);
      }
    }
    globalCache.activeProps = out;
    globalCache.activePropsLastFetch = now;
    return out;
  } catch {
    return globalCache.activeProps || [];
  }
}

export function getActiveSports(): string[] {
  const month = new Date().getMonth() + 1;
  const active = [];
  if (month >= 9 || month <= 2) active.push("americanfootball_nfl");
  if (month >= 8 || month <= 1) active.push("americanfootball_ncaaf");
  if (month >= 3 && month <= 11) active.push("baseball_mlb");
  if (month >= 10 || month <= 6) active.push("basketball_nba");
  if (month >= 10 || month <= 6) active.push("icehockey_nhl");
  if (month >= 11 || month <= 4) active.push("basketball_ncaab");
  return active;
}

const SPORT_TO_ESPN_PATH: Record<string, string> = {
  americanfootball_nfl: "football/nfl",
  americanfootball_ncaaf: "football/college-football",
  baseball_mlb: "baseball_mlb" === "baseball_mlb" ? "baseball/mlb" : "baseball/mlb",
  basketball_nba: "basketball/nba",
  icehockey_nhl: "hockey/nhl",
  basketball_ncaab: "basketball/mens-college-basketball",
};

export async function isSportInRegularOrPostseason(sportKey: string): Promise<boolean> {
  const path = SPORT_TO_ESPN_PATH[sportKey];
  if (!path) return true;
  try {
    const dates = nowEtDayKey().replace(/-/g, "");
    const res = await fetch(`https://site.web.api.espn.com/apis/site/v2/sports/${path}/scoreboard?dates=${dates}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return true;
    const json = await res.json();
    const seasonType = json?.season?.type ?? json?.leagues?.[0]?.season?.type?.type ?? json?.leagues?.[0]?.season?.type;
    if (seasonType === 1) return false;
    if (seasonType === 2 || seasonType === 3) return true;
    return Boolean(json?.events && json.events.length > 0 && seasonType !== 1);
  } catch {
    return true;
  }
}

function isMainMarketKey(key: string) {
  return key === "h2h" || key === "spreads" || key === "totals";
}
function isPlayerMarketKey(key: string) {
  return /^(player_|batter_|pitcher_)/.test(key);
}

function normalizeEventBooks(event: any, mode: "mains" | "props" = "mains") {
  if (!event || typeof event !== "object") return event;
  const books = Array.isArray(event.bookmakers) ? event.bookmakers : [];
  for (const b of books) {
    if (b && (b.key === "hardrockbet_fl" || b.key === "hardrockbet")) b.key = "hardrock";
  }
  const allowedBooks = new Set(["hardrock", "draftkings", "fanduel"]);
  const filteredBooks = books.filter((b: any) => b && allowedBooks.has(b.key)).map((b: any) => ({
    key: b.key,
    title: b.title || b.key,
    markets: Array.isArray(b.markets) ? b.markets.filter((m: any) => {
      const key = String(m?.key || "");
      return mode === "props" ? isPlayerMarketKey(key) : isMainMarketKey(key);
    }).map((m: any) => ({
      key: m.key,
      outcomes: Array.isArray(m.outcomes) ? m.outcomes.map((o: any) => ({
        name: o.name, description: o.description, price: o.price, point: o.point,
      })) : [],
    })) : [],
  }));
  filteredBooks.sort((a: any, b: any) => {
    const ra = a?.key === "hardrock" ? 0 : a?.key === "draftkings" ? 1 : 2;
    const rb = b?.key === "hardrock" ? 0 : b?.key === "draftkings" ? 1 : 2;
    return ra - rb;
  });
  return {
    id: event.id, sport_key: event.sport_key, sport_title: event.sport_title,
    commence_time: event.commence_time, home_team: event.home_team, away_team: event.away_team,
    bookmakers: filteredBooks,
  };
}

function normalizeSportGroup(data: any) {
  if (Array.isArray(data)) return data.map(normalizeEventBooks);
  return normalizeEventBooks(data);
}

export const ODDS_REGIONS = "us,us2";
export const ODDS_BOOKS = "hardrockbet_fl,hardrockbet,draftkings,fanduel,betmgm";

export function getOddsQuota() { return globalCache.quotaRemaining; }

export async function getOddsQuotaLive(): Promise<number | null> {
  if (globalCache.quotaRemaining != null) return globalCache.quotaRemaining;
  try {
    const res = await fetch(`https://api.the-odds-api.com/v4/sports/?apiKey=${ODDS_API_KEY}`);
    noteQuota(res);
    return globalCache.quotaRemaining;
  } catch { return null; }
}

function oddsUrl(path: string, extra: string) {
  return `https://api.the-odds-api.com/v4/${path}?apiKey=${ODDS_API_KEY}&regions=${ODDS_REGIONS}&oddsFormat=american&${extra}&bookmakers=${ODDS_BOOKS}`;
}

function noteQuota(res: Response) {
  const remaining = res.headers.get("x-requests-remaining");
  if (remaining) globalCache.quotaRemaining = parseInt(remaining, 10);
}

async function patchMainsEvent(sportKey: string, eventId: string, event: any) {
  let mains = globalCache.mains;
  if (!mains || !Array.isArray(mains)) {
    const cached = await readDbCache("mains");
    mains = cached?.data && Array.isArray(cached.data) ? cached.data : [];
  }
  let group = mains.find((g: any) => g?.sport === sportKey);
  if (!group) {
    group = { sport: sportKey, data: [] };
    mains.push(group);
  }
  if (!Array.isArray(group.data)) group.data = [];
  const i = group.data.findIndex((e: any) => e?.id === eventId);
  if (i >= 0) group.data[i] = { ...group.data[i], ...event };
  else group.data.push(event);
  globalCache.mains = mains;
  globalCache.mainsLastFetch = Date.now();
  await writeOddsApiCache("mains", mains);
}

export async function fetchOddsApiEvent(sportKey: string, eventId: string) {
  const plan = await planOddsCalls(1);
  if (plan.action === "serve_stale") return null;
  const url = oddsUrl(`sports/${sportKey}/events/${eventId}/odds`, "markets=h2h,spreads,totals");
  const res = await fetch(url);
  noteQuota(res);
  await recordOddsCalls(1);
  if (!res.ok) return null;
  const data = normalizeEventBooks(await res.json());
  await patchMainsEvent(sportKey, eventId, data);
  await writeOddsApiCache(`event:${eventId}`, data);
  return data;
}

export async function fetchOddsApiMains(force = false, bypassDailyGuard = false) {
  const now = Date.now();
  const currentEtDay = nowEtDayKey();

  if (!force && globalCache.mains && Array.isArray(globalCache.mains) && globalCache.mains.length > 0 && now - globalCache.mainsLastFetch < 60_000 && globalCache.mainsEtDay === currentEtDay) {
    return await fillMissingEvents(globalCache.mains, ODDS_API_KEY, getActiveSports());
  }

  const cached = await readDbCache("mains");
  if (cached && cached.data && Array.isArray(cached.data) && cached.data.length > 0) {
    const cachedEtDay = etDayKey(cached.fetchedAt);
    const alreadyPulledToday = cachedEtDay === currentEtDay;
    if (alreadyPulledToday && !force && !bypassDailyGuard) {
      const filled = await fillMissingEvents(cached.data, ODDS_API_KEY, getActiveSports());
      globalCache.mains = filled;
      globalCache.mainsLastFetch = now;
      globalCache.mainsEtDay = currentEtDay;
      return filled;
    }
  }

  const candidateSports = getActiveSports();
  const plan = await planOddsCalls(Math.max(1, candidateSports.length));
  if (plan.action === "serve_stale") {
    if (cached?.data && Array.isArray(cached.data)) {
      return await fillMissingEvents(cached.data, ODDS_API_KEY, getActiveSports());
    }
    return [];
  }

  const results = [];
  let spent = 0;
  for (const sport of candidateSports) {
    const isLiveRegularSeason = await isSportInRegularOrPostseason(sport);
    if (!isLiveRegularSeason) continue;
    try {
      const url = oddsUrl(`sports/${sport}/odds/`, "markets=h2h,spreads,totals");
      const res = await fetch(url);
      noteQuota(res);
      spent += 1;
      if (!res.ok) continue;
      const data = normalizeSportGroup(await res.json());
      results.push({ sport, data });
    } catch {}
  }
  await recordOddsCalls(spent);
  if (results.length > 0) {
    const merged = [...results];
    if (cached?.data && Array.isArray(cached.data)) {
      for (const oldGroup of cached.data) {
        if (!merged.some((g: any) => g?.sport === oldGroup?.sport) && Array.isArray(oldGroup?.data) && oldGroup.data.length > 0) {
          merged.push(oldGroup);
        }
      }
    }
    const filled = await fillMissingEvents(merged, ODDS_API_KEY, getActiveSports());
    globalCache.mains = filled;
    globalCache.mainsLastFetch = now;
    globalCache.mainsEtDay = currentEtDay;
    await writeOddsApiCache("mains", filled);
    return filled;
  }
  return results;
}

export async function fetchOddsApiProps(sportKey: string, eventId: string, force = false) {
  if (!force && globalCache.props[eventId]) return globalCache.props[eventId];
  const cacheKey = `props:${eventId}`;
  const cached = force ? null : await readDbCache(cacheKey);
  if (cached && cached.data) {
    const age = Date.now() - cached.fetchedAt.getTime();
    if (age < CACHE_TTL) {
      globalCache.props[eventId] = cached.data;
      return cached.data;
    }
  }
  const plan = await planOddsCalls(1);
  if (plan.action === "serve_stale") {
    if (cached?.data) return cached.data;
    return { __error: true, status: 429, message: plan.reason } as any;
  }
  try {
    const SPORT_MARKETS: Record<string, string> = {
      americanfootball_nfl: "player_pass_tds,player_pass_yds,player_rush_yds,player_reception_yds,player_receptions,player_anytime_td",
      americanfootball_ncaaf: "player_pass_tds,player_pass_yds,player_rush_yds,player_reception_yds,player_receptions,player_anytime_td",
      basketball_nba: "player_points,player_rebounds,player_assists,player_threes",
      basketball_ncaab: "player_points,player_rebounds,player_assists,player_threes",
      baseball_mlb: "batter_home_runs,batter_hits,batter_total_bases,batter_rbis,batter_runs_scored,pitcher_strikeouts,pitcher_outs",
      icehockey_nhl: "player_points,player_assists,player_goals,player_shots_on_goal",
    };
    const markets = SPORT_MARKETS[sportKey] || "player_points,player_assists";
    const url = oddsUrl(`sports/${sportKey}/events/${eventId}/odds`, `markets=${markets}`);
    const res = await fetch(url);
    noteQuota(res);
    await recordOddsCalls(1);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { __error: true, status: res.status, message: body.slice(0, 200) } as any;
    }
    const data = normalizeEventBooks(await res.json(), "props");
    globalCache.props[eventId] = data;
    await writeOddsApiCache(cacheKey, data);
    return data;
  } catch (e: any) {
    return { __error: true, status: 0, message: String(e).slice(0, 200) } as any;
  }
}

export function getOddsPropsCache() {
  return globalCache.props;
}
