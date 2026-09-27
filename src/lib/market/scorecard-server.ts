import { createServerFn } from "@tanstack/react-start";
import { getSql } from "../db.ts";
import { buildPublicScorecard, type ScorecardPick } from "./scorecard.ts";

export const getPublicScorecardFn = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const sql = await getSql();
    const rows = await sql`
      SELECT recommended, market_type, status, model_probability, price
      FROM market_tape
      WHERE status IN ('WIN', 'LOSS')
      ORDER BY COALESCE(graded_at, snapped_at) ASC
      LIMIT 500
    `;
    const picks: ScorecardPick[] = (rows as any[]).map((r) => ({
      recommended: r.recommended !== false,
      oneSided: String(r.market_type || "") !== "parlay",
      status: String(r.status || ""),
      modelProb: r.model_probability != null ? Number(r.model_probability) : null,
      marketPrice: r.price != null ? Number(r.price) : null,
      closePrice: null,
    }));
    return { ok: true as const, card: buildPublicScorecard(picks) };
  } catch (e) {
    return { ok: false as const, error: String(e), card: buildPublicScorecard([]) };
  }
});
