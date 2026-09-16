import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { buildLiveSnapshot } from "@/lib/market/live-board";
import { buildScan } from "@/lib/market/engine";
import { buildDeskPicks } from "@/lib/market/picks";
import { rowToPick } from "@/lib/market/research";
import { logPrediction } from "@/lib/market/ledger";
import type { DeskPick } from "@/lib/market/picks";

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
    const scan = buildScan(snapshot, false);
    const bag = buildDeskPicks(scan, snapshot);

    const now = Date.now();
    const upcomingPicks = bag.all.filter((p) => {
      if (!p.start || !p.row) return false;
      const startMs = new Date(p.start).getTime();
      const diffMins = (startMs - now) / 60000;
      return diffMins >= 0 && diffMins <= 90;
    });

    const byEvent = new Map<string, DeskPick[]>();
    for (const p of upcomingPicks) {
      if (!p.eventId) continue;
      const group = byEvent.get(p.eventId) || [];
      group.push(p);
      byEvent.set(p.eventId, group);
    }

    if (byEvent.size === 0) {
      return new Response(JSON.stringify({ success: true, message: "No upcoming games in sweep window" }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const eventIds = Array.from(byEvent.keys());
    
    const existing = await sql`
      SELECT event_id FROM prediction_logs 
      WHERE event_id = ANY(${eventIds})
    `;
    const loggedIds = new Set(existing.map((row) => row.event_id));

    const paperSnapshot = { ...snapshot, isPaperTrade: true };
    const insertPromises: Promise<void>[] = [];
    let loggedCount = 0;

    for (const [eventId, picksForEvent] of byEvent.entries()) {
      if (loggedIds.has(eventId)) continue;

      // Track the best +EV pick for EACH market type (moneyline, spread, total)
      const bestByMarket = new Map<string, { pick: any, edge: number }>();

      for (const p of picksForEvent) {
        const payout = p.price < 0 ? (100 / Math.abs(p.price)) + 1 : (p.price / 100) + 1;
        const edge = (p.chance * payout) - 1;
        
        // STRICT +EV FLOOR: Only log mathematically profitable angles (> 1% edge)
        if (edge < 0.01) continue;

        const mType = p.row?.marketType || 'moneyline';
        const currentBest = bestByMarket.get(mType);

        if (!currentBest || edge > currentBest.edge) {
          bestByMarket.set(mType, { pick: p, edge });
        }
      }

      // Queue the best +EV picks for this event
      for (const { pick } of bestByMarket.values()) {
        if (pick.row) {
          const parlayPick = rowToPick(pick.row);
          insertPromises.push(logPrediction(parlayPick, paperSnapshot) as Promise<void>);
          loggedCount++;
        }
      }
    }

    // Execute all database writes in parallel to prevent serverless timeouts
    await Promise.all(insertPromises);

    return new Response(JSON.stringify({ success: true, loggedCount, sweepWindowTotal: byEvent.size }), {
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