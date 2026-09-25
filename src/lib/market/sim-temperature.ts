import { getSql } from "../db.ts";

/**
 * Sport Simulation Temperature Control
 * Controls the standard deviation multiplier (variance) in 10k Monte Carlo normal CDF pricing.
 * Lower temperature (< 1.0) = compressed variance, higher conviction / sharper odds (e.g. NBA).
 * Higher temperature (> 1.0) = widened variance, fatter tails, conservative pricing (e.g. MLB/NCAAF).
 * Institutional clamp: [0.80, 1.25].
 */

export const DEFAULT_TEMPERATURES: Record<string, number> = {
  NFL: 1.00,
  NCAAF: 1.05,
  NBA: 0.95,
  NCAAB: 1.05,
  MLB: 1.10,
  NHL: 1.08,
  WNBA: 0.98,
};

const MIN_TEMPERATURE = 0.80;
const MAX_TEMPERATURE = 1.25;

// In-memory zero-latency cache for synchronous access during simulation
const temperatureCache = new Map<string, number>(Object.entries(DEFAULT_TEMPERATURES));
let cacheLoaded = false;
let lastLoadTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function clampTemperature(val: number): number {
  if (!Number.isFinite(val)) return 1.00;
  return Math.min(MAX_TEMPERATURE, Math.max(MIN_TEMPERATURE, Math.round(val * 100) / 100));
}

/**
 * Synchronous temperature getter for simulation loops (zero latency).
 */
export function getSimTemperature(sport: string): number {
  const norm = (sport || "").toUpperCase().trim();
  return temperatureCache.get(norm) ?? DEFAULT_TEMPERATURES[norm] ?? 1.00;
}

/**
 * Update the in-memory cache directly.
 */
export function setSimTemperatureInCache(sport: string, temp: number): void {
  const norm = (sport || "").toUpperCase().trim();
  temperatureCache.set(norm, clampTemperature(temp));
}

let tableEnsured = false;

/**
 * Ensure database table exists for persistent temperature overrides.
 */
async function ensureTable(): Promise<void> {
  if (tableEnsured) return;
  try {
    const sql = await getSql();
    await sql.query(`
      CREATE TABLE IF NOT EXISTS brain_sim_temperatures (
        sport TEXT PRIMARY KEY,
        temperature NUMERIC(5,3) NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    tableEnsured = true;
  } catch {
    // Graceful fallback for non-db or worker environments
  }
}

/**
 * Load temperatures from database into memory cache.
 */
export async function loadSimTemperatures(): Promise<Record<string, number>> {
  const now = Date.now();
  if (cacheLoaded && now - lastLoadTime < CACHE_TTL_MS) {
    return Object.fromEntries(temperatureCache.entries());
  }

  try {
    await ensureTable();
    const sql = await getSql();
    const rows = await sql.query<{ sport: string; temperature: number }>(
      `SELECT sport, temperature FROM brain_sim_temperatures`
    );

    for (const r of rows) {
      if (r.sport && r.temperature != null) {
        temperatureCache.set(r.sport.toUpperCase(), clampTemperature(Number(r.temperature)));
      }
    }
    cacheLoaded = true;
    lastLoadTime = now;
  } catch {
    // Use existing in-memory / default values
  }

  return Object.fromEntries(temperatureCache.entries());
}

/**
 * Persist temperature to database and update cache.
 */
export async function persistSimTemperature(sport: string, temp: number): Promise<{ ok: boolean; temperature: number }> {
  const norm = (sport || "").toUpperCase().trim();
  const clamped = clampTemperature(temp);
  temperatureCache.set(norm, clamped);

  try {
    await ensureTable();
    const sql = await getSql();
    await sql.query(
      `INSERT INTO brain_sim_temperatures (sport, temperature, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (sport) DO UPDATE SET temperature = $2, updated_at = NOW()`,
      [norm, clamped]
    );
    return { ok: true, temperature: clamped };
  } catch {
    return { ok: true, temperature: clamped };
  }
}
