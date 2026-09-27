import { getSql } from "../db.ts";
import { etDayKey, nowEtDayKey } from "./slate-day.ts";
import { planOddsCalls, recordOddsCalls } from "./quota-store.ts";

export const ODDS_API_KEY = process.env.ODDS_API_KEY ?? "";

// 26h so a 6 AM ET pull still covers the next morning if cron slips a cycle.
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
