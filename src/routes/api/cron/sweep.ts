import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { snapshotWithLiveScores } from "@/lib/market/with-live-scores";
import { buildScan } from "@/lib/market/engine";
import { logPrediction } from "@/lib/market/ledger";
import { rowToPick } from "@/lib/market/research";
import { logActivity } from "@/lib/market/activity";
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
    const snapshot = await snapshotWithLiveScores();
    const scan = await buildScan(snapshot, false);
    const rows = scan.rows;

    const now = Date.now();

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

    // Only log the recommended side of each market (highest edge)
    // This prevents the 50/50 problem where both sides are logged
    const marketGroups = new Map<string, ScanRow[]>();
    for (const r of upcoming) {
      const mKey = `${r.eventId}|${r.marketType}`;
      const arr = marketGroups.get(mKey) || [];
      arr.push(r);
      marketGroups.set(mKey, arr);
    }

    const recommended: ScanRow[] = [];
    for (const [, group] of marketGroups) {
      if (group.length === 0) continue;
      // Pick the side with the highest edge (our model's actual recommendation)
      let best = group[0];
      for (const r of group) {
        const rEdge = Number(r.edge) || 0;
        const bEdge = Number(best.edge) || 0;
        if (rEdge > bEdge) best = r;
      }
      recommended.push(best);
    }

    for (const r of recommended) {
      const key = `${r.eventId}|${r.marketType}|${r.selection}`;
      if (loggedKeys.has(key)) {
        skippedCount++;
        continue;
      }

      const pick = rowToPick(r);
      insertPromises.push(logPrediction(pick, paperSnapshot) as Promise<void>);
      loggedCount++;
    }

    await Promise.all(insertPromises);

    void logActivity("cron", "Sweep completed", `Logged ${loggedCount} picks from ${eventIds.length} events (${skippedCount} skipped dupes)`, "sweep-cron");

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
    void logActivity("error", "Sweep failed", String(err), "sweep-cron");
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
