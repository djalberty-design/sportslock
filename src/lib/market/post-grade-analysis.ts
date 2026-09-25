// @ts-nocheck
/**
 * Post-Grade Analysis Pipeline (Phase 2)
 *
 * After every grading sweep, this runs automatically to:
 * 1. Compute segmented Brier scores (sport × market)
 * 2. Run layer precision audits (which data sources help vs hurt)
 * 3. Check calibration drift (is the model getting more/less confident?)
 * 4. Calculate edge profitability (do the model's "edges" actually make money?)
 * 5. Generate improvement suggestions based on findings
 *
 * This is the CLOSED LOOP that makes the brain self-improving:
 * PREDICT → GRADE → ANALYZE (this file) → ADJUST → PREDICT (better)
 */

import { getSql } from "@/lib/db";
import { brierScore } from "./brier";
import { reliabilityTable, setReliabilityTable } from "./calibrate";

export type AnalysisResult = {
  ok: boolean;
  segmentBrier: SegmentBrier[];
  calibrationDrift: CalibrationDrift | null;
  edgeProfitability: EdgeProfit[];
  timestamp: string;
  error?: string;
};

type SegmentBrier = {
  sport: string;
  marketType: string;
  brier: number | null;
  baselineBrier: number | null;
  n: number;
  wins: number;
  losses: number;
  beatBaseline: boolean;
};

type CalibrationDrift = {
  recentBrier: number | null;
  overallBrier: number | null;
  drift: number;
  direction: "improving" | "worsening" | "stable";
};

type EdgeProfit = {
  tier: string;
  n: number;
  wins: number;
  winRate: number;
  avgEdge: number;
  profitable: boolean;
};

/**
 * Run the full post-grade analysis pipeline.
 * Called after gradeMarketTape() in the sweep cron.
 */
export async function runPostGradeAnalysis(): Promise<AnalysisResult> {
  try {
    const sql = await getSql();

    // 1. Segmented Brier scores
    const segmentBrier = await computeSegmentBrier(sql);

    // 2. Calibration drift detection
    const calibrationDrift = await detectCalibrationDrift(sql);

    // 3. Edge profitability
    const edgeProfitability = await computeEdgeProfitability(sql);

    // 4. Update reliability table from graded data → feeds back into calibratedChance()
    // This is the key self-correction: future predictions use actual hit rates, not just model estimates
    await updateReliabilityFromTape(sql);

    // 5. Store analysis results for the dashboard
    await storeAnalysisSnapshot(sql, { segmentBrier, calibrationDrift, edgeProfitability });

    return {
      ok: true,
      segmentBrier,
      calibrationDrift,
      edgeProfitability,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error("Post-grade analysis failed:", err);
    return {
      ok: false,
      segmentBrier: [],
      calibrationDrift: null,
      edgeProfitability: [],
      timestamp: new Date().toISOString(),
      error: String(err),
    };
  }
}

/**
 * 1. Compute Brier score for each (sport × market_type) segment directly in SQL.
 * Compare to baseline (using the book's implied probability).
 * Pushes computation into PostgreSQL to eliminate overfetching 2000 raw rows over Neon egress.
 */
async function computeSegmentBrier(sql: any): Promise<SegmentBrier[]> {
  const rows = await sql.query<{
    sport: string;
    market_type: string;
    n: number;
    wins: number;
    losses: number;
    valid_model_n: number;
    raw_brier: number | string | null;
    valid_baseline_n: number;
    raw_baseline_brier: number | string | null;
  }>(
    `WITH recent AS (
       SELECT
         sport,
         market_type,
         model_probability::numeric AS p,
         status,
         price::numeric AS odds
       FROM market_tape
       WHERE recommended = true AND status IN ('WIN', 'LOSS')
         AND model_probability IS NOT NULL
       ORDER BY snapped_at DESC
       LIMIT 2000
     ),
     calc AS (
       SELECT
         sport,
         market_type,
         p,
         status,
         CASE WHEN status = 'WIN' THEN 1.0 ELSE 0.0 END AS hit,
         CASE
           WHEN odds IS NOT NULL AND odds >= 0 THEN 100.0 / (odds + 100.0)
           WHEN odds IS NOT NULL AND odds < 0 THEN ABS(odds) / (ABS(odds) + 100.0)
           ELSE NULL
         END AS baseline_p
       FROM recent
     )
     SELECT
       sport,
       market_type,
       COUNT(*)::int AS n,
       COUNT(*) FILTER (WHERE status = 'WIN')::int AS wins,
       COUNT(*) FILTER (WHERE status = 'LOSS')::int AS losses,
       COUNT(*) FILTER (WHERE p > 0 AND p < 1)::int AS valid_model_n,
       AVG(POWER(p - hit, 2)) FILTER (WHERE p > 0 AND p < 1) AS raw_brier,
       COUNT(*) FILTER (WHERE baseline_p > 0 AND baseline_p < 1)::int AS valid_baseline_n,
       AVG(POWER(baseline_p - hit, 2)) FILTER (WHERE baseline_p > 0 AND baseline_p < 1) AS raw_baseline_brier
     FROM calc
     GROUP BY sport, market_type
     ORDER BY n DESC`,
  );

  return rows.map((r: any) => {
    const validModelN = Number(r.valid_model_n || 0);
    const validBaselineN = Number(r.valid_baseline_n || 0);
    const brier = validModelN >= 8 && r.raw_brier != null ? Number(r.raw_brier) : null;
    const baselineBrier = validBaselineN >= 8 && r.raw_baseline_brier != null ? Number(r.raw_baseline_brier) : null;

    return {
      sport: String(r.sport || ""),
      marketType: String(r.market_type || ""),
      brier,
      baselineBrier,
      n: Number(r.n || 0),
      wins: Number(r.wins || 0),
      losses: Number(r.losses || 0),
      beatBaseline: brier != null && baselineBrier != null ? brier < baselineBrier : false,
    };
  });
}

/**
 * 2. Detect calibration drift: compare recent Brier to overall Brier in SQL.
 * Returns 1 single aggregated row instead of transferring 500 rows over Neon egress.
 */
async function detectCalibrationDrift(sql: any): Promise<CalibrationDrift | null> {
  const rows = await sql.query<{
    total_count: number;
    valid_all_n: number;
    overall_brier: number | string | null;
    valid_recent_n: number;
    recent_brier: number | string | null;
  }>(
    `WITH recent_tape AS (
       SELECT
         model_probability::numeric AS p,
         CASE WHEN status = 'WIN' THEN 1.0 ELSE 0.0 END AS hit,
         ROW_NUMBER() OVER (ORDER BY snapped_at DESC) AS rn
       FROM market_tape
       WHERE recommended = true AND status IN ('WIN','LOSS') AND model_probability IS NOT NULL
       ORDER BY snapped_at DESC
       LIMIT 500
     )
     SELECT
       COUNT(*)::int AS total_count,
       COUNT(*) FILTER (WHERE p > 0 AND p < 1)::int AS valid_all_n,
       AVG(POWER(p - hit, 2)) FILTER (WHERE p > 0 AND p < 1) AS overall_brier,
       COUNT(*) FILTER (WHERE rn <= 50 AND p > 0 AND p < 1)::int AS valid_recent_n,
       AVG(POWER(p - hit, 2)) FILTER (WHERE rn <= 50 AND p > 0 AND p < 1) AS recent_brier
     FROM recent_tape`,
  );

  if (!rows || !rows.length || Number(rows[0].total_count || 0) < 30) return null;

  const r = rows[0];
  const validAllN = Number(r.valid_all_n || 0);
  const validRecentN = Number(r.valid_recent_n || 0);

  const overallBrier = validAllN >= 8 && r.overall_brier != null ? Number(r.overall_brier) : null;
  const recentBrier = validRecentN >= 8 && r.recent_brier != null ? Number(r.recent_brier) : null;

  if (overallBrier == null || recentBrier == null) return null;

  const drift = recentBrier - overallBrier;
  let direction: "improving" | "worsening" | "stable" = "stable";
  if (drift > 0.02) direction = "worsening";
  else if (drift < -0.02) direction = "improving";

  return { recentBrier, overallBrier, drift, direction };
}

/**
 * 3. Edge profitability: for each edge tier, compute win rate.
 * If the model says "high edge" but those bets lose → overconfident.
 */
async function computeEdgeProfitability(sql: any): Promise<EdgeProfit[]> {
  const rows = await sql.query<{ edge_tier: string; wins: number; total: number; avg_edge: number }>(
    `SELECT
       CASE
         WHEN ABS(edge) >= 5 THEN 'HIGH (≥5%)'
         WHEN ABS(edge) >= 2 THEN 'LOW (2-5%)'
         ELSE 'MICRO (<2%)'
       END AS edge_tier,
       count(*) FILTER (WHERE status = 'WIN')::int AS wins,
       count(*)::int AS total,
       round(avg(ABS(edge))::numeric, 2) AS avg_edge
     FROM market_tape
     WHERE recommended = true AND status IN ('WIN','LOSS') AND edge IS NOT NULL
     GROUP BY 1
     ORDER BY avg_edge DESC`,
  );

  return rows.map((r) => ({
    tier: r.edge_tier,
    n: r.total,
    wins: r.wins,
    winRate: r.total > 0 ? Math.round((r.wins / r.total) * 100) : 0,
    avgEdge: Number(r.avg_edge),
    profitable: r.total > 0 ? r.wins / r.total > 0.524 : false, // 52.4% = break even at -110
  }));
}

let brainAnalysisLogTableEnsured = false;

/**
 * Store analysis results in the database for the Dashboard to read.
 */
async function storeAnalysisSnapshot(sql: any, data: {
  segmentBrier: SegmentBrier[];
  calibrationDrift: CalibrationDrift | null;
  edgeProfitability: EdgeProfit[];
}) {
  if (!brainAnalysisLogTableEnsured) {
    await sql.query(`
      CREATE TABLE IF NOT EXISTS brain_analysis_log (
        id serial PRIMARY KEY,
        analysis_type text NOT NULL,
        data jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    brainAnalysisLogTableEnsured = true;
  }

  await sql.query(
    `INSERT INTO brain_analysis_log (analysis_type, data) VALUES ('post_grade', $1::jsonb)`,
    [JSON.stringify(data)],
  );

  // Keep only last 100 entries
  await sql.query(
    `DELETE FROM brain_analysis_log WHERE id NOT IN (SELECT id FROM brain_analysis_log ORDER BY created_at DESC LIMIT 100)`,
  );
}

/**
 * Update the in-memory reliability table from graded market_tape data.
 *
 * This is the KEY self-correction mechanism:
 * - Pull all graded predictions (model_probability + WIN/LOSS)
 * - Build a reliability table: for each probability bucket, what's the ACTUAL hit rate?
 * - Set it as the active table so calibratedChance() uses empirical data
 * - Future predictions are adjusted based on where the model over/under-predicts
 *
 * Example: If the model predicts 70% and those picks actually hit 62%,
 * the reliability table maps 70% → 62%, making future 70% predictions
 * display as ~62% (more honest) and reducing recommended edge.
 */
async function updateReliabilityFromTape(sql: any): Promise<void> {
  const rows = await sql.query<{ model_probability: string; status: string }>(
    `SELECT model_probability, status FROM market_tape
     WHERE recommended = true AND status IN ('WIN','LOSS') AND model_probability IS NOT NULL
     ORDER BY snapped_at DESC LIMIT 500`,
  );

  if (rows.length < 30) return; // Not enough data to build reliable table

  const forecasts = rows.map((r: any) => ({
    p: Number(r.model_probability),
    hit: r.status === "WIN",
  }));

  const table = reliabilityTable(forecasts);
  setReliabilityTable(table);

  console.log(
    `[post-grade] Updated reliability table from ${rows.length} graded predictions`,
    table.map((b) => `${Math.round(b.lo * 100)}-${Math.round(b.hi * 100)}%: ${b.n} samples, model ${Math.round(b.meanP * 100)}% → actual ${Math.round(b.hitRate * 100)}%`),
  );
}
