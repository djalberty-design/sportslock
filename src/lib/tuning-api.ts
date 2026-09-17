import { getSql } from "@/lib/db";

export type TuningConfig = {
  minEdge: number;
  kellyMultiplier: number;
  maxLegs: number;
  activeFeeds: string[];
};

export const DEFAULT_TUNING: TuningConfig = {
  minEdge: 2.5,
  kellyMultiplier: 0.25,
  maxLegs: 3,
  activeFeeds: ["espn", "kalshi", "polymarket"]
};

async function ensureTuningTable(sql: any) {
  await sql`
    CREATE TABLE IF NOT EXISTS desk_tuning_v3 (
      id INTEGER PRIMARY KEY,
      payload TEXT
    )
  `;
}

export async function getTuning(): Promise<TuningConfig> {
  const sql = await getSql();
  await ensureTuningTable(sql);

  // The timestamp forces Vercel's cache to miss, guaranteeing a live DB read
  const ts = Date.now();
  const result = await sql`SELECT payload FROM desk_tuning_v3 WHERE id = 1 AND ${ts} = ${ts}`;
  const rows = result.rows || result;
  
  if (!rows || rows.length === 0) {
    return DEFAULT_TUNING;
  }
  
  try {
    return JSON.parse(rows[0].payload) as TuningConfig;
  } catch (e) {
    return DEFAULT_TUNING;
  }
}

export async function updateTuning(config: TuningConfig): Promise<TuningConfig> {
  const sql = await getSql();
  await ensureTuningTable(sql);

  const payloadStr = JSON.stringify(config);

  await sql`
    INSERT INTO desk_tuning_v3 (id, payload)
    VALUES (1, ${payloadStr})
    ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload
  `;
  
  return config;
}