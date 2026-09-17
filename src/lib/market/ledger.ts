import { getSql } from "@/lib/db";
import type { ParlayPick } from "./research";

export async function logPrediction(pick: ParlayPick, snapshotData: any) {
  try {
    const sql = await getSql();

    const price = pick.price || -110;
    const payout = price < 0 ? (100 / Math.abs(price)) + 1 : (price / 100) + 1;
    const edge = (pick.fairProb * payout) - 1;
    
    const eventId = pick.eventId || "unknown";
    const selection = pick.selection || "unknown";
    const marketType = pick.marketType || "moneyline";
    const line = pick.point ?? null;
    const modelProb = pick.fairProb || 0;
    const edgeVal = isNaN(edge) ? 0 : edge;

    await sql`
      INSERT INTO prediction_logs (
        event_id,
        selection,
        market_type,
        line,
        price,
        model_probability,
        edge,
        snapshot,
        status
      ) VALUES (
        ${eventId},
        ${selection},
        ${marketType},
        ${line},
        ${price},
        ${modelProb},
        ${edgeVal},
        ${JSON.stringify(snapshotData)}::jsonb,
        'PENDING'
      )
    `;
  } catch (err) {
    console.error("Failed to log prediction to immutable ledger", err);
  }
}