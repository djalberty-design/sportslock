import { getSql } from "./db.ts";

export type TuningConfig = {
  minEdge: number;
  kellyMultiplier: number;
  maxLegs: number;
  activeFeeds: string[];
};

export const DEFAULT_TUNING: TuningConfig = {
  minEdge: 3.5, // CHANGED TO 3.5 AS A DIAGNOSTIC FLAG
  kellyMultiplier: 0.25,
  maxLegs: 3,
  activeFeeds: ["espn", "kalshi", "polymarket"]
};

export async function getTuning(): Promise<TuningConfig> {
  try {
    const sql = await getSql();
    
    // Stripped illegal cache-busting parameters. Pure standard SELECT.
    const rows = await sql`SELECT min_edge, kelly, max_legs, feeds FROM desk_tuning_raw WHERE id = 1`;
    
    if (!rows || rows.length === 0) return DEFAULT_TUNING;
    
    const row = rows[0];
    return {
      minEdge: Number(row.min_edge) || DEFAULT_TUNING.minEdge,
      kellyMultiplier: Number(row.kelly) || DEFAULT_TUNING.kellyMultiplier,
      maxLegs: Number(row.max_legs) || DEFAULT_TUNING.maxLegs,
      activeFeeds: typeof row.feeds === "string" ? JSON.parse(row.feeds) : (Array.isArray(row.feeds) ? row.feeds : ["espn", "kalshi", "polymarket"])
    };
  } catch {
    return DEFAULT_TUNING;
  }
}

export async function updateTuning(config: TuningConfig): Promise<TuningConfig> {
  const sql = await getSql();
  
  // Direct UPDATE statement to bypass any ON CONFLICT parsing bugs
  await sql`
    UPDATE desk_tuning_raw 
    SET 
      min_edge = ${config.minEdge},
      kelly = ${config.kellyMultiplier},
      max_legs = ${config.maxLegs},
      feeds = ${JSON.stringify(config.activeFeeds)}
    WHERE id = 1
  `;
  
  return config;
}