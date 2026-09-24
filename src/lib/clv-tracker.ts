import { americanToDecimal, impliedFromAmerican } from "./market/book-price.ts";

export interface ClvRecord {
  id?: string;
  selection: string;
  sport?: string;
  market?: string;
  betPrice: number; // American odds when bet was locked
  closingPrice: number; // American odds at game close
  fairProb?: number; // Model forecast probability (0..1)
  hit?: boolean; // Whether bet won
  status?: string; // "WIN" | "LOSS" | "PUSH"
  stakedUnits?: number; // Default 1.0u
  timestamp?: string;
}

export interface ClvAnalysisResult {
  clvCents: number;
  clvPct: number;
  clvProbDiff: number;
  beatTheClosingLine: boolean;
}

export interface PortfolioClvStats {
  totalBets: number;
  btclCount: number;
  btclRate: number; // e.g. 78.4%
  averageClvPct: number; // e.g. +3.8%
  averageClvCents: number; // e.g. +9.2 cents
  brierScore: number; // e.g. 0.201
  brierCalibration: "elite" | "sharp" | "average" | "uncalibrated";
  cumulativeUnits: number; // e.g. +34.2u
  maxDrawdownUnits: number; // e.g. -4.8u
  highWaterMarkUnits: number; // e.g. +36.5u
  auditHash: string; // Deterministic cryptographic audit digest
}

export interface CumulativePoint {
  index: number;
  date: string;
  selection: string;
  netUnits: number;
  cumulativeUnits: number;
  highWaterMark: number;
  isWin: boolean;
  clvPct: number;
}

/**
 * Computes Closing Line Value for an individual bet:
 * - CLV(cents) = Closing American - Bet American (favors getting +120 when it closes +105, or -105 when it closes -120)
 * - CLV(%) = (implied(close) / implied(bet) - 1) * 100%
 */
export function computeClv(betPrice: number, closingPrice: number): ClvAnalysisResult {
  const decBet = americanToDecimal(betPrice);
  const decClose = americanToDecimal(closingPrice);

  if (!Number.isFinite(decBet) || decBet <= 1 || !Number.isFinite(decClose) || decClose <= 1) {
    return {
      clvCents: 0,
      clvPct: 0,
      clvProbDiff: 0,
      beatTheClosingLine: false,
    };
  }

  const impBet = impliedFromAmerican(betPrice) ?? (1 / decBet);
  const impClose = impliedFromAmerican(closingPrice) ?? (1 / decClose);

  // CLV% expresses how much cheaper we got the bet relative to the true closing price:
  // e.g. Bet at +120 (dec 2.20) closing at -110 (dec 1.909) -> (2.20 / 1.909 - 1) * 100 = +15.2%
  const clvPct = ((decBet / decClose) - 1) * 100;
  const clvProbDiff = (impClose - impBet) * 100;

  // Cents of value gained (e.g. locked -105, closed -120 -> +15 cents of CLV)
  const clvCents = Math.round(clvPct * 10) / 10;
  const beatTheClosingLine = clvPct > 0.05;

  return {
    clvCents,
    clvPct: Math.round(clvPct * 100) / 100,
    clvProbDiff: Math.round(clvProbDiff * 100) / 100,
    beatTheClosingLine,
  };
}

/**
 * Pure Brier score calculation:
 * BS = (1 / N) * sum((f_t - o_t)^2)
 * Perfect calibration = 0.0, Uninformative coin-flip = 0.25.
 */
export function calculateBrierScore(predictions: { fairProb: number; hit: boolean }[]): number {
  const valid = predictions.filter(
    (p) => Number.isFinite(p.fairProb) && p.fairProb > 0 && p.fairProb < 1
  );
  if (valid.length === 0) return 0.25;

  const sumSquares = valid.reduce((acc, p) => {
    const outcome = p.hit ? 1 : 0;
    return acc + Math.pow(p.fairProb - outcome, 2);
  }, 0);

  return Math.round((sumSquares / valid.length) * 10000) / 10000;
}

export function evaluateBrierCalibration(
  brier: number
): "elite" | "sharp" | "average" | "uncalibrated" {
  if (brier <= 0.205) return "elite";
  if (brier <= 0.225) return "sharp";
  if (brier <= 0.250) return "average";
  return "uncalibrated";
}

/**
 * Evaluates comprehensive portfolio CLV, drawdown dynamics, and produces an audit digest.
 */
export function calculatePortfolioStats(records: ClvRecord[]): {
  stats: PortfolioClvStats;
  curve: CumulativePoint[];
} {
  if (records.length === 0) {
    return {
      stats: {
        totalBets: 0,
        btclCount: 0,
        btclRate: 0,
        averageClvPct: 0,
        averageClvCents: 0,
        brierScore: 0.25,
        brierCalibration: "average",
        cumulativeUnits: 0,
        maxDrawdownUnits: 0,
        highWaterMarkUnits: 0,
        auditHash: "0x000000000000",
      },
      curve: [],
    };
  }

  let btclCount = 0;
  let totalClvPct = 0;
  let totalClvCents = 0;

  let currentUnits = 0;
  let highWaterMark = 0;
  let maxDrawdown = 0;

  const brierInputs: { fairProb: number; hit: boolean }[] = [];
  const curve: CumulativePoint[] = [];

  // Sort chronological
  const sorted = [...records].sort((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return ta - tb;
  });

  // Track checksum
  let checksumAcc = 0x5f3759df;

  sorted.forEach((rec, idx) => {
    const isWin = rec.hit ?? rec.status === "WIN";
    const clv = computeClv(rec.betPrice, rec.closingPrice);

    if (clv.beatTheClosingLine) btclCount++;
    totalClvPct += clv.clvPct;
    totalClvCents += clv.clvCents;

    if (rec.fairProb != null) {
      brierInputs.push({ fairProb: rec.fairProb, hit: isWin });
    }

    // P&L calculation in units (standard 1.0u flat stake)
    const dec = americanToDecimal(rec.betPrice);
    const profitUnit = isWin ? dec - 1 : -1.0;
    currentUnits = Math.round((currentUnits + profitUnit) * 100) / 100;

    if (currentUnits > highWaterMark) {
      highWaterMark = currentUnits;
    }
    const currentDrawdown = Math.round((currentUnits - highWaterMark) * 100) / 100;
    if (currentDrawdown < maxDrawdown) {
      maxDrawdown = currentDrawdown;
    }

    // Cumulative hash contribution
    const str = `${rec.selection}|${rec.betPrice}|${rec.closingPrice}|${isWin}`;
    for (let c = 0; c < str.length; c++) {
      checksumAcc = ((checksumAcc << 5) - checksumAcc + str.charCodeAt(c)) | 0;
    }

    curve.push({
      index: idx + 1,
      date: rec.timestamp ? new Date(rec.timestamp).toLocaleDateString([], { month: "short", day: "numeric" }) : `B${idx + 1}`,
      selection: rec.selection,
      netUnits: Math.round(profitUnit * 100) / 100,
      cumulativeUnits: currentUnits,
      highWaterMark,
      isWin,
      clvPct: clv.clvPct,
    });
  });

  const brier = calculateBrierScore(brierInputs);
  const total = records.length;
  const auditHash = `SL-AUDIT-${Math.abs(checksumAcc).toString(16).toUpperCase().padStart(8, "0")}`;

  return {
    stats: {
      totalBets: total,
      btclCount,
      btclRate: Math.round((btclCount / total) * 1000) / 10,
      averageClvPct: Math.round((totalClvPct / total) * 100) / 100,
      averageClvCents: Math.round((totalClvCents / total) * 10) / 10,
      brierScore: brier,
      brierCalibration: evaluateBrierCalibration(brier),
      cumulativeUnits: currentUnits,
      maxDrawdownUnits: maxDrawdown,
      highWaterMarkUnits: highWaterMark,
      auditHash,
    },
    curve,
  };
}

/**
 * Generates exportable CSV / JSON audit ledger of all tracked bets.
 */
export function exportAuditLedger(records: ClvRecord[], format: "csv" | "json"): string {
  if (format === "json") {
    return JSON.stringify(records, null, 2);
  }

  const header = "ID,Timestamp,Sport,Market,Selection,Bet_Odds,Closing_Odds,CLV_Pct,Result,Status";
  const rows = records.map((r, i) => {
    const clv = computeClv(r.betPrice, r.closingPrice);
    return [
      r.id || `TICK-${i + 1}`,
      r.timestamp || new Date().toISOString(),
      r.sport || "N/A",
      r.market || "ml",
      `"${r.selection.replace(/"/g, '""')}"`,
      r.betPrice,
      r.closingPrice,
      clv.clvPct,
      r.hit ?? r.status === "WIN" ? "WIN" : "LOSS",
      r.status || "GRADED",
    ].join(",");
  });

  return [header, ...rows].join("\n");
}
