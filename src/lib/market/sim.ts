import { normalCdf } from "./math.ts";
import { leagueTotal, marginSigma, totalSigma, footballCoverProb } from "./chance.ts";
import { DESK_VERSION } from "./rules.ts";

export type GameLatent = {
  eventId: string;
  sport: string;
  muH: number;
  muA: number;
  sigM: number;
  sigT: number;
  pace: number;
  pWinH: number;
  chaos: number;
  poolHome?: number;
  marketHome?: number;
  ran: boolean;
  note: string;
};

export type GameSimResult = {
  homeScore: number;
  awayScore: number;
  margin: number;
  total: number;
  script: "blowout" | "shootout" | "grind" | "normal";
};

// Box-Muller transform for normal distribution
let spareRandom: number | null = null;
export function randomNormal(mu: number, sigma: number): number {
  if (spareRandom !== null) {
    const z = spareRandom;
    spareRandom = null;
    return z * sigma + mu;
  }
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const radius = Math.sqrt(-2.0 * Math.log(u));
  const theta = 2.0 * Math.PI * v;
  spareRandom = radius * Math.sin(theta);
  const z = radius * Math.cos(theta);
  return z * sigma + mu;
}

/**
 * Step 5.1: Game Script Simulation (Monte Carlo Sandbox)
 * Simulates 10,000 outcomes of a game to generate a matrix of game scripts.
 */
export function runMonteCarlo(g: GameLatent, n = 10000): GameSimResult[] {
  const results: GameSimResult[] = [];
  const expectedTotal = g.muH + g.muA;
  
  for (let i = 0; i < n; i++) {
    // Generate margin and total independently via Bivariate Normal
    let margin = randomNormal(g.muH - g.muA, g.sigM);
    let total = Math.max(0, randomNormal(expectedTotal, g.sigT));
    
    let homeScore = Math.max(0, (total + margin) / 2);
    let awayScore = Math.max(0, (total - margin) / 2);
    
    // Phase 8: NHL Empty Net Game Script Variance
    if (g.sport === "NHL" && Math.abs(margin) > 0 && Math.abs(margin) <= 2) {
      if (Math.random() > 0.6) {
        total += 1;
        if (margin > 0) homeScore += 1; else awayScore += 1;
        margin = homeScore - awayScore;
      }
    }

    let script: GameSimResult["script"] = "normal";
    
    // Classify the game script
    if (Math.abs(margin) >= 14) {
      script = "blowout";
    } else if (total > expectedTotal * 1.25) {
      script = "shootout";
    } else if (total < expectedTotal * 0.75) {
      script = "grind";
    }
    
    results.push({ homeScore, awayScore, margin, total, script });
  }
  return results;
}

export type SimPrice = { p: number; n: number; se: number; ran: boolean };

// Abramowitz and Stegun 7.1.26 rational approximation for Normal CDF


// Drop-in replacement: bypasses Monte Carlo by passing the latent directly
export function drawPaths(g: GameLatent, snapshotId: string, n?: number): GameLatent[] {
  return g.ran ? [g] : [];
}

export function simWin(paths: GameLatent[]): SimPrice {
  if (!paths.length) return { p: 0.5, n: 0, se: 0, ran: false };
  const g = paths[0];
  const z = (g.muH - g.muA) / g.sigM;
  return { p: normalCdf(z), n: 1, se: 0, ran: true };
}

export function simCover(paths: GameLatent[], homeLine: number): SimPrice {
  if (!paths.length) return { p: 0.5, n: 0, se: 0, ran: false };
  const g = paths[0];
  if (g.sport === "NFL" || g.sport === "NCAAF") {
    const discrete = footballCoverProb(homeLine, g.muH - g.muA, g.sport);
    return { p: discrete.p, n: 1, se: 0, ran: !discrete.empty };
  }
  const z = (g.muH - g.muA + homeLine) / g.sigM;
  return { p: normalCdf(z), n: 1, se: 0, ran: true };
}

export function simOver(paths: GameLatent[], line: number): SimPrice {
  if (!paths.length) return { p: 0.5, n: 0, se: 0, ran: false };
  const g = paths[0];
  const z = (g.muH + g.muA - line) / g.sigT;
  return { p: normalCdf(z), n: 1, se: 0, ran: true };
}

export const FAIR_BLEND = { sim: 0.5, pool: 0.3, market: 0.2 } as const;

export function blendFair(sim: number | undefined, pool: number | undefined, market: number | undefined): number {
  const parts: { w: number; v: number }[] = [];
  if (sim != null && Number.isFinite(sim)) parts.push({ w: FAIR_BLEND.sim, v: sim });
  if (pool != null && Number.isFinite(pool)) parts.push({ w: FAIR_BLEND.pool, v: pool });
  if (market != null && Number.isFinite(market)) parts.push({ w: FAIR_BLEND.market, v: market });
  if (!parts.length) return 0.5;
  const w = parts.reduce((s, p) => s + p.w, 0);
  return parts.reduce((s, p) => s + (p.w / w) * p.v, 0);
}

export function latentFromScores(opts: {
  eventId: string;
  sport: string;
  homeWin: number;
  total: number;
  homeSpread?: number;
  poolHome?: number;
  marketHome?: number;
  chaos?: number;
}): GameLatent {
  const sport = opts.sport;
  const tot = opts.total > 0 ? opts.total : leagueTotal(sport);
  const share = Math.min(0.68, Math.max(0.32, 0.5 + (opts.homeWin - 0.5) * 0.28));
  const muH = tot * share;
  const muA = tot - muH;
  const chaos = opts.chaos ?? Math.max(0, Math.min(0.22, (tot - leagueTotal(sport)) / (leagueTotal(sport) * 4)));
  const scale = Math.min(1.35, Math.max(0.72, 1 + 0.65 * (tot / leagueTotal(sport) - 1)));
  return {
    eventId: opts.eventId,
    sport,
    muH,
    muA,
    sigM: marginSigma(sport) * scale * (1 + chaos),
    sigT: totalSigma(sport) * scale * (1 + chaos),
    pace: tot / Math.max(1, leagueTotal(sport)),
    pWinH: opts.homeWin,
    chaos,
    poolHome: opts.poolHome,
    marketHome: opts.marketHome,
    ran: tot > 0 && opts.homeWin > 0.01 && opts.homeWin < 0.99,
    note: "Calculated via continuous CDF. Zero Monte Carlo drag.",
  };
}

