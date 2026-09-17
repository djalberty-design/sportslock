import { createFileRoute } from "@tanstack/react-router";
import { sweepLedger } from "@/lib/market/sweeper";

export const Route = createFileRoute("/api/cron/sweep-ledger")({
  server: {
    handlers: {
      GET: async () => handleSweep(),
      POST: async () => handleSweep(),
    }
  }
});

async function handleSweep() {
  try {
    const result = await sweepLedger();
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error("Sweeper CRON failed:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}