import type { EventBrief, PublicSplit, QuantFactorItem, QuantWaterfall, ScanRow } from "./types.ts";
import { getDynamicWeightsSync } from "./dynamic-weights.ts";

/**
 * Computes an institutional Quant Factor Waterfall for a given play.
 * Decomposes net edge and win probability into 5 orthogonal alpha drivers:
 * 1. Consensus Market Anchor (Bayesian Prior >= 70%)
 * 2. 10k Monte Carlo Simulation Differential
 * 3. Rest & Schedule Fatigue Advantage
 * 4. Smart Money / Steam / Reverse Line Movement
 * 5. Environment & Venue Factors
 */
export function computeQuantFactorWaterfall(
  row: ScanRow,
  brief?: EventBrief,
  split?: PublicSplit,
): QuantWaterfall {
  const sport = row.sport || "MLB";
  const weights = getDynamicWeightsSync(sport);
  const wMarket = weights.wMarket;
  const wSim = weights.wSim;
  const wPool = weights.wPool;

  // 1. Consensus Market Anchor
  const consPrice = row.consensusPrice ?? row.price;
  const rawImplied = consPrice < 0
    ? -consPrice / (-consPrice + 100)
    : 100 / (consPrice + 100);
  // Haircut typical hold (4.5%) to get un-vigged fair market anchor
  const marketAnchorProb = Math.min(0.95, Math.max(0.05, rawImplied / 1.045));

  const modelProb = row.fairProb ?? marketAnchorProb;
  const netEdgePct = row.evPct ?? (modelProb - marketAnchorProb);
  const netEdgeBp = Math.round(netEdgePct * 10000);

  const factors: QuantFactorItem[] = [];

  // Factor 1: Consensus Market Baseline
  factors.push({
    name: "Consensus Market Anchor",
    category: "market",
    impactBp: 0,
    weightPct: Math.round(wMarket * 100),
    detail: `De-vigged consensus base: ${(marketAnchorProb * 100).toFixed(1)}% implied (${consPrice > 0 ? "+" + consPrice : consPrice})`,
    favorable: true,
  });

  // Factor 2: 10k Monte Carlo Simulation Differential
  const homeProb = brief?.espnHomeWin ?? brief?.chanceHome ?? 0.5;
  const simProb = row.simFair ?? (row.side === "home" ? homeProb : 1 - homeProb) ?? modelProb;
  const simDiff = simProb - marketAnchorProb;
  const simImpactBp = Math.round(simDiff * 10000 * (wSim / (wSim + wPool || 0.2)));
  factors.push({
    name: "10,000 Monte Carlo Sim",
    category: "sim",
    impactBp: simImpactBp,
    weightPct: Math.round(wSim * 100),
    detail: simDiff >= 0
      ? `Simulations favor ${row.selection} (+${(simDiff * 100).toFixed(1)}% vs Vegas line)`
      : `Simulations lean defensive (-${(Math.abs(simDiff) * 100).toFixed(1)}% vs Vegas line)`,
    favorable: simImpactBp >= 0,
  });

  // Factor 3: Rest & Schedule Fatigue
  const homeRest = brief?.homeRestDays ?? 1;
  const awayRest = brief?.awayRestDays ?? 1;
  const isHome = row.side === "home" || (row.home && row.selection.toLowerCase().includes(row.home.toLowerCase()));
  const restDiff = isHome ? homeRest - awayRest : awayRest - homeRest;
  let restImpactBp = 0;
  let restDetail = "Standard schedule (neutral fatigue)";

  if (restDiff >= 2) {
    restImpactBp = +120;
    restDetail = `Rest advantage: +${restDiff} days extra recovery`;
  } else if (restDiff === 1) {
    restImpactBp = +60;
    restDetail = `Slight rest advantage (+1 day off)`;
  } else if (restDiff <= -2) {
    restImpactBp = -110;
    restDetail = `Fatigue penalty: -${Math.abs(restDiff)} days rest deficit`;
  } else if (restDiff === -1) {
    restImpactBp = -50;
    restDetail = `Playing on shorter turnaround (-1 day)`;
  }
  factors.push({
    name: "Rest & Schedule Fatigue",
    category: "schedule",
    impactBp: restImpactBp,
    weightPct: Math.round(wPool * 50),
    detail: restDetail,
    favorable: restImpactBp >= 0,
  });

  // Factor 4: Smart Money / Steam / RLM
  const tPct = row.ticketPct ?? split?.ticketPct ?? split?.publicPct;
  const hPct = row.handlePct ?? split?.handlePct;
  let steamImpactBp = 0;
  let steamDetail = "Balanced market flow";

  if (hPct != null && tPct != null) {
    const rlm = hPct - tPct;
    if (rlm >= 12 || row.tapeLean === "sharp_rlm") {
      steamImpactBp = +180;
      steamDetail = `Sharp flow: Handle exceeds tickets by ${Math.abs(rlm)}% (Institutional Whale Money)`;
    } else if (rlm <= -12) {
      steamImpactBp = -90;
      steamDetail = `Public trap: Ticket volume heavy (${tPct}%), handle fading (${hPct}%)`;
    } else if (rlm > 0) {
      steamImpactBp = +50;
      steamDetail = `Modest sharp lean (+${rlm}% handle divergence)`;
    }
  } else if (row.tapeLean === "sharp_rlm") {
    steamImpactBp = +150;
    steamDetail = "Reverse Line Movement detected on institutional books";
  }
  factors.push({
    name: "Sharp Steam & Flow",
    category: "steam",
    impactBp: steamImpactBp,
    weightPct: Math.round(wPool * 35),
    detail: steamDetail,
    favorable: steamImpactBp >= 0,
  });

  // Factor 5: Environment & Venue Factors
  let envImpactBp = 0;
  let envDetail = "Neutral venue conditions";
  const venue = String(brief?.venue || "");
  const weatherWind = brief?.weatherWind;

  if (isHome) {
    envImpactBp += 75;
    envDetail = "Standard home-field advantage (+0.75% baseline)";
  }
  if (venue.toLowerCase().includes("coors") || venue.toLowerCase().includes("mile high")) {
    if (row.marketType === "total" && (row.side === "over" || /\bover\b/i.test(row.selection))) {
      envImpactBp += 110;
      envDetail = "High-altitude thin air (+1.1% over boost)";
    }
  }
  if (weatherWind && weatherWind >= 15) {
    if (row.marketType === "total") {
      const isUnder = row.side === "under" || /\bunder\b/i.test(row.selection);
      envImpactBp += isUnder ? +80 : -80;
      envDetail = `High wind (${weatherWind} mph) suppresses scoring`;
    }
  }
  factors.push({
    name: "Environment & Venue",
    category: "environment",
    impactBp: envImpactBp,
    weightPct: Math.round(wPool * 15),
    detail: envDetail,
    favorable: envImpactBp >= 0,
  });

  const sign = netEdgeBp >= 0 ? "+" : "";
  const summary = `Model projects ${(modelProb * 100).toFixed(1)}% win probability vs ${(marketAnchorProb * 100).toFixed(1)}% consensus (${sign}${(netEdgePct * 100).toFixed(1)}% net edge).`;

  return {
    marketAnchorProb,
    modelProb,
    netEdgeBp,
    factors,
    summary,
  };
}
