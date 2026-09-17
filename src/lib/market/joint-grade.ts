import { americanToImplied } from "./engine.ts";
/**
 * Same-game P(all) from Clayton on G / fair. Cross-game stays a product.
 * Haircut only when a leg has no usable probability (G did not run).
 */
import { sameGameRho } from "./copula.ts";
import { sgpHaircut } from "./parlays.ts";
import type { ParlayCorrelation } from "./types.ts";

export type JointLeg = {
  eventId: string;
  marketType: string;
  side: string;
  fairProb?: number;
  simFair?: number;
  price?: number;
  isProp?: boolean;
  selection?: string;
  sport?: string;
};

function product(xs: number[]): number {
  return xs.reduce((a, b) => a * b, 1);
}



function legProb(l: JointLeg): number | undefined {
  if (l.simFair != null && Number.isFinite(l.simFair) && l.simFair > 0 && l.simFair < 1) return l.simFair;
  if (l.fairProb != null && Number.isFinite(l.fairProb) && l.fairProb > 0 && l.fairProb < 1) return l.fairProb;
  if (l.price != null && Number.isFinite(l.price) && l.price !== 0) {
    const implied = americanToImplied(l.price);
    if (Number.isFinite(implied) && implied > 0.02 && implied < 0.98) return implied;
  }
  return undefined;
}

export function combineParlayFair(legs: JointLeg[]): {
  combinedFair: number;
  correlation: ParlayCorrelation;
  sameGame: boolean;
} {
  if (!legs.length) return { combinedFair: 0.5, correlation: "near-independent", sameGame: false };
  const sameGame = new Set(legs.map((l) => l.eventId)).size < legs.length;
  
  // Strict Guardrail: clamp input probabilities strictly to [0.001, 0.999]
  const clampedProbs = legs.map(l => {
    const p = legProb(l);
    if (p == null || Number.isNaN(p)) return undefined;
    return Math.max(0.001, Math.min(0.999, p));
  });

  const complete = clampedProbs.every((p) => p != null);
  
  if (!sameGame) {
    const raw = product(clampedProbs.map((p) => p ?? 0.5));
    return { combinedFair: Math.max(0.0001, Math.min(0.9999, raw)), correlation: "near-independent", sameGame: false };
  }
  
  if (!complete) {
    const mlAndSpread = legs.some((l) => l.marketType === "ml") && legs.some((l) => l.marketType === "spread");
    const raw = product(clampedProbs.map((p) => p ?? 0.5));
    return {
      combinedFair: Math.max(0.0001, Math.min(0.9999, raw * sgpHaircut(legs.length, mlAndSpread))),
      correlation: "fallback-haircut",
      sameGame: true,
    };
  }

  const rho = sameGameRho(legs);
  const joint = directionalSGPRouter(legs, clampedProbs as number[], rho);
  
  return { combinedFair: Math.max(0.0001, Math.min(0.9999, joint)), correlation: "shared-latent", sameGame: true };
}

function aggregateGumbel(probs: number[], theta: number): number {
  const t = Math.max(1.0, Math.min(3.5, theta));
  if (t === 1.0 || probs.length === 0) return product(probs);
  let sum = 0;
  for (const p of probs) {
    sum += Math.pow(-Math.log(p), t);
  }
  return Math.exp(-Math.pow(sum, 1 / t));
}

function aggregateClayton(probs: number[], theta: number): number {
  if (theta <= 0.01) return product(probs);
  const t = Math.max(0.1, Math.min(5.0, theta));
  let sum = 0;
  for (const p of probs) {
    sum += Math.pow(p, -t);
  }
  return Math.pow(Math.max(0, sum - probs.length + 1), -1 / t);
}

function directionalSGPRouter(legs: JointLeg[], probs: number[], rho: number): number {
  // Strict Guardrail: if correlation is 0 or cannot be computed, fallback strictly to independent
  if (rho === 0 || Number.isNaN(rho)) {
    return product(probs);
  }

  let overs = 0;
  let unders = 0;
  
  for (const leg of legs) {
    const s = leg.side?.toLowerCase() || "";
    if (s.includes("over")) overs++;
    else if (s.includes("under")) unders++;
    else if (leg.marketType === "spread" || leg.marketType === "ml") {
      overs += 0.5;
      unders += 0.5;
    }
  }

  const absRho = Math.min(0.95, Math.abs(rho));
  const claytonTheta = Math.max(0.1, Math.min(5.0, (2 * absRho) / (1 - absRho)));
  const gumbelTheta = Math.max(1.0, Math.min(3.5, 1 / (1 - absRho)));

  const pClayton = aggregateClayton(probs, claytonTheta);
  const pGumbel = aggregateGumbel(probs, gumbelTheta);

  const total = overs + unders;
  if (total === 0) return product(probs);

  const overRatio = overs / total;
  const pJoint = (overRatio * pGumbel) + ((1 - overRatio) * pClayton);
  
  return pJoint;
}

