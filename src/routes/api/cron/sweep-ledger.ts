import { createFileRoute } from "@tanstack/react-router";
import { sweepLedger } from "@/lib/market/sweeper";
import { runMarketTape } from "@/lib/market/market-tape";
import { gradeMarketTape } from "@/lib/market/grade-tape";
import { runTapeAutopsy } from "@/lib/market/autopsy-tape";
import { buildSuggestions } from "@/lib/market/suggestions";
import { runPostGradeAnalysis } from "@/lib/market/post-grade-analysis";

export const Route = createFileRoute("/api/cron/sweep-ledger")({
  server: {
    handlers: {
      GET: async () => handleSweep(),
      POST: async () => handleSweep(),
    },
  },
});

async function handleSweep() {
  try {
    // Step 1: Sweep the ledger (sync user bets)
    const ledger = await sweepLedger();

    // Step 2: Record new predictions to the tape
    const tape = await runMarketTape();

    // Step 3: Grade predictions (live + historical + expire old)
    const grade = await gradeMarketTape();

    // Step 4: Run autopsy on graded results
    const autopsy = await runTapeAutopsy();

    // Step 5: Generate improvement suggestions from tape analysis
    const suggestions = await buildSuggestions();

    // Step 6: Run post-grade analysis (Brier segments, calibration drift, edge profitability)
    // This is the self-improvement loop — runs AFTER grading so it has fresh data
    const analysis = await runPostGradeAnalysis();

    return new Response(
      JSON.stringify({ success: true, ledger, tape, grade, autopsy, suggestions, analysis }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Sweeper CRON failed:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
