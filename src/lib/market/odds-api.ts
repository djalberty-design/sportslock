import { getSql } from "@/lib/db";

export const ODDS_API_KEY = process.env.ODDS_API_KEY || "c5fa171c7620da6c912ff69d843db37d";

// ── L1: in-memory cache (survives warm Vercel instances) ────────────────────
const globalCache = (globalThis as any).__oddsApiCache || {
  mains: null as any,
  mainsLastFetch: 0,
  props: {} as Record<string, any>,
  quotaRemaining: null as number | null,
};
(globalThis as any).__oddsApiCache = globalCache;

// ── L2: Postgres-backed cache (survives cold starts) ────────────────────────
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

async function writeDbCache(key: string, data: any): Promise<void> {
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

// ── Season-aware sport list ─────────────────────────────────────────────────
function getActiveSports(): string[] {
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

export function getOddsQuota() {
  return globalCache.quotaRemaining;
}

const CACHE_TTL = 1000 * 60 * 60 * 12; // 12 hours

export async function fetchOddsApiMains(force = false) {
  // L1: check in-memory cache first (fastest, survives warm starts)
  if (!force && globalCache.mains && globalCache.mains.length > 0 && Date.now() - globalCache.mainsLastFetch < CACHE_TTL) {
    console.log("[odds-api] L1 memory cache hit, age:", Math.round((Date.now() - globalCache.mainsLastFetch) / 60000), "min");
    return globalCache.mains;
  }

  // L2: check Postgres cache (survives cold starts)
  if (!force) {
    const cached = await readDbCache("mains");
    if (cached && cached.data && Array.isArray(cached.data) && cached.data.length > 0) {
      const age = Date.now() - cached.fetchedAt.getTime();
      if (age < CACHE_TTL) {
        console.log("[odds-api] L2 DB cache hit, age:", Math.round(age / 60000), "min");
        // Promote to L1
        globalCache.mains = cached.data;
        globalCache.mainsLastFetch = cached.fetchedAt.getTime();
        return cached.data;
      }
    }
  }

  // L3: fetch from Odds API
  console.log("[odds-api] Cache miss — fetching from Odds API...");
  const sports = getActiveSports();
  const results = [];

  for (const sport of sports) {
    try {
      const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h,spreads,totals&bookmakers=hardrock,draftkings,fanduel`;
      const res = await fetch(url);

      const remaining = res.headers.get("x-requests-remaining");
      if (remaining) globalCache.quotaRemaining = parseInt(remaining, 10);

      if (!res.ok) {
        console.error(`[odds-api] Error for ${sport}:`, res.status, await res.text().catch(() => ""));
        continue;
      }

      const data = await res.json();
      console.log(`[odds-api] ${sport}: ${Array.isArray(data) ? data.length : 0} events`);
      results.push({ sport, data });
    } catch (e) {
      console.error(`[odds-api] Fetch error for ${sport}:`, e);
    }
  }

  if (results.length > 0) {
    // Write to both L1 and L2
    globalCache.mains = results;
    globalCache.mainsLastFetch = Date.now();
    await writeDbCache("mains", results);
    console.log("[odds-api] Wrote", results.length, "sport groups to DB cache. Quota remaining:", globalCache.quotaRemaining);
  } else {
    console.warn("[odds-api] API returned 0 results across all sports. Quota remaining:", globalCache.quotaRemaining);
  }

  return results;
}

export async function fetchOddsApiProps(sportKey: string, eventId: string) {
  // L1
  if (globalCache.props[eventId]) {
    return globalCache.props[eventId];
  }
  // L2
  const cacheKey = `props:${eventId}`;
  const cached = await readDbCache(cacheKey);
  if (cached && cached.data) {
    const age = Date.now() - cached.fetchedAt.getTime();
    if (age < CACHE_TTL) {
      globalCache.props[eventId] = cached.data;
      return cached.data;
    }
  }

  try {
    const markets = "player_pass_tds,player_pass_yds,player_rush_yds,player_reception_yds,player_home_runs,player_strikeouts,player_hits,player_points,player_rebounds,player_assists";
    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/events/${eventId}/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=${markets}&bookmakers=hardrock,draftkings,fanduel`;

    const res = await fetch(url);

    const remaining = res.headers.get("x-requests-remaining");
    if (remaining) globalCache.quotaRemaining = parseInt(remaining, 10);

    if (!res.ok) {
      console.error(`[odds-api] Props error for ${eventId}:`, res.status);
      return null;
    }

    const data = await res.json();
    globalCache.props[eventId] = data;
    await writeDbCache(cacheKey, data);
    return data;
  } catch (e) {
    console.error(`[odds-api] Props fetch error:`, e);
    return null;
  }
}

export function getOddsPropsCache() {
  return globalCache.props;
}