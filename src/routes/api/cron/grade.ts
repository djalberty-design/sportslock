import { createFileRoute } from "@tanstack/react-router";
import { runMarketTape } from "@/lib/market/market-tape";
import { gradeMarketTape, gradePredictionLogs } from "@/lib/market/grade-tape";
import { gradePlayerProps } from "@/lib/market/prop-grader";
import { runTapeAutopsy } from "@/lib/market/autopsy-tape";
import { runPostGradeAnalysis } from "@/lib/market/post-grade-analysis";
import { calibrateWeights, checkCircuitBreakers } from "@/lib/market/dynamic-weights";
import { buildSuggestions } from "@/lib/market/suggestions";
import { logActivity } from "@/lib/market/activity";

export const Route = createFileRoute("/api/cron/grade")({
  server: {
    handlers: {
      GET: async () => handleGrade(),
      POST: async () => handleGrade(),
    }
  }
});

async function handleGrade() {
  const startedAt = Date.now();
  try {
    // Step 1: Snapshot current board state into market_tape
    const tapeSnapshot = await runMarketTape().catch((e) => ({ ok: false, wrote: 0, skipped: 0, error: String(e) }));

    // Step 2: Grade game tape lines (ML, Spread, Totals) against ESPN live/final scores
    const tapeResult = await gradeMarketTape().catch((e) => ({ graded: 0, unmatched: 0, historical: 0, expired: 0, error: String(e) }));

    // Step 3: Grade prediction logs (legacy ledger)
    const predResult = await gradePredictionLogs().catch((e) => ({ graded: 0, unmatched: 0, historical: 0, expired: 0, error: String(e) }));

    // Step 4: Grade player props against completed ESPN boxscores
    const propResult = await gradePlayerProps().catch(() => ({ graded: 0, unmatched: 0, skipped: 0, expired: 0 }));

    // Step 5: Loss Autopsy classification (categorizes into 4 buckets: model_miss, echoed_book, high_variance, settled)
    const autopsyResult = await runTapeAutopsy().catch(() => ({ ok: false }));

    // Step 6: Post-Grade Deep Analysis (segmented Brier scores, calibration drift, edge profitability)
    const postGradeResult = await runPostGradeAnalysis().catch(() => ({ ok: false }));

    // Step 7: Dynamic Blend Weights Calibration (re-weights 7d/30d performance safely)
    const calibrationResult = await calibrateWeights().catch(() => ({ ok: false, updated: [], summary: {} }));

    // Step 7b: Alpha Drawdown Circuit Breakers (auto-reverts any sport with >= 4 model misses to defensive baseline)
    const circuitBreakerResult = await checkCircuitBreakers().catch(() => ({ tripped: [] as string[], summary: {}, recovered: [] as string[] }));

    // Step 8: Algorithmic Suggestion Generation (haircuts, sit orders, model tweaks)
    const suggestionResult = await buildSuggestions().catch(() => ({ ok: false }));

    const totalGraded = tapeResult.graded + predResult.graded + propResult.graded;

    // Log to activity feed if anything was graded, calibrated, or circuit breakers changed
    if (
      totalGraded > 0 ||
      (calibrationResult.updated && calibrationResult.updated.length > 0) ||
      (circuitBreakerResult.recovered && circuitBreakerResult.recovered.length > 0) ||
      (circuitBreakerResult.tripped && circuitBreakerResult.tripped.length > 0)
    ) {
      void logActivity(
        "cron",
        `Autonomous Grading Sweep Complete: ${totalGraded} graded`,
        `Market Tape: ${tapeResult.graded}, Props: ${propResult.graded}, Ledger: ${predResult.graded}. Sports Calibrated: ${calibrationResult.updated?.join(", ") || "None"}. Circuit Breakers Tripped: ${circuitBreakerResult.tripped?.join(", ") || "None"}${circuitBreakerResult.recovered?.length ? `, Cleared: ${circuitBreakerResult.recovered.join(", ")}` : ""}`,
        "system"
      ).catch(() => {});
    }

    return new Response(JSON.stringify({ 
      success: true, 
      durationMs: Date.now() - startedAt,
      snappedTape: tapeSnapshot.wrote || 0,
      totalGraded,
      breakdown: {
        marketTape: tapeResult,
        predictionLogs: predResult,
        playerProps: propResult,
      },
      autopsyRun: autopsyResult.ok,
      postGradeRun: postGradeResult.ok,
      recalibratedSports: calibrationResult.updated || [],
      suggestionsBuilt: suggestionResult.ok,
    }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Autonomous grading sweep cron failed:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}