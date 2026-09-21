import { getSql } from "@/lib/db";

export const ODDS_API_KEY = process.env.ODDS_API_KEY ?? "";

// 26h so a 6 AM ET pull still covers the next morning if cron slips a cycle.
export const CACHE_TTL = 1000 * 60 * 60 * 26;

const globalCache = (globalThis as any).__oddsApiCache || {
  mains: null as any,
  mainsLastFetch: 0,
  props: {} as Record<string, any>,
  quotaRemaining: null as number | null,
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

function normalizeEventBooks(event: any) {
  if (!event || typeof event !== "object") return event;
  const books = Array.isArray(event.bookmakers) ? event.bookmakers : [];
  for (const b of books) {
    if (b && (b.key === "hardrockbet_fl" || b.key === "hardrockbet")) b.key = "hardrock";
  }
  books.sort((a: any, b: any) => {
    const ra = a?.key === "hardrock" ? 0 : a?.key === "draftkings" ? 1 : 2;
    const rb = b?.key === "hardrock" ? 0 : b?.key === "draftkings" ? 1 : 2;
    return ra - rb;
  });
  event.bookmakers = books;
  return event;
}

function normalizeSportGroup(data: any) {
  if (Array.isArray(data)) return data.map(normalizeEventBooks);
  return normalizeEventBooks(data);
}

export const ODDS_REGIONS = "us,us2";
/** Florida Hard Rock first. `hardrock` is not a valid Odds API key. */
export const ODDS_BOOKS = "hardrockbet_fl,hardrockbet,draftkings,fanduel";

export function getOddsQuota() {
  return globalCache.quotaRemaining;
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

/** One-event mains pull. Admin ticket button. 1 Odds API request. */
export async function fetchOddsApiEvent(sportKey: string, eventId: string) {
  const url = oddsUrl(`sports/${sportKey}/events/${eventId}/odds`, "markets=h2h,spreads,totals");
  const res = await fetch(url);
  noteQuota(res);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[odds-api] Event error for ${eventId}:`, res.status, body);
    return null;
  }
  const data = normalizeEventBooks(await res.json());
  await patchMainsEvent(sportKey, eventId, data);
  await writeOddsApiCache(`event:${eventId}`, data);
  return data;
}

export async function fetchOddsApiMains(force = false) {
  if (!force && globalCache.mains && globalCache.mains.length > 0 && Date.now() - globalCache.mainsLastFetch < CACHE_TTL) {
    console.log("[odds-api] L1 memory cache hit, age:", Math.round((Date.now() - globalCache.mainsLastFetch) / 60000), "min");
    return globalCache.mains;
  }

  if (!force) {
    const cached = await readDbCache("mains");
    if (cached && cached.data && Array.isArray(cached.data) && cached.data.length > 0) {
      const age = Date.now() - cached.fetchedAt.getTime();
      if (age < CACHE_TTL) {
        console.log("[odds-api] L2 DB cache hit, age:", Math.round(age / 60000), "min");
        globalCache.mains = cached.data;
        globalCache.mainsLastFetch = cached.fetchedAt.getTime();
        return cached.data;
      }
    }
  }

  console.log("[odds-api] Cache miss — fetching from Odds API...");
  const sports = getActiveSports();
  const results = [];

  for (const sport of sports) {
    try {
      const url = oddsUrl(`sports/${sport}/odds/`, "markets=h2h,spreads,totals");
      const res = await fetch(url);
      noteQuota(res);
      if (!res.ok) {
        console.error(`[odds-api] Error for ${sport}:`, res.status, await res.text().catch(() => ""));
        continue;
      }
      const data = normalizeSportGroup(await res.json());
      console.log(`[odds-api] ${sport}: ${Array.isArray(data) ? data.length : 0} events`);
      results.push({ sport, data });
    } catch (e) {
      console.error(`[odds-api] Fetch error for ${sport}:`, e);
    }
  }

  if (results.length > 0) {
    globalCache.mains = results;
    globalCache.mainsLastFetch = Date.now();
    await writeOddsApiCache("mains", results);
    console.log("[odds-api] Wrote", results.length, "sport groups to DB cache. Quota remaining:", globalCache.quotaRemaining);
  } else {
    console.warn("[odds-api] API returned 0 results across all sports. Quota remaining:", globalCache.quotaRemaining);
  }

  return results;
}

export async function fetchOddsApiProps(sportKey: string, eventId: string, force = false) {
  if (!force && globalCache.props[eventId]) {
    return globalCache.props[eventId];
  }
  const cacheKey = `props:${eventId}`;
  const cached = force ? null : await readDbCache(cacheKey);
  if (cached && cached.data) {
    const age = Date.now() - cached.fetchedAt.getTime();
    if (age < CACHE_TTL) {
      globalCache.props[eventId] = cached.data;
      return cached.data;
    }
  }

  try {
    const markets = "player_pass_tds,player_pass_yds,player_rush_yds,player_reception_yds,player_home_runs,player_strikeouts,player_hits,player_points,player_rebounds,player_assists";
    const url = oddsUrl(`sports/${sportKey}/events/${eventId}/odds`, `markets=${markets}`);
    const res = await fetch(url);
    noteQuota(res);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const detail = `[odds-api] Props error for ${eventId}: HTTP ${res.status} — ${body.slice(0, 200)}`;
      console.error(detail);
      return { __error: true, status: res.status, message: body.slice(0, 200) } as any;
    }
    const data = normalizeEventBooks(await res.json());
    globalCache.props[eventId] = data;
    await writeOddsApiCache(cacheKey, data);
    return data;
  } catch (e: any) {
    console.error(`[odds-api] Props fetch error:`, e);
    return { __error: true, status: 0, message: String(e).slice(0, 200) } as any;
  }
}

export function getOddsPropsCache() {
  return globalCache.props;
}
