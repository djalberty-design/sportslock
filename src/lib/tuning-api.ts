import { getSql } from "@/lib/db";

export type TuningConfig = {
  id?: number;
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
    CREATE TABLE IF NOT EXISTS desk_tuning (
      id SERIAL PRIMARY KEY,
      min_edge NUMERIC,
      kelly_multiplier NUMERIC,
      max_legs INTEGER,
      active_feeds JSONB,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export async function getTuning(): Promise<TuningConfig> {
  const sql = await getSql();
  await ensureTuningTable(sql);

  const result = await sql`SELECT * FROM desk_tuning ORDER BY updated_at DESC LIMIT 1`;
  const rows = result.rows || result;
  
  if (!rows || rows.length === 0) {
    return DEFAULT_TUNING;
  }
  
  const row = rows[0];
  return {
    id: row.id,
    minEdge: Number(row.min_edge),
    kellyMultiplier: Number(row.kelly_multiplier),
    maxLegs: Number(row.max_legs),
    activeFeeds: row.active_feeds || ["espn", "kalshi", "polymarket"]
  };
}

export async function updateTuning(config: TuningConfig): Promise<TuningConfig> {
  const sql = await getSql();
  
  // FIX: Ensure the table physically exists BEFORE attempting to delete old rows
  await ensureTuningTable(sql);
  await sql`DELETE FROM desk_tuning`;

  await sql`
    INSERT INTO desk_tuning (min_edge, kelly_multiplier, max_legs, active_feeds)
    VALUES (
      ${config.minEdge},
      ${config.kellyMultiplier},
      ${config.maxLegs},
      ${JSON.stringify(config.activeFeeds)}::jsonb
    )
  `;
  return config;
}