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
    CREATE TABLE IF NOT EXISTS desk_tuning_v2 (
      id INTEGER PRIMARY KEY,
      payload JSONB
    )
  `;
}

export async function getTuning(): Promise<TuningConfig> {
  const sql = await getSql();
  await ensureTuningTable(sql);

  const result = await sql`SELECT payload FROM desk_tuning_v2 WHERE id = 1`;
  const rows = result.rows || result;
  
  if (!rows || rows.length === 0) {
    return DEFAULT_TUNING;
  }
  
  return rows[0].payload as TuningConfig;
}

export async function updateTuning(config: TuningConfig): Promise<TuningConfig> {
  const sql = await getSql();
  await ensureTuningTable(sql);

  const payloadStr = JSON.stringify(config);

  await sql`
    INSERT INTO desk_tuning_v2 (id, payload)
    VALUES (1, ${payloadStr}::jsonb)
    ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload
  `;
  
  return config;
}