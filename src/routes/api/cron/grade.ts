import { createFileRoute } from "@tanstack/react-router";
import { runMarketTape } from "@/lib/market/market-tape";
import { gradeMarketTape, gradePredictionLogs } from "@/lib/market/grade-tape";
import { gradePlayerProps } from "@/lib/market/prop-grader";
import { runTapeAutopsy } from "@/lib/market/autopsy-tape";
import { runPostGradeAnalysis } from "@/lib/market/post-grade-analysis";
import { calibrateWeights, checkCircuitBreakers } from "@/lib/market/dynamic-weights";
import { WEIGHT_STEERING_FROZEN } from "@/lib/market/weight-freeze";
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
    const tapeSnapshot = await runMarketTape().catch((e) => ({ ok: false, wrote: 0, skipped: 0, error: String(e) }));
    const tapeResult = await gradeMarketTape().catch((e) => ({ graded: 0, unmatched: 0, historical: 0, expired: 0, error: String(e) }));
    const predResult = await gradePredictionLogs().catch((e) => ({ graded: 0, unmatched: 0, historical: 0, expired: 0, error: String(e) }));
    const propResult = await gradePlayerProps().catch(() => ({ graded: 0, unmatched: 0, skipped: 0, expired: 0 }));
    const autopsyResult = await runTapeAutopsy().catch(() => ({ ok: false }));
    const postGradeResult = await runPostGradeAnalysis().catch(() => ({ ok: false }));

    const calibrationResult = WEIGHT_STEERING_FROZEN
      ? { ok: true, updated: [] as string[], summary: {} }
      : await calibrateWeights().catch(() => ({ ok: false, updated: [] as string[], summary: {} }));

    const circuitBreakerResult = await checkCircuitBreakers().catch(() => ({ tripped: [] as string[], summary: {}, recovered: [] as string[] }));
    const suggestionResult = await buildSuggestions().catch(() => ({ ok: false }));
    const totalGraded = tapeResult.graded + predResult.graded + propResult.graded;

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
      weightsFrozen: WEIGHT_STEERING_FROZEN,
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
