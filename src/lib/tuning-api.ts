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
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS desk_tuning_raw (
        id INTEGER PRIMARY KEY,
        min_edge FLOAT,
        kelly FLOAT,
        max_legs INTEGER,
        feeds TEXT
      )
    `;
    
    // Injecting Date.now() directly into the SQL string physically destroys any query caching
    const ts = Date.now();
    const res = await sql`SELECT * FROM desk_tuning_raw WHERE id = 1 AND ${ts} = ${ts}`;
    const rows = res.rows || res;
    
    if (!rows || rows.length === 0) return DEFAULT_TUNING;
    
    const row = rows[0];
    return {
      minEdge: row.min_edge,
      kellyMultiplier: row.kelly,
      maxLegs: row.max_legs,
      activeFeeds: row.feeds ? JSON.parse(row.feeds) : ["espn", "kalshi", "polymarket"]
    };
  } catch (e) {
    console.error("DB READ ERROR:", e);
    return DEFAULT_TUNING;
  }
}

export async function updateTuning(config: TuningConfig): Promise<TuningConfig> {
  const sql = await getSql();
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS desk_tuning_raw (
        id INTEGER PRIMARY KEY,
        min_edge FLOAT,
        kelly FLOAT,
        max_legs INTEGER,
        feeds TEXT
      )
    `;
    
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
  } catch (e) {
    console.error("DB WRITE ERROR:", e);
    throw e;
  }
}