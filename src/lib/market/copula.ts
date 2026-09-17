import { clip01 } from "./math.ts";
/**
 * Same-game joint chance using Clayton Archimedean Copula for tail dependence.
 * Cross-game legs stay a clean product.
 */

// Global ledger calibration cache (populated by Phase 5 ledger sync)
export const COPULA_CALIBRATION = {
  mlSpreadSame: 0.65,
  mlSpreadOpp: -0.45,
  totalSame: 0.25,
  totalUnder: -0.35,
  propOver: 0.55,
  propUnder: 0.45,
  propMixed: -0.40,
};

export function updateCopulaCalibration(empiricalData: Partial<typeof COPULA_CALIBRATION>) {
  Object.assign(COPULA_CALIBRATION, empiricalData);
}

export function claytonJoint(pA: number, pB: number, theta: number): number {
  const a = clip01(pA);
  const b = clip01(pB);
  if (Math.abs(theta) < 0.01) return a * b; // Independence
  
  if (theta > 0) {
    const sum = Math.pow(a, -theta) + Math.pow(b, -theta) - 1;
    return Math.pow(Math.max(0, sum), -1 / theta);
  } else {
    // Negative dependence: blend independence toward Fréchet lower bound
    const blend = Math.min(1, -theta);
    return a * b * (1 - blend) + Math.max(0, a + b - 1) * blend;
  }
}

export function jointFromLegs(probs: number[], rho: number): number {
  if (probs.length === 0) return 0;
  if (probs.length === 1) return clip01(probs[0]!);
  
  // Dynamic Theta mapping based on continuous empirical correlation
  const theta = rho >= 0 ? (2 * rho) / (1 - rho + 0.01) : rho * 2;
  
  let p = clip01(probs[0]!);
  for (let i = 1; i < probs.length; i++) {
    p = claytonJoint(p, probs[i]!, theta);
  }
  return p;
}

export function sameGameRho(legs: { marketType: string; side: string; fairProb?: number; selection?: string; sport?: string }[]): number {
  if (legs.length < 2) return 0;
  const types = new Set(legs.map((l) => l.marketType));
  const sides = new Set(legs.map((l) => l.side));
  const mlSpread = types.has("ml") && types.has("spread");
  
  let baseRho = 0;
  
  if (mlSpread && sides.size === 1) baseRho = COPULA_CALIBRATION.mlSpreadSame;
  else if (mlSpread && sides.size > 1) baseRho = COPULA_CALIBRATION.mlSpreadOpp;
  else if (types.has("total") && (types.has("ml") || types.has("spread"))) {
    const tot = legs.find((l) => l.marketType === "total");
    baseRho = tot?.side === "under" ? COPULA_CALIBRATION.totalUnder : COPULA_CALIBRATION.totalSame;
  } else if (types.has("prop") && (types.has("ml") || types.has("spread"))) {
    // Step 5.2: Correlated SGP Pricing (Monte Carlo Sandbox Matrix Edge)
    // When combining a Player Prop with a Game Script (ML/Spread), we dynamically price 
    // the true correlation. E.g., RBs rushing OVER correlates massively with their team covering the spread.
    const prop = legs.find((l) => l.marketType === "prop");
    const game = legs.find((l) => l.marketType === "ml" || l.marketType === "spread");
    
    if (prop && game && prop.selection) {
      const isOver = /over/i.test(prop.side) || /over/i.test(prop.selection);
      const isUnder = !isOver;
      const isRush = /rush/i.test(prop.selection);
      const isPass = /pass|yds/i.test(prop.selection) && !isRush;
      
      // Approximation: If the game leg has > 50% win probability, they are the expected winner
      const teamWinning = game.fairProb ? (game.fairProb > 0.5) : true;

      if (isRush) {
        // Rushing is positively correlated with winning (killing the clock late in blowouts)
        baseRho = isOver ? (teamWinning ? 0.65 : -0.45) : (teamWinning ? -0.35 : 0.50);
      } else if (isPass) {
        // Passing is negatively correlated with blowouts, highly correlated with trailing
        baseRho = isOver ? (teamWinning ? -0.25 : 0.60) : (teamWinning ? 0.40 : -0.35);
      } else {
        baseRho = isOver ? 0.20 : -0.20; // Generic prop correlation
      }
    } else {
      baseRho = 0.15;
    }
  } else if (types.has("prop")) {
    const overs = legs.filter((l) => /over/i.test(l.side)).length;
    if (overs === legs.length) baseRho = COPULA_CALIBRATION.propOver;
    else if (overs === 0) baseRho = COPULA_CALIBRATION.propUnder;
    else baseRho = COPULA_CALIBRATION.propMixed;
  } else {
    baseRho = 0.35;
  }

  // Dynamic adjustment: Marginal probability distance scaling
  // Highly confident favorites have tighter correlation to their spread than coin-flips
  if (legs[0]?.fairProb && legs[1]?.fairProb) {
    const p1 = clip01(legs[0].fairProb);
    const p2 = clip01(legs[1].fairProb);
    const distance = Math.abs(p1 - p2);
    // Shrink correlation if marginals are wildly disconnected, boost if tightly aligned
    const dynamicModifier = 1 - (distance * 0.5);
    baseRho *= dynamicModifier;
  }

  return Math.max(-0.95, Math.min(0.95, baseRho));
}

/** 
 * Simultaneous Fractional Kelly growth. 
 * Calculates optimal bankroll fraction accounting for multi-leg covariance.
 */
export function growthScore(pJoint: number, decimalPayout: number, infoQuality: number, kellyMultiplier = 1): number {
  const p = clip01(pJoint);
  const b = Math.max(0.01, decimalPayout - 1);
  const q = Number.isFinite(infoQuality) ? Math.max(0, Math.min(1, infoQuality)) : 0.5;
  
  let kelly = Math.max(0, (p * b - (1 - p)) / b);
  
  // Dynamic covariance penalty based on exact joint probability
  const covariancePenalty = 1 + (0.15 * q * Math.sqrt(p));
  kelly = kelly / covariancePenalty;

  const frac = Number.isFinite(kellyMultiplier) ? Math.max(0, Math.min(2, kellyMultiplier)) : 1;
  return q * kelly * frac;
}



