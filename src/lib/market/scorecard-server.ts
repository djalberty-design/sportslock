import { createServerFn } from "@tanstack/react-start";
import { getSql } from "../db.ts";
import { backfillClosePrices } from "./backfill-close.ts";
import { buildPublicScorecard, type ScorecardPick } from "./scorecard.ts";

export const getPublicScorecardFn = createServerFn({ method: "POST" }).handler(async () => {
  try {
    await backfillClosePrices();
    const sql = await getSql();
    const rows = await sql`
      SELECT recommended, market_type, status, model_probability, price, close_price
      FROM market_tape
      WHERE status IN ('WIN', 'LOSS')
        AND lower(coalesce(market_type, '')) IN ('ml', 'spread', 'total', 'h2h', 'moneyline')
      ORDER BY COALESCE(graded_at, snapped_at) ASC
      LIMIT 2000
    `;
    const picks: ScorecardPick[] = (rows as any[]).map((r) => ({
      recommended: r.recommended !== false,
      oneSided: true,
      marketType: String(r.market_type || ""),
      status: String(r.status || ""),
      modelProb: r.model_probability != null ? Number(r.model_probability) : null,
      marketPrice: r.price != null ? Number(r.price) : null,
      closePrice: r.close_price != null ? Number(r.close_price) : null,
    }));
    return { ok: true as const, card: buildPublicScorecard(picks) };
  } catch (e) {
    return { ok: false as const, error: String(e), card: buildPublicScorecard([]) };
  }
});
