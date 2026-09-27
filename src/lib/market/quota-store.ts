import { getSql } from "../db.ts";
import { decideOddsFetch, ODDS_MONTHLY_LIMIT, type QuotaDecision } from "./quota-ledger.ts";

export function monthKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function weekKey(d = new Date()): string {
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const day = Math.floor((d.getTime() - start.getTime()) / 86_400_000);
  const week = Math.floor(day / 7) + 1;
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export type StoredQuota = {
  month: string;
  requestCount: number;
  weeklyCount: number;
  weekKey: string;
};

export async function readQuota(): Promise<StoredQuota> {
  const month = monthKey();
  const week = weekKey();
  try {
    const sql = await getSql();
    const rows = await sql<{ request_count: number; weekly_count: number; week_key: string }>`
      SELECT request_count, weekly_count, week_key FROM odds_api_quota WHERE month = ${month}
    `;
    const row = rows[0];
    if (!row) return { month, requestCount: 0, weeklyCount: 0, weekKey: week };
    const weeklyCount = row.week_key === week ? Number(row.weekly_count || 0) : 0;
    return { month, requestCount: Number(row.request_count || 0), weeklyCount, weekKey: week };
  } catch {
    return { month, requestCount: 0, weeklyCount: 0, weekKey: week };
  }
}

export async function planOddsCalls(requestedCalls: number): Promise<QuotaDecision & StoredQuota> {
  const stored = await readQuota();
  return { ...stored, ...decideOddsFetch({ monthlyUsed: stored.requestCount, weeklyUsed: stored.weeklyCount, requestedCalls }) };
}

export async function recordOddsCalls(n: number): Promise<void> {
  if (n <= 0) return;
  const month = monthKey();
  const week = weekKey();
  try {
    const sql = await getSql();
    await sql`
      INSERT INTO odds_api_quota (month, request_count, request_limit, weekly_count, week_key, last_request_at)
      VALUES (${month}, ${n}, ${ODDS_MONTHLY_LIMIT}, ${n}, ${week}, NOW())
      ON CONFLICT (month) DO UPDATE SET
        request_count = odds_api_quota.request_count + ${n},
        weekly_count = CASE WHEN odds_api_quota.week_key = ${week} THEN odds_api_quota.weekly_count + ${n} ELSE ${n} END,
        week_key = ${week},
        last_request_at = NOW()
    `;
  } catch (e) {
    console.error("[quota-store] record failed:", e);
  }
}
