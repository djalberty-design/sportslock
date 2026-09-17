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

export async function getTuning(): Promise<TuningConfig> {
  const sql = await getSql();
  
  // Stripped illegal cache-busting parameters. Pure standard SELECT.
  const rows = await sql`SELECT min_edge, kelly, max_legs, feeds FROM desk_tuning_raw WHERE id = 1`;
  
  if (!rows || rows.length === 0) return DEFAULT_TUNING;
  
  const row = rows[0];
  return {
    minEdge: Number(row.min_edge),
    kellyMultiplier: Number(row.kelly),
    maxLegs: Number(row.max_legs),
    activeFeeds: row.feeds ? JSON.parse(row.feeds) : ["espn", "kalshi", "polymarket"]
  };
}

export async function updateTuning(config: TuningConfig): Promise<TuningConfig> {
  const sql = await getSql();
  
  await sql`
    INSERT INTO desk_tuning_raw (id, min_edge, kelly, max_legs, feeds)
    VALUES (
      1, 
      ${config.minEdge}, 
      ${config.kellyMultiplier}, 
      ${config.maxLegs}, 
      ${JSON.stringify(config.activeFeeds)}
    )
    ON CONFLICT (id) DO UPDATE SET 
      min_edge = EXCLUDED.min_edge,
      kelly = EXCLUDED.kelly,
      max_legs = EXCLUDED.max_legs,
      feeds = EXCLUDED.feeds
  `;
  
  return config;
}