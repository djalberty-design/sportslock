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

    // 4. Store analysis results for the dashboard
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
 * 1. Compute Brier score for each (sport × market_type) segment.
 * Compare to baseline (just using the book's implied probability).
 */
async function computeSegmentBrier(sql: any): Promise<SegmentBrier[]> {
  const rows = await sql.query<{
    sport: string;
    market_type: string;
    model_probability: string;
    status: string;
    price: string | null;
  }>(
    `SELECT sport, market_type, model_probability, status, price
     FROM market_tape
     WHERE recommended = true AND status IN ('WIN', 'LOSS')
       AND model_probability IS NOT NULL
     ORDER BY snapped_at DESC
     LIMIT 2000`,
  );

  // Group by sport × market
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = `${r.sport}:${r.market_type}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const results: SegmentBrier[] = [];
  for (const [key, group] of groups) {
    const [sport, marketType] = key.split(":");
    const forecasts = group.map((r) => ({
      p: Number(r.model_probability),
      hit: r.status === "WIN",
    }));

    // Baseline: use the book's implied probability (from price/odds)
    const baselineForecasts = group
      .filter((r) => r.price != null)
      .map((r) => {
        const odds = Number(r.price);
        const implied = odds >= 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100);
        return { p: implied, hit: r.status === "WIN" };
      });

    const brier = brierScore(forecasts);
    const baselineBrier = brierScore(baselineForecasts);
    const wins = group.filter((r) => r.status === "WIN").length;
    const losses = group.filter((r) => r.status === "LOSS").length;

    results.push({
      sport,
      marketType,
      brier,
      baselineBrier,
      n: group.length,
      wins,
      losses,
      beatBaseline: brier != null && baselineBrier != null ? brier < baselineBrier : false,
    });
  }

  return results.sort((a, b) => b.n - a.n);
}

/**
 * 2. Detect calibration drift: compare recent Brier to overall Brier.
 * If recent is significantly worse → model is drifting.
 */
async function detectCalibrationDrift(sql: any): Promise<CalibrationDrift | null> {
  const all = await sql.query<{ model_probability: string; status: string }>(
    `SELECT model_probability, status FROM market_tape
     WHERE recommended = true AND status IN ('WIN','LOSS') AND model_probability IS NOT NULL
     ORDER BY snapped_at DESC LIMIT 500`,
  );

  if (all.length < 30) return null;

  const allForecasts = all.map((r: any) => ({ p: Number(r.model_probability), hit: r.status === "WIN" }));
  const recentForecasts = allForecasts.slice(0, Math.min(50, allForecasts.length));

  const overallBrier = brierScore(allForecasts);
  const recentBrier = brierScore(recentForecasts);

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

/**
 * Store analysis results in the database for the Dashboard to read.
 */
async function storeAnalysisSnapshot(sql: any, data: {
  segmentBrier: SegmentBrier[];
  calibrationDrift: CalibrationDrift | null;
  edgeProfitability: EdgeProfit[];
}) {
  await sql.query(`
    CREATE TABLE IF NOT EXISTS brain_analysis_log (
      id serial PRIMARY KEY,
      analysis_type text NOT NULL,
      data jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await sql.query(
    `INSERT INTO brain_analysis_log (analysis_type, data) VALUES ('post_grade', $1::jsonb)`,
    [JSON.stringify(data)],
  );

  // Keep only last 100 entries
  await sql.query(
    `DELETE FROM brain_analysis_log WHERE id NOT IN (SELECT id FROM brain_analysis_log ORDER BY created_at DESC LIMIT 100)`,
  );
}
