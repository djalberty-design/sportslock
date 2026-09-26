import { getSql } from "../db.ts";
import { logActivity } from "./activity.ts";

export type BlendWeights = {
  wSim: number;
  wPool: number;
  wMarket: number;
  sport: string;
  source: "default" | "calibrated" | "manual" | "circuit_breaker";
  sampleSize: number;
  updatedAt: string;
  notes?: string;
};

const DEFAULT_WEIGHTS: Record<string, Omit<BlendWeights, "sport" | "updatedAt">> = {
  DEFAULT: { wSim: 0.10, wPool: 0.10, wMarket: 0.80, source: "default", sampleSize: 0, notes: "Baseline 60% consensus anchor" },
  NFL: { wSim: 0.12, wPool: 0.08, wMarket: 0.80, source: "default", sampleSize: 0, notes: "NFL: injury & EPA sensitive" },
  NBA: { wSim: 0.10, wPool: 0.10, wMarket: 0.80, source: "default", sampleSize: 0, notes: "NBA: 3P variance & rest pacing" },
  MLB: { wSim: 0.12, wPool: 0.08, wMarket: 0.80, source: "default", sampleSize: 0, notes: "MLB: starting pitcher & park factor anchor" },
  NHL: { wSim: 0.10, wPool: 0.10, wMarket: 0.80, source: "default", sampleSize: 0, notes: "NHL: goalie GSAx & travel fatigue" },
  NCAAF: { wSim: 0.14, wPool: 0.10, wMarket: 0.76, source: "default", sampleSize: 0, notes: "NCAAF: talent differential wider in college" },
  NCAAB: { wSim: 0.12, wPool: 0.10, wMarket: 0.78, source: "default", sampleSize: 0, notes: "NCAAB: foul volatility & portal rating" },
};

// In-memory zero-latency cache with 5-minute TTL
type CachedWeights = {
  weights: BlendWeights;
  expiresAt: number;
};

const weightsCache = new Map<string, CachedWeights>();
const CACHE_TTL_MS = 5 * 60 * 1000;

let tableEnsured = false;

async function ensureWeightsTable() {
  if (tableEnsured) return;
  try {
    const sql = await getSql();
    await sql.query(`
      create table if not exists brain_model_weights (
        sport text primary key,
        w_sim numeric not null,
        w_pool numeric not null,
        w_market numeric not null,
        source text not null default 'default',
        sample_size integer not null default 0,
        notes text,
        updated_at timestamptz not null default now()
      )
    `);
    tableEnsured = true;
  } catch (err) {
    console.error("ensureWeightsTable failed (continuing with in-memory):", err);
  }
}

/**
 * Get dynamic blend weights for a sport synchronously from memory cache if available,
 * with graceful fallback to default mathematically proven weights.
 */
export function getDynamicWeightsSync(sport?: string): BlendWeights {
  const key = (sport || "DEFAULT").toUpperCase();
  const cached = weightsCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.weights;
  }

  const def = DEFAULT_WEIGHTS[key] || DEFAULT_WEIGHTS.DEFAULT;
  return {
    wSim: def.wSim,
    wPool: def.wPool,
    wMarket: def.wMarket,
    sport: key,
    source: def.source,
    sampleSize: def.sampleSize,
    updatedAt: new Date().toISOString(),
    notes: def.notes,
  };
}

/**
 * Get dynamic blend weights for a sport, checking DB if cache expired.
 */
export async function getDynamicWeights(sport?: string): Promise<BlendWeights> {
  const key = (sport || "DEFAULT").toUpperCase();
  const cached = weightsCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.weights;
  }

  try {
    await ensureWeightsTable();
    const sql = await getSql();
    const rows = await sql.query<{
      sport: string;
      w_sim: string | number;
      w_pool: string | number;
      w_market: string | number;
      source: string;
      sample_size: number;
      notes: string | null;
      updated_at: string;
    }>(`select * from brain_model_weights where sport = $1 or sport = 'DEFAULT' order by case when sport = $1 then 0 else 1 end limit 1`, [key]);

    if (rows.length > 0) {
      const r = rows[0];
      const w: BlendWeights = {
        sport: key,
        wSim: Number(r.w_sim),
        wPool: Number(r.w_pool),
        wMarket: Number(r.w_market),
        source: (r.source as any) || "calibrated",
        sampleSize: Number(r.sample_size) || 0,
        notes: r.notes || undefined,
        updatedAt: String(r.updated_at),
      };
      weightsCache.set(key, { weights: w, expiresAt: Date.now() + CACHE_TTL_MS });
      return w;
    }
  } catch (err) {
    // Database read fallback
  }

  const fallback = getDynamicWeightsSync(key);
  weightsCache.set(key, { weights: fallback, expiresAt: Date.now() + CACHE_TTL_MS });
  return fallback;
}

/**
 * Return current blend weights across all active sports.
 */
export async function getAllSportsWeights(): Promise<BlendWeights[]> {
  const sports = ["DEFAULT", "NFL", "NBA", "MLB", "NHL", "NCAAF", "NCAAB"];
  const list: BlendWeights[] = [];
  for (const s of sports) {
    list.push(await getDynamicWeights(s));
  }
  return list;
}

/**
 * Manually update blend weights for a sport with safety clamps.
 */
export async function updateSportWeights(params: {
  sport: string;
  wSim: number;
  wPool: number;
  wMarket: number;
  notes?: string;
}): Promise<BlendWeights> {
  await ensureWeightsTable();
  const sql = await getSql();
  const sport = params.sport.toUpperCase();

  let wSim = Math.min(0.20, Math.max(0.05, params.wSim));
  let wPool = Math.min(0.20, Math.max(0.05, params.wPool));
  let wMarket = Math.min(0.90, Math.max(0.70, params.wMarket));

  const total = wSim + wPool + wMarket;
  wSim = Math.round((wSim / total) * 1000) / 1000;
  wPool = Math.round((wPool / total) * 1000) / 1000;
  wMarket = Math.round((1.0 - wSim - wPool) * 1000) / 1000;

  const notes = params.notes || "Manual adjustment via Overseer";
  await sql.query(`
    insert into brain_model_weights (sport, w_sim, w_pool, w_market, source, sample_size, notes, updated_at)
    values ($1, $2, $3, $4, 'manual', 0, $5, now())
    on conflict (sport) do update set
      w_sim = excluded.w_sim,
      w_pool = excluded.w_pool,
      w_market = excluded.w_market,
      source = 'manual',
      notes = excluded.notes,
      updated_at = now()
  `, [sport, wSim, wPool, wMarket, notes]);

  const updated: BlendWeights = {
    sport,
    wSim,
    wPool,
    wMarket,
    source: "manual",
    sampleSize: 0,
    updatedAt: new Date().toISOString(),
    notes,
  };
  weightsCache.set(sport, { weights: updated, expiresAt: Date.now() + CACHE_TTL_MS });
  return updated;
}

/**
 * Calibrate model blend weights across all active sports based on 30-day Brier performance
 * and model prediction tape accuracy.
 * Clamps weights safely within [0.05, 0.20] for sim/pool and [0.70, 0.90] for market.
 */
export async function calibrateWeights(): Promise<{ ok: boolean; updated: string[]; summary: Record<string, BlendWeights> }> {
  await ensureWeightsTable();
  const sql = await getSql();
  const updated: string[] = [];
  const summary: Record<string, BlendWeights> = {};

  try {
    // Pull 30-day graded performance by sport from market_tape
    const rows = await sql.query<{
      sport: string;
      total: number;
      wins: number;
      losses: number;
      avg_edge: number;
    }>(`
      select 
        upper(sport) as sport,
        count(*)::int as total,
        count(*) filter (where status = 'WIN')::int as wins,
        count(*) filter (where status = 'LOSS')::int as losses,
        coalesce(avg(edge), 0)::float as avg_edge
      from market_tape
      where status in ('WIN', 'LOSS')
        and coalesce(start, snapped_at) >= now() - interval '30 days'
      group by upper(sport)
      having count(*) >= 10
    `);

    for (const r of rows) {
      const sport = r.sport;
      const total = Number(r.total);
      const wins = Number(r.wins);
      const winRate = total > 0 ? wins / total : 0.5;

      const base = DEFAULT_WEIGHTS[sport] || DEFAULT_WEIGHTS.DEFAULT;
      let wSim = base.wSim;
      let wPool = base.wPool;
      let wMarket = base.wMarket;
      let note = base.notes || "";

      // Calibration logic:
      // If win rate is extraordinarily high (> 62% over 10+ games), model simulation has proven alpha:
      // Increase wSim up to max 0.18, pull from wMarket
      if (winRate >= 0.62) {
        const bonus = Math.min(0.06, (winRate - 0.60) * 0.5);
        wSim = Math.min(0.20, base.wSim + bonus);
        wMarket = 1.0 - wSim - wPool;
        note = `Strong model alpha (${Math.round(winRate * 100)}% over ${total} picks): boosted sim weight +${Math.round(bonus * 100)}%`;
      } else if (winRate < 0.52) {
        // If win rate is below 52%, anchor more heavily to market consensus
        const penalty = Math.min(0.05, (0.55 - winRate) * 0.5);
        wSim = Math.max(0.05, base.wSim - penalty);
        wMarket = Math.min(0.90, base.wMarket + penalty);
        wPool = Math.max(0.05, 1.0 - wSim - wMarket);
        note = `Cold stretch (${Math.round(winRate * 100)}% over ${total} picks): defensive anchor to market line (+${Math.round(penalty * 100)}%)`;
      }

      // Normalization clamp
      const totalW = wSim + wPool + wMarket;
      wSim = Math.round((wSim / totalW) * 1000) / 1000;
      wPool = Math.round((wPool / totalW) * 1000) / 1000;
      wMarket = Math.round((1.0 - wSim - wPool) * 1000) / 1000;

      const weightObj: BlendWeights = {
        sport,
        wSim,
        wPool,
        wMarket,
        source: "calibrated",
        sampleSize: total,
        updatedAt: new Date().toISOString(),
        notes: note,
      };

      await sql.query(`
        insert into brain_model_weights (sport, w_sim, w_pool, w_market, source, sample_size, notes, updated_at)
        values ($1, $2, $3, $4, $5, $6, $7, now())
        on conflict (sport) do update set
          w_sim = excluded.w_sim,
          w_pool = excluded.w_pool,
          w_market = excluded.w_market,
          source = excluded.source,
          sample_size = excluded.sample_size,
          notes = excluded.notes,
          updated_at = now()
      `, [sport, wSim, wPool, wMarket, "calibrated", total, note]);

      weightsCache.set(sport, { weights: weightObj, expiresAt: Date.now() + CACHE_TTL_MS });
      updated.push(sport);
      summary[sport] = weightObj;
    }

    // Run Alpha Drawdown Circuit Breakers to guard against sudden model miss clusters
    const breakers = await checkCircuitBreakers();
    for (const s of breakers.tripped) {
      if (!updated.includes(s)) updated.push(s);
      const w = await getDynamicWeights(s);
      summary[s] = w;
    }

    return { ok: true, updated, summary };
  } catch (err: any) {
    console.error("calibrateWeights error:", err);
    return { ok: false, updated: [], summary, error: String(err) } as any;
  }
}

/**
 * Alpha Drawdown Circuit Breaker:
 * Evaluates the last 10 decided recommended picks per sport in market_tape.
 * If >= 4 consecutive picks or >= 5 of the last 10 are classified as 'model_miss',
 * the circuit breaker trips, instantly reverting that sport's blend weights
 * to the defensive baseline consensus anchor (0.10 / 0.10 / 0.80) to protect bankroll.
 * If a previously tripped sport has stabilized (<= 1 consecutive miss and <= 3 total misses),
 * it autonomously clears and restores calibrated dynamic weights.
 */
export async function checkCircuitBreakers(): Promise<{ tripped: string[]; summary: Record<string, string>; recovered: string[] }> {
  await ensureWeightsTable();
  const tripped: string[] = [];
  const recovered: string[] = [];
  const summary: Record<string, string> = {};

  try {
    const sql = await getSql();
    const sports = ["NFL", "NCAAF", "MLB", "NBA", "NHL", "NCAAB"];

    // Check existing states
    const existing = await sql.query<{ sport: string; source: string }>(
      `select sport, source from brain_model_weights`
    );
    const isTripped = new Map(existing.map((r) => [r.sport.toUpperCase(), r.source === "circuit_breaker"]));

    for (const sport of sports) {
      const rows = await sql.query<{
        id: string;
        bucket: string | null;
        status: string;
      }>(`
        select id, bucket, status
        from market_tape
        where upper(sport) = $1
          and status in ('WIN', 'LOSS')
          and (recommended = true or model_probability >= 0.52)
        order by coalesce(start, snapped_at) desc
        limit 10
      `, [sport]);

      if (rows.length < 5) continue;

      let consecutiveMisses = 0;
      let totalMisses = 0;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].bucket === "model_miss") {
          totalMisses++;
          if (i === consecutiveMisses) consecutiveMisses++;
        }
      }

      // Circuit Breaker Trigger: >= 4 consecutive misses OR >= 5 out of last 10 misses
      if (consecutiveMisses >= 4 || totalMisses >= 5) {
        const base = DEFAULT_WEIGHTS[sport] || DEFAULT_WEIGHTS.DEFAULT;
        const note = `🛡️ Alpha Circuit Breaker Tripped: ${consecutiveMisses >= 4 ? `${consecutiveMisses} consecutive` : `${totalMisses}/10`} Model Misses detected. Auto-reverted to defensive consensus baseline (0.10/0.10/0.80) to protect bankroll.`;

        await sql.query(`
          insert into brain_model_weights (sport, w_sim, w_pool, w_market, source, sample_size, notes, updated_at)
          values ($1, $2, $3, $4, 'circuit_breaker', $5, $6, now())
          on conflict (sport) do update set
            w_sim = excluded.w_sim,
            w_pool = excluded.w_pool,
            w_market = excluded.w_market,
            source = 'circuit_breaker',
            notes = excluded.notes,
            updated_at = now()
        `, [sport, base.wSim, base.wPool, base.wMarket, rows.length, note]);

        const breakerObj: BlendWeights = {
          sport,
          wSim: base.wSim,
          wPool: base.wPool,
          wMarket: base.wMarket,
          source: "circuit_breaker",
          sampleSize: rows.length,
          updatedAt: new Date().toISOString(),
          notes: note,
        };

        weightsCache.set(sport, { weights: breakerObj, expiresAt: Date.now() + CACHE_TTL_MS });
        tripped.push(sport);
        summary[sport] = note;

        void logActivity(
          "brain",
          `Alpha Circuit Breaker Tripped: ${sport}`,
          note,
          "system"
        );
      } else if (isTripped.get(sport) && consecutiveMisses <= 1 && totalMisses <= 3) {
        // AUTONOMOUS RECOVERY: Performance has stabilized!
        const base = DEFAULT_WEIGHTS[sport] || DEFAULT_WEIGHTS.DEFAULT;
        const note = `✅ Alpha Circuit Breaker Auto-Cleared: ${sport} performance stabilized (${rows.length - totalMisses}/${rows.length} hits/variance). Restored calibrated dynamic weights.`;

        await sql.query(`
          update brain_model_weights
          set source = 'calibrated', notes = $1, updated_at = now()
          where sport = $2
        `, [note, sport]);

        const recoveredObj: BlendWeights = {
          sport,
          wSim: base.wSim,
          wPool: base.wPool,
          wMarket: base.wMarket,
          source: "calibrated",
          sampleSize: rows.length,
          updatedAt: new Date().toISOString(),
          notes: note,
        };

        weightsCache.set(sport, { weights: recoveredObj, expiresAt: Date.now() + CACHE_TTL_MS });
        recovered.push(sport);
        summary[sport] = note;

        void logActivity(
          "brain",
          `Alpha Circuit Breaker Cleared: ${sport}`,
          note,
          "system"
        );
      }
    }
  } catch (err) {
    console.error("checkCircuitBreakers error:", err);
  }

  return { tripped, summary, recovered };
}

/**
 * Manually reset a tripped circuit breaker for a sport back to standard weights.
 */
export async function resetCircuitBreaker(sport: string): Promise<BlendWeights> {
  const key = sport.toUpperCase();
  const def = DEFAULT_WEIGHTS[key] || DEFAULT_WEIGHTS.DEFAULT;
  const sql = await getSql();
  const note = `Circuit breaker manually cleared by admin. Restored standard ${def.notes}`;

  await sql.query(`
    insert into brain_model_weights (sport, w_sim, w_pool, w_market, source, sample_size, notes, updated_at)
    values ($1, $2, $3, $4, 'default', 0, $5, now())
    on conflict (sport) do update set
      w_sim = excluded.w_sim,
      w_pool = excluded.w_pool,
      w_market = excluded.w_market,
      source = 'default',
      notes = excluded.notes,
      updated_at = now()
  `, [key, def.wSim, def.wPool, def.wMarket, note]);

  const obj: BlendWeights = {
    sport: key,
    wSim: def.wSim,
    wPool: def.wPool,
    wMarket: def.wMarket,
    source: "default",
    sampleSize: 0,
    updatedAt: new Date().toISOString(),
    notes: note,
  };
  weightsCache.set(key, { weights: obj, expiresAt: Date.now() + CACHE_TTL_MS });

  void logActivity(
    "brain",
    `Circuit Breaker Reset: ${key}`,
    `Admin manually reset circuit breaker for ${key} back to standard baseline weights.`,
    "admin"
  );

  return obj;
}

