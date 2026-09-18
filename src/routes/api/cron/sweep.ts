import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { buildLiveSnapshot } from "@/lib/market/live-board";
import { buildScan } from "@/lib/market/engine";
import { logPrediction } from "@/lib/market/ledger";
import { rowToPick } from "@/lib/market/research";
import type { ScanRow } from "@/lib/market/engine";

export const Route = createFileRoute("/api/cron/sweep")({
  server: {
    handlers: {
      GET: async () => handleSweep(),
      POST: async () => handleSweep(),
    }
  }
});

async function handleSweep() {
  const sql = await getSql();

  try {
    const snapshot = await buildLiveSnapshot();
    const scan = await buildScan(snapshot, false);
    const rows = scan.rows;

    const now = Date.now();

    // Log ALL predictions for games starting within 2 hours
    // This gives us comprehensive accuracy tracking for brain self-improvement
    const upcoming = rows.filter((r: ScanRow) => {
      if (!r.start) return false;
      const startMs = new Date(r.start).getTime();
      const diffMins = (startMs - now) / 60000;
      return diffMins >= 0 && diffMins <= 120;
    });

    if (upcoming.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No upcoming games in sweep window" }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check which event+market combos are already logged to avoid duplicates
    const eventIds = [...new Set(upcoming.map((r: ScanRow) => r.eventId))];
    const existing = await sql`
      SELECT event_id, market_type, selection FROM prediction_logs 
      WHERE event_id = ANY(${eventIds})
    `;
    const loggedKeys = new Set(existing.map((row) => `${row.event_id}|${row.market_type}|${row.selection}`));

    const paperSnapshot = { ...snapshot, isPaperTrade: true };
    const insertPromises: Promise<void>[] = [];
    let loggedCount = 0;
    let skippedCount = 0;

    for (const r of upcoming) {
      const key = `${r.eventId}|${r.marketType}|${r.selection}`;
      if (loggedKeys.has(key)) {
        skippedCount++;
        continue;
      }

      // Log every prediction: ML, spread, total, AND props
      // This is what makes the brain self-improving — we track every angle
      const pick = rowToPick(r);
      insertPromises.push(logPrediction(pick, paperSnapshot) as Promise<void>);
      loggedCount++;
    }

    // Execute all database writes in parallel
    await Promise.all(insertPromises);

    return new Response(JSON.stringify({ 
      success: true, 
      loggedCount, 
      skippedDuplicates: skippedCount,
      totalUpcoming: upcoming.length,
      uniqueEvents: eventIds.length,
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error("Sweeper failed:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}