import { createFileRoute } from "@tanstack/react-router";
import { sweepLedger } from "@/lib/market/sweeper";
import { runMarketTape } from "@/lib/market/market-tape";
import { gradeMarketTape } from "@/lib/market/grade-tape";
import { runTapeAutopsy } from "@/lib/market/autopsy-tape";

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
    const ledger = await sweepLedger();
    const tape = await runMarketTape();
    const grade = await gradeMarketTape();
    const autopsy = await runTapeAutopsy();
    return new Response(JSON.stringify({ success: true, ledger, tape, grade, autopsy }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Sweeper CRON failed:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
