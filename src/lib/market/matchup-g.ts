import { clip, invLogit } from "./math.ts";
/** Defense allowed, underlying contact/pitch, platoon, starter ERA on G. Empty looks stay empty. */
import { defenseAllowed, underlyingOffense, underlyingPitch, type TeamLooks } from "./looks.ts";

export type MatchupSnap = {
  sport: string;
  homeLooks?: TeamLooks;
  awayLooks?: TeamLooks;
  homeEra?: number;
  awayEra?: number;
  homeWhip?: number;
  awayWhip?: number;
  homePitcherHand?: "L" | "R";
  awayPitcherHand?: "L" | "R";
  homeBullpenXfip?: number;
  awayBullpenXfip?: number;
  homeBullpenRest?: number;
  awayBullpenRest?: number;
};

export type MatchupLayer = {
  id: "defense" | "underlying" | "platoon" | "pitcher";
  label: string;
  home: number;
  precision: number;
  empty: boolean;
  note: string;
};

export type MatchupMeans = {
  muH: number;
  muA: number;
  chaosAdd: number;
  empty: boolean;
  note?: string;
  layers: MatchupLayer[];
};





function leagueAllow(sport: string): number {
  if (sport === "NBA" || sport === "NCAAB") return 114;
  if (sport === "NFL" || sport === "NCAAF") return 22.5;
  if (sport === "NHL") return 3.05;
  return 4.5;
}

export function matchupLayers(snap: MatchupSnap): MatchupLayer[] {
  const layers: MatchupLayer[] = [];
  const sport = snap.sport;
  const hDef = defenseAllowed(snap.homeLooks, sport);
  const aDef = defenseAllowed(snap.awayLooks, sport);
  if (hDef != null && aDef != null) {
    const z = sport === "MLB" ? (hDef - aDef) * -1.4 : ((aDef - hDef) / leagueAllow(sport)) * 1.6;
    layers.push({
      id: "defense",
      label: "Defense allowed",
      home: invLogit(z, 0.08, 0.92),
      precision: 2.2,
      empty: false,
      note: "Opponent-allowed look. Home scores against the away unit.",
    });
  } else {
    layers.push({
      id: "defense",
      label: "Defense allowed",
      home: 0.5,
      precision: 0,
      empty: true,
      note: "Looked up defense allowed. Empty look.",
    });
  }

  const hOff = underlyingOffense(snap.homeLooks?.last7 ?? snap.homeLooks?.season);
  const aOff = underlyingOffense(snap.awayLooks?.last7 ?? snap.awayLooks?.season);
  const hPit = underlyingPitch(snap.homeLooks?.last7 ?? snap.homeLooks?.season);
  const aPit = underlyingPitch(snap.awayLooks?.last7 ?? snap.awayLooks?.season);
  if (hOff != null && aOff != null) {
    const z = (hOff - aOff) * 3.2 + (aPit != null && hPit != null ? (hPit - aPit) * 1.1 : 0);
    layers.push({
      id: "underlying",
      label: "Underlying contact / pitch",
      home: invLogit(z, 0.08, 0.92),
      precision: 2.0,
      empty: false,
      note: "OBP/ISO or pitch quality. Not raw wins.",
    });
  } else {
    layers.push({
      id: "underlying",
      label: "Underlying contact / pitch",
      home: 0.5,
      precision: 0,
      empty: true,
      note: "Looked up underlying. Empty look.",
    });
  }

  const homeVs =
    snap.awayPitcherHand === "L" ? snap.homeLooks?.vsLeft : snap.awayPitcherHand === "R" ? snap.homeLooks?.vsRight : undefined;
  const awayVs =
    snap.homePitcherHand === "L" ? snap.awayLooks?.vsLeft : snap.homePitcherHand === "R" ? snap.awayLooks?.vsRight : undefined;
  if (homeVs?.ops != null && awayVs?.ops != null) {
    layers.push({
      id: "platoon",
      label: "Platoon / handedness",
      home: invLogit((homeVs.ops - awayVs.ops) * 2.6, 0.08, 0.92),
      precision: 1.9,
      empty: false,
      note: `Home vs ${snap.awayPitcherHand ?? "?"}HP, away vs ${snap.homePitcherHand ?? "?"}HP.`,
    });
  } else {
    layers.push({
      id: "platoon",
      label: "Platoon / handedness",
      home: 0.5,
      precision: 0,
      empty: true,
      note: "Looked up platoon. Empty look — need a posted hand and vs-L/R split.",
    });
  }

  const hEra = snap.homeEra ?? snap.homeLooks?.last7?.era ?? snap.homeLooks?.season.era;
  const aEra = snap.awayEra ?? snap.awayLooks?.last7?.era ?? snap.awayLooks?.season.era;
  if (hEra != null && aEra != null && Number.isFinite(hEra) && Number.isFinite(aEra)) {
    layers.push({
      id: "pitcher",
      label: "Starter / staff ERA",
      home: invLogit((aEra - hEra) / 2.2, 0.08, 0.92),
      precision: 2.1,
      empty: false,
      note: `Home ERA ${hEra.toFixed(2)} vs away ${aEra.toFixed(2)}.`,
    });
  } else {
    layers.push({
      id: "pitcher",
      label: "Starter / staff ERA",
      home: 0.5,
      precision: 0,
      empty: true,
      note: "Looked up pitcher ERA. Empty look.",
    });
  }
  return layers;
}

export function applyMatchupToMeans(snap: MatchupSnap, muH: number, muA: number): MatchupMeans {
  const {
    sport,
    homeEra,
    awayEra,
    homeWhip,
    awayWhip,
    homePitcherHand,
    awayPitcherHand,
    homeLooks,
    awayLooks,
  } = snap;

  // The Empty Look Law (Strict Guardrail)
  if (
    sport !== "MLB" ||
    homeEra == null ||
    awayEra == null ||
    homePitcherHand == null ||
    awayPitcherHand == null ||
    homeWhip == null ||
    awayWhip == null
  ) {
    return { muH: 1, muA: 1, chaosAdd: 0, empty: true, note: "", layers: matchupLayers(snap) };
  }

  let nextH = muH;
  let nextA = muA;
  let chaosAdd = 0;

  // 1. Pitcher Volatility (ERA/WHIP) & Bullpen Time-Weighted Blending
  const mlbAvgEra = 4.10;
  const mlbAvgXfip = 4.20;
  
  // Base starter multipliers
  const homeStarterModifier = clip(homeEra / mlbAvgEra, 0.8, 1.25);
  const awayStarterModifier = clip(awayEra / mlbAvgEra, 0.8, 1.25);
  
  let homeFinalModifier = homeStarterModifier;
  let awayFinalModifier = awayStarterModifier;
  let homeExhaustionPenalty = 1.0;
  let awayExhaustionPenalty = 1.0;

  const { homeBullpenXfip, awayBullpenXfip, homeBullpenRest, awayBullpenRest } = snap;

  if (homeBullpenXfip != null && !Number.isNaN(homeBullpenXfip) && homeBullpenRest != null && !Number.isNaN(homeBullpenRest)) {
    const bullpenModifier = clip(homeBullpenXfip / mlbAvgXfip, 0.8, 1.25);
    homeFinalModifier = (0.65 * homeStarterModifier) + (0.35 * bullpenModifier);
    if (homeBullpenRest < 0.30) {
      homeExhaustionPenalty = 1.03;
      chaosAdd += 0.02;
    }
  }

  if (awayBullpenXfip != null && !Number.isNaN(awayBullpenXfip) && awayBullpenRest != null && !Number.isNaN(awayBullpenRest)) {
    const bullpenModifier = clip(awayBullpenXfip / mlbAvgXfip, 0.8, 1.25);
    awayFinalModifier = (0.65 * awayStarterModifier) + (0.35 * bullpenModifier);
    if (awayBullpenRest < 0.30) {
      awayExhaustionPenalty = 1.03;
      chaosAdd += 0.02;
    }
  }

  // Home pitching affects Away team's scoring
  nextA *= homeFinalModifier * homeExhaustionPenalty;
  // Away pitching affects Home team's scoring
  nextH *= awayFinalModifier * awayExhaustionPenalty;

  // Pitcher Isolation Metric (ERA / WHIP) to estimate runs per baserunner (home run dependency)
  const homePitcherIso = homeEra / homeWhip;
  const awayPitcherIso = awayEra / awayWhip;
  const avgIso = 4.10 / 1.30; // ~3.15

  // 2. Platoon Advantage
  const homeVs = awayPitcherHand === "L" ? homeLooks?.vsLeft : homeLooks?.vsRight;
  const awayVs = homePitcherHand === "L" ? awayLooks?.vsLeft : awayLooks?.vsRight;

  const avgOps = 0.720;
  if (homeVs?.ops != null) {
    const platoonMulH = clip(1 + (homeVs.ops - avgOps) * 0.8, 0.85, 1.15);
    nextH *= platoonMulH;
  }
  if (awayVs?.ops != null) {
    const platoonMulA = clip(1 + (awayVs.ops - avgOps) * 0.8, 0.85, 1.15);
    nextA *= platoonMulA;
  }

  // 3. Variance Injection (chaosAdd)
  // If the matchup metrics dictate heavy volatility (e.g. high pitcher ISO or high lineup ISO/K9), add a positive modifier
  let hChaos = 0;
  let aChaos = 0;

  if (homePitcherIso > avgIso * 1.1) hChaos += 0.015; // Home pitcher is volatile (HR dependent)
  if (awayPitcherIso > avgIso * 1.1) aChaos += 0.015;

  // High-strikeout/high-power lineup vs pitcher creates binary outcomes
  if (homeVs?.iso != null && homeVs.iso > 0.170) hChaos += 0.015;
  if (awayVs?.iso != null && awayVs.iso > 0.170) aChaos += 0.015;
  if (homeVs?.k9 != null && homeVs.k9 > 9.5) hChaos += 0.01;
  if (awayVs?.k9 != null && awayVs.k9 > 9.5) aChaos += 0.01;

  chaosAdd = clip(chaosAdd + hChaos + aChaos, 0, 0.05);

  return {
    muH: nextH,
    muA: nextA,
    chaosAdd,
    empty: false,
    note: `Platoon & Volatility applied. Home starter ERA ${homeEra.toFixed(2)}, Away starter ERA ${awayEra.toFixed(2)}.`,
    layers: matchupLayers(snap),
  };
}

