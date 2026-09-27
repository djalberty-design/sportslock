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
 * Signed distance from even money on the American scale.
 * −110 → −10, −100 / +100 → 0, +120 → +20.
 */
export function americanEvenDistance(american: number): number {
  if (!Number.isFinite(american) || american === 0) return NaN;
  return american < 0 ? american + 100 : american - 100;
}

/**
 * Closing Line Value.
 * - CLV% = (decimal(bet) / decimal(close) − 1) × 100. Positive = better price than close.
 * - CLV cents = evenDistance(bet) − evenDistance(close).
 *   Locked −105 / closed −120 → +15. Locked +150 / closed +130 → +20.
 *   Crossing even money sums both distances with the same sign rule.
 * beatTheClosingLine is clvPct > 0. Do not mix a percent noise floor into cents.
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

  const clvPct = ((decBet / decClose) - 1) * 100;
  const clvProbDiff = (impClose - impBet) * 100;

  const betDist = americanEvenDistance(betPrice);
  const closeDist = americanEvenDistance(closingPrice);
  const clvCents = Number.isFinite(betDist) && Number.isFinite(closeDist)
    ? Math.round(betDist - closeDist)
    : 0;
  const beatTheClosingLine = clvPct > 0;

  return {
    clvCents,
    clvPct: Math.round(clvPct * 100) / 100,
    clvProbDiff: Math.round(clvProbDiff * 100) / 100,
    beatTheClosingLine,
  };
}
