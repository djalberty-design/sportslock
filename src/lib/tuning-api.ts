import { getSql } from "@/lib/db";

export type TuningConfig = {
  minEdge: number;
  kellyMultiplier: number;
  maxLegs: number;
  activeFeeds: Record<string, boolean>;
};

export const DEFAULT_TUNING: TuningConfig = {
  minEdge: 2.5,
  kellyMultiplier: 0.25,
  maxLegs: 3,
  activeFeeds: { MLB: true, NFL: true, NCAAF: true },
};

async function ensureTuningTable(sql: any) {
  await sql`
    CREATE TABLE IF NOT EXISTS desk_tuning (
      id INT PRIMARY KEY,
      min_edge NUMERIC,
      kelly_multiplier NUMERIC,
      max_legs INT,
      active_feeds JSONB
    )
  `;
}

export async function getTuning(): Promise<TuningConfig> {
  const sql = await getSql();
  await ensureTuningTable(sql);

  const rows = await sql<{
    min_edge: number;
    kelly_multiplier: number;
    max_legs: number;
    active_feeds: any;
  }>`SELECT min_edge, kelly_multiplier, max_legs, active_feeds FROM desk_tuning WHERE id = 1`;

  if (rows.length === 0) {
    return DEFAULT_TUNING;
  }

  const row = rows[0];
  return {
    minEdge: Number(row.min_edge),
    kellyMultiplier: Number(row.kelly_multiplier),
    maxLegs: Number(row.max_legs),
    activeFeeds: row.active_feeds || DEFAULT_TUNING.activeFeeds,
  };
}

export async function updateTuning(config: TuningConfig): Promise<TuningConfig> {
  const sql = await getSql();
  await ensureTuningTable(sql);

  await sql`
    INSERT INTO desk_tuning (id, min_edge, kelly_multiplier, max_legs, active_feeds)
    VALUES (
      1,
      ${config.minEdge},
      ${config.kellyMultiplier},
      ${config.maxLegs},
      ${JSON.stringify(config.activeFeeds)}
    )
    ON CONFLICT (id) DO UPDATE SET
      min_edge = EXCLUDED.min_edge,
      kelly_multiplier = EXCLUDED.kelly_multiplier,
      max_legs = EXCLUDED.max_legs,
      active_feeds = EXCLUDED.active_feeds
  `;

  return config;
}