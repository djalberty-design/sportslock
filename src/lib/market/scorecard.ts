import { computeClv, calculateBrierScore } from "../clv-tracker.ts";
import { americanToDecimal, impliedFromAmerican } from "./book-price.ts";

export type ScorecardPick = {
  recommended?: boolean;
  oneSided?: boolean;
  marketType?: string;
  status: "WIN" | "LOSS" | string;
  modelProb: number | null;
  marketPrice: number | null;
  closePrice: number | null;
  units?: number;
};

export type LossKind = "model_error" | "variance" | "unknown_clv";

export type PublicScorecard = {
  n: number;
  clvSample: number;
  clvBeatRate: number | null;
  modelBrier: number | null;
  bookBrier: number | null;
  brierDelta: number | null;
  last30Units: number;
  losingStretch: number;
  caveat: string;
};

export function isMainMarketType(marketType?: string): boolean {
  const t = String(marketType || "").toLowerCase();
  return t === "ml" || t === "spread" || t === "total" || t === "h2h" || t === "moneyline";
}

export function isScorecardEligible(pick: ScorecardPick): boolean {
  if (pick.recommended === false) return false;
  if (pick.oneSided === false) return false;
  if (!isMainMarketType(pick.marketType)) return false;
  return pick.status === "WIN" || pick.status === "LOSS";
}

export function lossAttribution(closeClvCents: number | null, lost: boolean): LossKind | null {
  if (!lost) return null;
  if (closeClvCents == null) return "unknown_clv";
  return closeClvCents < 0 ? "model_error" : "variance";
}

function unitPnl(price: number, win: boolean): number {
  const dec = americanToDecimal(price);
  if (!Number.isFinite(dec) || dec <= 1) return win ? 0 : -1;
  return win ? dec - 1 : -1;
}

export function buildPublicScorecard(picks: ScorecardPick[]): PublicScorecard {
  const rows = picks.filter(isScorecardEligible);
  const modelBrierInputs = rows
    .filter((r) => r.modelProb != null && r.modelProb > 0 && r.modelProb < 1)
    .map((r) => ({ fairProb: r.modelProb as number, hit: r.status === "WIN" }));
  const bookBrierInputs = rows
    .filter((r) => r.marketPrice != null)
    .map((r) => {
      const p = impliedFromAmerican(r.marketPrice as number);
      return p != null && p > 0 && p < 1 ? { fairProb: p, hit: r.status === "WIN" } : null;
    })
    .filter((x): x is { fairProb: number; hit: boolean } => Boolean(x));

  const clvRows = rows.filter((r) => r.marketPrice != null && r.closePrice != null);
  let beats = 0;
  for (const r of clvRows) {
    if (computeClv(r.marketPrice as number, r.closePrice as number).beatTheClosingLine) beats += 1;
  }

  const chronological = [...rows];
  let stretch = 0;
  for (let i = chronological.length - 1; i >= 0; i -= 1) {
    if (chronological[i].status !== "LOSS") break;
    stretch += 1;
  }

  const last30 = rows.slice(-30);
  const last30Units = last30.reduce((sum, r) => {
    if (r.marketPrice == null) return sum;
    return sum + unitPnl(r.marketPrice, r.status === "WIN") * (r.units ?? 1);
  }, 0);

  const modelBrier = modelBrierInputs.length ? calculateBrierScore(modelBrierInputs) : null;
  const bookBrier = bookBrierInputs.length ? calculateBrierScore(bookBrierInputs) : null;

  return {
    n: rows.length,
    clvSample: clvRows.length,
    clvBeatRate: clvRows.length ? Math.round((beats / clvRows.length) * 1000) / 10 : null,
    modelBrier,
    bookBrier,
    brierDelta: modelBrier != null && bookBrier != null ? Math.round((modelBrier - bookBrier) * 10000) / 10000 : null,
    last30Units: Math.round(last30Units * 100) / 100,
    losingStretch: stretch,
    caveat:
      clvRows.length === 0
        ? "Sides and totals only. CLV stays blank until a real close is stored. Props are graded separately."
        : "Sides and totals only — moneyline, spread, over/under. Player props are not in this tape.",
  };
}
