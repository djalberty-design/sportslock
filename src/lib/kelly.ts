import { americanToDecimal } from "./market/engine.ts";

export type RiskProfileMode = "conservative" | "balanced" | "aggressive";

export interface RiskProfileConfig {
  mode: RiskProfileMode;
  kellyMultiplier: number;
  maxLegs: number;
  minEdgePct: number;
  label: string;
  description: string;
}

export const RISK_PROFILES: Record<RiskProfileMode, RiskProfileConfig> = {
  conservative: {
    mode: "conservative",
    kellyMultiplier: 0.125, // 1/8th Kelly
    maxLegs: 2,
    minEdgePct: 4.0, // 4.0%
    label: "Conservative",
    description: "Capital preservation: 1/8th Kelly, max 2 legs, 4.0%+ min edge",
  },
  balanced: {
    mode: "balanced",
    kellyMultiplier: 0.25, // 1/4th Kelly
    maxLegs: 3,
    minEdgePct: 2.5, // 2.5%
    label: "Balanced",
    description: "Optimal growth & defense: 1/4th Kelly, max 3 legs, 2.5%+ min edge",
  },
  aggressive: {
    mode: "aggressive",
    kellyMultiplier: 0.50, // 1/2 Kelly
    maxLegs: 4,
    minEdgePct: 1.5, // 1.5%
    label: "Aggressive",
    description: "High bankroll velocity: 1/2 Kelly, max 4 legs, 1.5%+ min edge",
  },
};

/**
 * Pure Kelly Criterion calculation:
 * f* = (p * b - q) / b
 * where b = net fractional odds (decimal odds - 1), p = fair probability, q = 1 - p.
 */
export function calculatePureKellyFraction(fairProb: number, bookOdds: number): number {
  if (!Number.isFinite(fairProb) || fairProb <= 0 || fairProb >= 1) return 0;
  if (!Number.isFinite(bookOdds) || bookOdds === 0) return 0;

  const dec = americanToDecimal(bookOdds);
  if (!Number.isFinite(dec) || dec <= 1) return 0;

  const b = dec - 1;
  const q = 1 - fairProb;
  const fStar = (fairProb * b - q) / b;

  return Math.max(0, fStar);
}

/**
 * Calculates user-tailored dollar wager and unit count:
 * Wager($) = Clamp(Total Bankroll * f*_profile, Base Unit * 0.25, Base Unit * 4.00)
 */
export function calculateDynamicWager({
  totalBankroll,
  baseUnitSize,
  riskMode = "balanced",
  fairProb,
  bookOdds,
}: {
  totalBankroll: number;
  baseUnitSize: number;
  riskMode?: RiskProfileMode;
  fairProb?: number;
  bookOdds?: number;
}): {
  wagerDollars: number;
  unitCount: number;
  formatted: string;
  kellyFraction: number;
} {
  const safeBankroll = Math.max(10, Number.isFinite(totalBankroll) ? totalBankroll : 1000);
  const safeBaseUnit = Math.max(1, Number.isFinite(baseUnitSize) ? baseUnitSize : 25);
  const profile = RISK_PROFILES[riskMode] || RISK_PROFILES.balanced;

  const minClamp = Math.round(safeBaseUnit * 0.25 * 100) / 100;
  const maxClamp = Math.round(safeBaseUnit * 4.00 * 100) / 100;

  if (fairProb == null || bookOdds == null || !Number.isFinite(fairProb) || !Number.isFinite(bookOdds)) {
    return {
      wagerDollars: safeBaseUnit,
      unitCount: 1.0,
      formatted: `$${safeBaseUnit.toFixed(2)} (1.0u)`,
      kellyFraction: 0,
    };
  }

  const fStar = calculatePureKellyFraction(fairProb, bookOdds);
  const fProfile = fStar * profile.kellyMultiplier;

  const rawWager = safeBankroll * fProfile;
  const clampedWager = Math.max(minClamp, Math.min(maxClamp, Math.round(rawWager * 100) / 100));
  const units = Math.round((clampedWager / safeBaseUnit) * 100) / 100;

  return {
    wagerDollars: clampedWager,
    unitCount: units,
    formatted: `$${clampedWager.toFixed(2)} (${units.toFixed(2).replace(/\.00$/, "")}u)`,
    kellyFraction: fProfile,
  };
}
