import { invLogit, normalCdf } from "./math.ts";
export type LayerFamily = "market" | "crowd" | "model" | "context";

export type ChanceLayer = {
  id: string;
  label: string;
  home: number;
  weight: number;
  precision: number;
  family: LayerFamily;
  note: string;
  thin?: boolean;
  empty?: boolean;
};

import { analyzeScores, earlySeasonDamp, ewmaWeights, formTrend, splitByVenue, vsOpponent } from "./form.ts";
import { defenseAllowed, processFromLooks, underlyingOffense, underlyingPitch, type TeamLooks } from "./looks.ts";
import { lookupVenue, weatherAtVenue } from "./venues.ts";
import { restEffect } from "./rest.ts";
import { type PlayerVolumeBaseline } from "./feed-adapter.ts";
import { availabilityEffect } from "./availability.ts";
import { officialLayer, type OfficialPosting } from "./officials.ts";
import { openMoveNote, openPrecision, tapeLayers, thinClose } from "./market-opponent.ts";
import { splitLayers } from "./splits-g.ts";
import { matchupLayers } from "./matchup-g.ts";

export type FormGame = {
  date?: string;
  result: string;
  pf?: number;
  pa?: number;
  opponent?: string;
  homeAway?: "home" | "away";
  oppDefRating?: number; 
};

export type FormBlock = {
  team: string;
  results: string[];
  games?: FormGame[];
  seasonGames?: FormGame[];
};

export type ChanceInput = {
  home: string;
  away: string;
  sport: string;
  start?: string;
  oddsHome?: number;
  bookHome?: number;
  openHome?: number;
  espnHome?: number;
  kalshiHome?: number;
  kalshiVolume?: number;
  kalshiSpread?: number;
  polyHome?: number;
  polyVolume?: number;
  homeSpread?: number;
  total?: number;
  homeRecord?: string;
  awayRecord?: string;
  homeSplit?: string;
  awaySplit?: string;
  homeEra?: number;
  awayEra?: number;
  homeWhip?: number;
  awayWhip?: number;
  homeBullpenXfip?: number;
  awayBullpenXfip?: number;
  homeBullpenRest?: number;
  awayBullpenRest?: number;
  homePace?: number;
  awayPace?: number;
  homeOffensiveRating?: number;
  awayOffensiveRating?: number;
  lastFive?: FormBlock[];
  homeOuts?: number;
  awayOuts?: number;
  homeQuestionable?: number;
  awayQuestionable?: number;
  homePf?: number;
  homePa?: number;
  awayPf?: number;
  awayPa?: number;
  weatherTemp?: number;
  weatherWind?: number;
  windSpeed?: number;
  homeQbEpa?: number;
  awayQbEpa?: number;
  homeBackupQbEpa?: number;
  awayBackupQbEpa?: number;
  homeQbIsBackup?: boolean;
  awayQbIsBackup?: boolean;
  homePassBlockWinRate?: number;
  awayPassBlockWinRate?: number;
  homePassRushWinRate?: number;
  awayPassRushWinRate?: number;
  weatherPrecip?: number;
  humidity?: number;
  barometricPressure?: number;
  parkRunFactor?: number;
  parkHrFactor?: number;
  homeTalentRating?: number;
  awayTalentRating?: number;
  homeGoalieGsax?: number;
  awayGoalieGsax?: number;
  homeIsB2B?: boolean;
  awayIsB2B?: boolean;
  homeTravelMiles?: number;
  awayTravelMiles?: number;
  venue?: string;
  seriesHomeWins?: number;
  seriesAwayWins?: number;
  homeRestDays?: number;
  awayRestDays?: number;
  homeThreePointRate?: number;
  awayThreePointRate?: number;
  homeOppThreePtAllowed?: number;
  awayOppThreePtAllowed?: number;
  homeLoadManagementOut?: boolean;
  awayLoadManagementOut?: boolean;
  homeTransferPortalIndex?: number;
  awayTransferPortalIndex?: number;
  sosAdjustment?: number;
  isLateGameFoulRisk?: boolean;
  ticketHome?: number;
  handleHome?: number;
  steam?: boolean;
  homeLooks?: TeamLooks;
  awayLooks?: TeamLooks;
  homePitcherHand?: "L" | "R";
  awayPitcherHand?: "L" | "R";
  layerHaircuts?: Record<string, number>;
  officials?: OfficialPosting[];
};

export type ChanceReport = {
  home: number;
  away: number;
  favorite: "home" | "away";
  favoriteName: string;
  chance: number;
  confidence: "high" | "medium" | "low";
  agreement: number;
  layers: ChanceLayer[];
  marketHome?: number;
  crowdHome?: number;
  posteriorVar: number;
  because: string;
};

const FINAL_LO = 0.14;
const FINAL_HI = 0.86;

export function logit(p: number): number {
  const x = Math.min(0.985, Math.max(0.015, p));
  return Math.log(x / (1 - x));
}



function unit01(n?: number): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  const p = n > 1 ? n / 100 : n;
  if (p <= 0.02 || p >= 0.98) return null;
  return p;
}



export function parseRecord(summary?: string): { w: number; l: number; t: number; n: number; wp: number } | null {
  if (!summary) return null;
  const m = /(\d+)\s*-\s*(\d+)(?:\s*-\s*(\d+))?/.exec(summary);
  if (!m) return null;
  const w = Number(m[1]);
  const l = Number(m[2]);
  const t = m[3] ? Number(m[3]) : 0;
  const n = w + l + t;
  if (n < 5) return null;
  return { w, l, t, n, wp: (w + 0.5 * t) / n };
}

export function log5(wpA: number, wpB: number): number {
  const a = Math.min(0.85, Math.max(0.15, wpA));
  const b = Math.min(0.85, Math.max(0.15, wpB));
  const num = a * (1 - b);
  return num / (num + b * (1 - a));
}

export function homeFieldLogit(sport: string): number {
  switch (sport) {
    case "NFL": return 0.16;
    case "NCAAF": return 0.22;
    case "NBA": return 0.2;
    case "NHL": return 0.22;
    case "MLB": return 0.12;
    case "NCAAB": return 0.22;
    default: return 0.14;
  }
}

export function marginSigma(sport: string): number {
  switch (sport) {
    case "NFL": return 13.45;
    case "NCAAF": return 16.2;
    case "NBA": return 12.0;
    case "NHL": return 1.85;
    case "MLB": return 3.05;
    case "NCAAB": return 11.5;
    default: return 13.0;
  }
}

export function leagueTotal(sport: string): number {
  switch (sport) {
    case "NFL": return 44.5;
    case "NCAAF": return 54;
    case "NBA": return 224;
    case "NHL": return 6.1;
    case "MLB": return 8.6;
    case "NCAAB": return 145;
    default: return 45;
  }
}

export function pythagoreanWp(pf: number, pa: number, sport: string): number | null {
  if (!(pf > 0 && pa > 0)) return null;
  const exp = sport === "MLB" ? 1.83 : sport === "NBA" ? 13.91 : sport === "NCAAB" ? 10.25 : sport === "NHL" ? 2.07 : 2.37;
  const num = pf ** exp;
  return num / (num + pa ** exp);
}

export function parseEra(line?: string): number | undefined {
  if (!line) return undefined;
  const m = /ERA\s*(\d+\.\d+)/i.exec(line);
  if (!m) return undefined;
  const n = Number(m[1]);
  return n > 0 && n < 15 ? n : undefined;
}

export function parseWhip(line?: string): number | undefined {
  if (!line) return undefined;
  const m = /WHIP\s*(\d+\.\d+)/i.exec(line);
  if (!m) return undefined;
  const n = Number(m[1]);
  return n > 0 && n < 4 ? n : undefined;
}

export function spreadToWinProb(homeSpread: number, sport: string): number {
  const mu = -homeSpread;
  const z = mu / marginSigma(sport);
  return invLogit(logit(normalCdf(z)));
}

export function totalSigma(sport: string): number {
  switch (sport) {
    case "MLB": return 2.85;
    case "NFL": return 10.2;
    case "NCAAF": return 13.5;
    case "NBA": return 11.5;
    case "NCAAB": return 10.8;
    case "NHL": return 1.65;
    default: return 10;
  }
}

function normalPdf(x: number, mean: number, std: number): number {
  const z = (x - mean) / std;
  return Math.exp(-0.5 * z * z) / (std * Math.sqrt(2 * Math.PI));
}

function getBaseMass(m: number): number {
  const absM = Math.abs(m);
  if (absM === 0) return 0.002; // Very few ties
  const masses: Record<number, number> = {
    1: 0.025, 2: 0.020, 3: 0.150, 4: 0.045, 5: 0.015,
    6: 0.045, 7: 0.095, 8: 0.020, 9: 0.010, 10: 0.055,
    11: 0.020, 12: 0.005, 13: 0.010, 14: 0.050, 15: 0.010,
    16: 0.010, 17: 0.020, 18: 0.005, 19: 0.005, 20: 0.005,
    21: 0.020, 24: 0.015, 28: 0.010, 31: 0.005, 35: 0.005
  };
  return masses[absM] ?? 0.005;
}

export function footballCoverProb(spread: number | undefined | null, projectedMargin: number | undefined | null, sport: string): { p: number; empty: boolean } {
  if (spread == null || Number.isNaN(spread) || projectedMargin == null || Number.isNaN(projectedMargin)) {
    return { p: 0.50, empty: true };
  }
  
  if (sport !== "NFL" && sport !== "NCAAF") {
    return { p: 0.50, empty: true };
  }

  const std = sport === "NFL" ? 10.2 : 13.5;
  let totalWeight = 0;
  let coverWeight = 0;

  for (let m = -60; m <= 60; m++) {
    const baseFreq = getBaseMass(m);
    const projDensity = normalPdf(m, projectedMargin, std);
    const weight = baseFreq * projDensity;
    
    totalWeight += weight;
    
    if (m + spread > 0) {
      coverWeight += weight;
    } else if (m + spread === 0) {
      coverWeight += weight * 0.5;
    }
  }

  if (totalWeight === 0) return { p: 0.50, empty: true };
  
  const p = Math.min(0.99, Math.max(0.01, coverWeight / totalWeight));
  return { p, empty: false };
}

export function homeCoverProb(expectedHomeMargin: number, homeLine: number, sport: string): number {
  if (sport === "NFL" || sport === "NCAAF") {
    return footballCoverProb(homeLine, expectedHomeMargin, sport).p;
  }
  const z = (expectedHomeMargin + homeLine) / marginSigma(sport);
  return invLogit(logit(normalCdf(z)), 0.01, 0.99);
}

export function overProb(mean: number, line: number, sport: string): number {
  const z = (line - mean) / totalSigma(sport);
  return invLogit(logit(1 - normalCdf(z)), 0.02, 0.98);
}

function formBlock(lastFive: FormBlock[] | undefined, team: string): FormBlock | undefined {
  if (!lastFive?.length) return undefined;
  const n = team.toLowerCase();
  return lastFive.find((b) => b.team.toLowerCase() === n);
}

function recencyWp(block?: FormBlock): number | null {
  if (!block) return null;
  const games = block.games?.filter((g) => g.result === "W" || g.result === "L");
  if (games && games.length >= 3) {
    const read = analyzeScores(games, 10);
    if (read) return read.wp;
  }
  const results = block.results.filter((r) => r === "W" || r === "L").slice(0, 10);
  if (results.length < 3) return null;
  const w = ewmaWeights(results.length);
  return results.reduce((s, r, i) => s + (r === "W" ? 1 : 0) * (w[i] ?? 0), 0);
}

function dynamicMarginWp(block: FormBlock | undefined, sport: string): number | null {
  const games = block?.games?.filter((g) => g.pf != null && g.pa != null) ?? [];
  if (games.length < 3) return null;
  
  let totalMargin = 0;
  let weightSum = 0;
  
  games.slice(0, 10).forEach((g, i) => {
    let weight = Math.pow(0.82, i);
    if (g.oppDefRating && g.oppDefRating > 1.05) {
      weight *= 0.75;
    }
    const margin = (g.pf!) - (g.pa!);
    totalMargin += margin * weight;
    weightSum += weight;
  });

  const avgMargin = totalMargin / weightSum;
  const z = avgMargin / (marginSigma(sport) * Math.sqrt(1 + 1 / Math.min(10, games.length)));
  return invLogit(logit(normalCdf(z)));
}

function crowdPrecision(volume: number | undefined, spread: number | undefined, base: number): number {
  let p = base;
  if (volume != null && volume > 0) {
    const scale = Math.min(1.8, Math.max(0.45, 0.35 + 0.22 * Math.log10(volume + 1)));
    p *= scale;
  } else {
    p *= 0.55;
  }
  if (spread != null && spread > 0) {
    const widen = Math.min(2.2, 1 + spread / 0.06);
    p /= widen;
  }
  return p;
}

function samplePrecision(n: number | undefined, full: number, minN = 20): number {
  if (n == null || n <= 0) return full * 0.45;
  return full * Math.min(1, Math.sqrt(n / minN));
}

function pushLayer(
  layers: ChanceLayer[],
  layer: Omit<ChanceLayer, "weight"> & { weight?: number },
): void {
  if (!Number.isFinite(layer.home)) return;
  const empty = Boolean(layer.empty) || layer.precision <= 0;
  const precision = empty ? 0 : layer.precision;
  const home = empty ? 0.5 : invLogit(logit(layer.home));
  layers.push({
    ...layer,
    home,
    weight: precision,
    precision,
    thin: layer.thin || empty,
    empty,
  });
}

function pushEmpty(layers: ChanceLayer[], id: string, label: string, note: string): void {
  pushLayer(layers, {
    id,
    label,
    home: 0.5,
    precision: 0,
    family: "context",
    note: `${note} Status: Looked (Empty). Missing data has zero weight — no 50/50 drag.`,
    thin: true,
    empty: true,
  });
}

export function marketPrecision(hoursToKickoff?: number, vigWidth = 0.045): number {
  const T = hoursToKickoff != null && Number.isFinite(hoursToKickoff) ? Math.max(0, hoursToKickoff) : 24;
  const vig = vigWidth > 0 ? vigWidth : 0.045;
  return 14.0 * (1 + 0.6 / Math.sqrt(T + 0.5)) * (0.045 / vig);
}

function hoursToStart(start?: string): number | undefined {
  if (!start) return undefined;
  const t = new Date(start).getTime();
  if (!Number.isFinite(t)) return undefined;
  return (t - Date.now()) / 3_600_000;
}

export function buildChance(input: ChanceInput): ChanceReport | null {
  const layers: ChanceLayer[] = [];
  const sport = input.sport || "NFL";

  if (input.oddsHome != null && Number.isFinite(input.oddsHome) && !thinClose(input.oddsHome)) {
    pushLayer(layers, {
      id: "market",
      label: "Sportsbook no-vig (close)",
      home: input.oddsHome,
      precision: marketPrecision(hoursToStart(input.start)),
      family: "market",
      note: "Two-way price with the house cut stripped. Real money, delayed. The close is the opponent.",
    });
  } else {
    pushEmpty(layers, "market", "Sportsbook no-vig (close)", "Looked up the live two-way close. Empty or too thin to be a close.");
  }

  if (input.openHome != null && Number.isFinite(input.openHome) && (input.oddsHome == null || Math.abs(input.openHome - input.oddsHome) > 0.012)) {
    pushLayer(layers, {
      id: "open",
      label: "Opening line",
      home: input.openHome,
      precision: openPrecision(input.oddsHome != null),
      family: "market",
      note: openMoveNote(input.openHome, input.oddsHome, input.home),
    });
  }

  if (input.bookHome != null && Number.isFinite(input.bookHome) && (input.oddsHome == null || Math.abs(input.bookHome - input.oddsHome) > 0.012)) {
    pushLayer(layers, {
      id: "book",
      label: "Posted book moneyline",
      home: input.bookHome,
      precision: 4,
      family: "market",
      note: "A second sportsbook print from ESPN's pick center.",
    });
  }

  // Tape: tickets % vs handle % — sharp tell when they split (BIBLE §tape rule)
  for (const layer of tapeLayers({
    home: input.home,
    oddsHome: input.oddsHome,
    openHome: input.openHome,
    ticketHome: input.ticketHome,
    handleHome: input.handleHome,
    steam: input.steam,
  })) {
    if (layer.empty) pushEmpty(layers, layer.id, layer.label, layer.note);
    else pushLayer(layers, layer);
  }

  if (input.homeSpread != null && Number.isFinite(input.homeSpread) && Math.abs(input.homeSpread) > 0.05) {
    const runline = sport === "MLB" && Math.abs(input.homeSpread - 0) <= 1.6;
    if (!runline) {
      const fromSpread = spreadToWinProb(input.homeSpread, sport);
      const correlated = input.oddsHome != null && Math.abs(fromSpread - input.oddsHome) < 0.03;
      pushLayer(layers, {
        id: "spread",
        label: "Spread-implied winner",
        home: fromSpread,
        precision: correlated ? 2.2 : 7.5,
        family: "market",
        note: `Converts point spread to win chance with ${sport} scoring curve.`,
      });
    }
  }

  if (input.kalshiHome != null && Number.isFinite(input.kalshiHome)) {
    pushLayer(layers, {
      id: "kalshi",
      label: "Kalshi prediction market",
      home: input.kalshiHome,
      precision: crowdPrecision(input.kalshiVolume, input.kalshiSpread, 8.5),
      family: "crowd",
      note: "Event-contract mid-price. Research only.",
    });
  } else {
    pushEmpty(layers, "kalshi", "Kalshi prediction market", "Empty book.");
  }

  if (input.polyHome != null && Number.isFinite(input.polyHome)) {
    pushLayer(layers, {
      id: "polymarket",
      label: "Polymarket prediction market",
      home: input.polyHome,
      precision: crowdPrecision(input.polyVolume, undefined, 7.5),
      family: "crowd",
      note: "On-chain moneyline share price. Research only.",
    });
  } else {
    pushEmpty(layers, "polymarket", "Polymarket prediction market", "Empty book.");
  }

  if (input.espnHome != null && Number.isFinite(input.espnHome)) {
    pushLayer(layers, {
      id: "espn",
      label: "ESPN matchup model",
      home: input.espnHome,
      precision: 6.2,
      family: "model",
      note: "ESPN's published game projection.",
    });
  } else {
    pushEmpty(layers, "espn", "ESPN matchup model", "Empty look.");
  }

  const homeSplit = parseRecord(input.homeSplit);
  const awaySplit = parseRecord(input.awaySplit);
  const homeRec = parseRecord(input.homeRecord);
  const awayRec = parseRecord(input.awayRecord);
  const homeWp = homeSplit?.wp ?? homeRec?.wp;
  const awayWp = awaySplit?.wp ?? awayRec?.wp;
  
  if (homeWp != null && awayWp != null) {
    const raw = log5(homeWp, awayWp);
    const usingSplits = Boolean(homeSplit && awaySplit);
    const withHome = usingSplits ? raw : invLogit(logit(raw) + homeFieldLogit(sport));
    const n = Math.min(homeSplit?.n ?? homeRec?.n ?? 20, awaySplit?.n ?? awayRec?.n ?? 20);
    pushLayer(layers, {
      id: "log5",
      label: usingSplits ? "Home/road log5" : "Record model (log5 + home field)",
      home: withHome,
      precision: samplePrecision(n, 3.6, sport === "MLB" ? 40 : 8),
      family: "model",
      note: usingSplits ? "Splits already include home-field." : "Season record plus home-field bump.",
    });
  }

  const homePy = pythagoreanWp(input.homePf ?? 0, input.homePa ?? 0, sport);
  const awayPy = pythagoreanWp(input.awayPf ?? 0, input.awayPa ?? 0, sport);
  if (homePy != null && awayPy != null) {
    const raw = log5(homePy, awayPy);
    pushLayer(layers, {
      id: "pythag",
      label: "Pythagorean (points / runs)",
      home: invLogit(logit(raw) + homeFieldLogit(sport) * 0.5),
      precision: 4.1,
      family: "model",
      note: "Win rate implied by scoring and allowing.",
    });
  }

  const homeFormEarly = formBlock(input.lastFive, input.home);
  const awayFormEarly = formBlock(input.lastFive, input.away);
  const homeL10 = homeFormEarly?.games ? analyzeScores(homeFormEarly.games, 10) : null;
  const awayL10 = awayFormEarly?.games ? analyzeScores(awayFormEarly.games, 10) : null;

  const hOff = input.homePf;
  const hDef = input.homePa;
  const aOff = input.awayPf;
  const aDef = input.awayPa;
  
  if (hOff != null && hDef != null && aOff != null && aDef != null) {
    const homeScore = (hOff + aDef) / 2;
    const awayScore = (aOff + hDef) / 2;
    const margin = homeScore - awayScore;
    const p = invLogit(logit(spreadToWinProb(-margin, sport)) + homeFieldLogit(sport) * 0.35);
    pushLayer(layers, {
      id: "efficiency",
      label: "Scoring margin (efficiency)",
      home: p,
      precision: 4.0,
      family: "model",
      note: `Expected margin model.`,
    });
  } else {
    pushEmpty(layers, "efficiency", "Scoring margin (efficiency)", "Empty look.");
  }

  const hf = recencyWp(homeFormEarly);
  const af = recencyWp(awayFormEarly);
  if (hf != null && af != null) {
    const nForm = Math.max(homeFormEarly?.games?.length ?? 0, awayFormEarly?.games?.length ?? 0);
    const damp = earlySeasonDamp(nForm, sport);
    pushLayer(layers, {
      id: "form",
      label: "Last 10 scores (recency-weighted)",
      home: invLogit(logit(log5(Math.min(0.82, Math.max(0.18, hf)), Math.min(0.82, Math.max(0.18, af)))) + homeFieldLogit(sport) * 0.25),
      precision: ((nForm >= 8 ? 2.8 : 2.1) * damp) || 0,
      family: "context",
      note: "Latest game counts most.",
    });
  }

  const hm = dynamicMarginWp(homeFormEarly, sport);
  const am = dynamicMarginWp(awayFormEarly, sport);
  if (hm != null && am != null) {
    const raw = log5(hm, am);
    const nMargin = Math.max(homeFormEarly?.games?.length ?? 0, awayFormEarly?.games?.length ?? 0);
    pushLayer(layers, {
      id: "margin",
      label: "Score-margin (last 10)",
      home: invLogit(logit(raw) + homeFieldLogit(sport) * 0.3),
      precision: ((nMargin >= 8 ? 3.0 : 2.4) * earlySeasonDamp(nMargin, sport)) || 0,
      family: "model",
      note: "Dynamic EWMA adjusting for opponent defense.",
    });
  }

  const rEffect = restEffect({ sport, start: input.start, homeRestDays: input.homeRestDays, awayRestDays: input.awayRestDays });
  if (!rEffect.empty) {
    pushLayer(layers, {
      id: "rest",
      label: "Rest / schedule",
      home: rEffect.layerHome,
      precision: rEffect.precision,
      family: "context",
      note: rEffect.note,
    });
  } else {
    pushEmpty(layers, "rest", "Rest / schedule", "Looked up rest from the live log. Empty look.");
  }

  if (sport === "MLB") {
    const park = lookupVenue(input.venue, sport);
    const pf = park?.runs ?? park?.hits ?? 1;
    if (park != null && pf !== 1) {
      const betterHome = input.homeEra != null && input.awayEra != null ? input.homeEra < input.awayEra : (homeWp ?? 0.5) > (awayWp ?? 0.5);
      const towardBetter = pf < 1 ? 0.035 : pf > 1 ? -0.02 : 0;
      const p = invLogit((betterHome ? 1 : -1) * towardBetter);
      pushLayer(layers, {
        id: "park",
        label: "Ballpark",
        home: p,
        precision: Math.abs(pf - 1) >= 0.04 ? 1.15 : 0.5,
        family: "context",
        note: `${park.id} factor ${pf.toFixed(2)}. Extreme parks add chaos.`,
        thin: Math.abs(pf - 1) < 0.04,
      });
    } else {
      pushEmpty(layers, "park", "Ballpark", "Looked up the venue factor. Park not posted on this event.");
    }
  }

  const process = processFromLooks(sport, input.homeLooks, input.awayLooks);
  pushLayer(layers, {
    id: "process",
    label: process.source,
    home: process.home,
    precision: process.empty ? 0 : 2.4,
    family: "model",
    note: process.note,
    thin: process.empty,
    empty: process.empty,
  });

  // Availability layer — injury outs / questionable count (BIBLE §1 context stack)
  {
    const avail = availabilityEffect({
      sport,
      homeOuts: input.homeOuts,
      awayOuts: input.awayOuts,
      homeQuestionable: input.homeQuestionable,
      awayQuestionable: input.awayQuestionable,
    });
    pushLayer(layers, {
      id: "availability",
      label: "Availability",
      home: avail.layerHome,
      precision: avail.empty ? 0 : avail.precision,
      family: "context",
      note: avail.note,
      thin: avail.empty,
      empty: avail.empty,
    });
  }

  // Officials / crew tendency layer (BIBLE §1 context stack)
  {
    const layer = officialLayer({ sport, officials: input.officials });
    if (layer.empty) pushEmpty(layers, layer.id, layer.label, layer.note);
    else pushLayer(layers, { ...layer, family: "context" });
  }

  // H2H + venue-split layers from splits-g (BIBLE §h2h + venue-split rules)
  for (const layer of splitLayers({
    sport,
    home: input.home,
    away: input.away,
    lastFive: input.lastFive,
    homeLooks: input.homeLooks,
    awayLooks: input.awayLooks,
  })) {
    if (layer.empty) pushEmpty(layers, layer.id, layer.label, layer.note);
    else pushLayer(layers, { ...layer, family: "context" });
  }

  // Defense / underlying / platoon / pitcher layers from matchup-g (BIBLE §defense + platoon rules)
  for (const layer of matchupLayers({
    sport,
    homeLooks: input.homeLooks,
    awayLooks: input.awayLooks,
    homeEra: input.homeEra,
    awayEra: input.awayEra,
    homePitcherHand: input.homePitcherHand,
    awayPitcherHand: input.awayPitcherHand,
  })) {
    if (layer.empty) pushEmpty(layers, layer.id, layer.label, layer.note);
    else pushLayer(layers, { ...layer, family: "model" });
  }

  if (!layers.length) return null;

  const pooled = poolLayers(layers, input.oddsHome ?? input.bookHome, input.layerHaircuts);
  let home = pooled.mean;

  if (input.total != null && input.total > 0) {
    const avg = leagueTotal(sport);
    const chaos = Math.max(0, Math.min(0.22, (input.total - avg) / (avg * 4)));
    home = 0.5 + (home - 0.5) * (1 - chaos);
  }

  home = Math.min(FINAL_HI, Math.max(FINAL_LO, home));

  const n = layers.length;
  const std = pooled.std;
  const agreement = Math.max(0, 1 - std / 0.14);
  const families = new Set(layers.map((l) => l.family)).size;
  const confidence: ChanceReport["confidence"] =
    n >= 6 && families >= 3 && std < 0.05 && pooled.posteriorVar < 0.012 ? "high" : n >= 3 && std < 0.1 ? "medium" : "low";

  const favorite = home >= 0.5 ? "home" : "away";
  const chance = favorite === "home" ? home : 1 - home;
  
  return {
    home,
    away: 1 - home,
    favorite,
    favoriteName: favorite === "home" ? input.home : input.away,
    chance,
    confidence,
    agreement,
    layers,
    posteriorVar: pooled.posteriorVar,
    because: "Apex Engine evaluation complete.",
  };
}

function poolLayers(
  layers: ChanceLayer[],
  marketHome?: number,
  haircuts?: Record<string, number>,
): { mean: number; std: number; posteriorVar: number; overdispersed: boolean } {
  const active = layers
    .map((l) => {
      const h = haircuts?.[l.id];
      if (h == null || h === 1 || !Number.isFinite(h)) return l;
      return { ...l, precision: l.precision * Math.max(0, h) };
    })
    .filter((l) => l.precision > 0 && !l.empty);
    
  if (!active.length) {
    return { mean: 0.5, std: 0, posteriorVar: 1, overdispersed: false };
  }
  
  const precSum0 = active.reduce((s, l) => s + l.precision, 0);
  const logitMean0 = active.reduce((s, l) => s + logit(l.home) * l.precision, 0) / precSum0;

  const meanP = active.reduce((s, l) => s + l.home, 0) / active.length;
  const variance = active.reduce((s, l) => s + (l.home - meanP) ** 2, 0) / active.length;
  const std = Math.sqrt(variance);

  let chi = 0;
  for (const l of active) chi += l.precision * (logit(l.home) - logitMean0) ** 2;
  const df = Math.max(1, active.length - 1);
  const overdispersed = chi / df > 1.35;

  const scaled = active.map((l) => {
    if (!overdispersed) return l;
    if (l.family === "market") return l;
    const shrink = Math.max(0.35, 1.35 / (chi / df));
    return { ...l, precision: l.precision * shrink };
  });

  const precSum = scaled.reduce((s, l) => s + l.precision, 0);
  let z = scaled.reduce((s, l) => s + logit(l.home) * l.precision, 0) / precSum;
  if (marketHome != null && overdispersed) {
    const lambda = Math.min(0.55, 0.18 + 0.5 * Math.max(0, 1 - Math.max(0, 1 - std / 0.14)));
    z = lambda * logit(marketHome) + (1 - lambda) * z;
  }

  return {
    mean: invLogit(z, FINAL_LO, FINAL_HI),
    std,
    posteriorVar: 1 / precSum,
    overdispersed,
  };
}
export function poissonCdf(k: number, lambda: number): number {
  if (lambda <= 0) return 1;
  if (k < 0) return 0;
  const cap = Math.min(Math.floor(k), 80);
  let term = Math.exp(-lambda);
  let sum = term;
  for (let i = 1; i <= cap; i++) {
    term *= lambda / i;
    sum += term;
    if (term < 1e-12) break;
  }
  return Math.min(1, sum);
}

export function poissonOver(lambda: number, line: number): number {
  const k = Math.floor(line);
  return invLogit(logit(1 - poissonCdf(k, Math.max(0.02, lambda))), 0.06, 0.94);
}
/**
 * Prices a discrete player prop (e.g., Receptions, Touchdowns) using the Poisson distribution.
 */
export function priceDiscretePlayerProp(
  propType: string,
  line: number,
  baseline: PlayerVolumeBaseline,
  teamExpectedPace: number
): { overProb: number; underProb: number } | null {
  const mu = calculatePlayerPropMean(propType, baseline, teamExpectedPace);
  
  // Empty Look — no baseline data. Return null; never inject 50/50 drag. (BIBLE §0.1)
  if (mu === 0) return null;
  
  const probOver = poissonOver(mu, line);
  return {
    overProb: probOver,
    underProb: 1 - probOver
  };
}

/**
 * Prices a continuous player prop (e.g., Receiving Yards) using the Normal CDF.
 */
export function priceContinuousPlayerProp(
  propType: string,
  line: number,
  baseline: PlayerVolumeBaseline,
  teamExpectedPace: number
): { overProb: number; underProb: number } | null {
  const mu = calculatePlayerPropMean(propType, baseline, teamExpectedPace);
  
  // Empty Look — no baseline data. Return null; never inject 50/50 drag. (BIBLE §0.1)
  if (mu === 0) return null;
  
  // Standard deviation scales sub-linearly with expected volume
  const sigma = Math.max(4, Math.sqrt(mu) * 3.5); 
  
  const z = (line - mu) / sigma;
  const underProb = normalCdf(z);
  
  return {
    overProb: 1 - underProb,
    underProb: underProb
  };
}
/**
 * Calculates the expected volume for a player prop based on team pace and target share.
 * Translates underlying volume into a mathematical mean for the CDF.
 */
export function calculatePlayerPropMean(
  propType: string,
  baseline: PlayerVolumeBaseline,
  teamExpectedPace: number
): number {
  if (!baseline) return 0;
  
  // Convert the player's target share into expected raw volume based on the game environment
  const expectedTargets = baseline.targetShare * teamExpectedPace;
  
  switch (propType.toLowerCase()) {
    case "receptions":
      // Standard 65% catch rate baseline adjusted by EPA
      const expectedCatchRate = Math.max(0.4, Math.min(0.85, 0.65 + (baseline.epaPerPlay * 0.05)));
      return expectedTargets * expectedCatchRate;
      
    case "receiving_yards":
      // ~11.5 yards per reception baseline
      const expectedReceptions = expectedTargets * 0.65;
      return expectedReceptions * (11.5 + (baseline.epaPerPlay * 2));
      
    case "touchdowns":
      // Red zone snap percentage heavily weights the touchdown Poisson mean
      return (expectedTargets * 0.05) + (baseline.redZoneSnapPct * 0.4);
      
    case "strikeouts":
      // Pitcher strikeouts: (K per Inning) * (Expected Innings)
      return baseline.targetShare * baseline.epaPerPlay;
      
    case "total_bases":
      // Batter bases: (Expected Plate Appearances) * (OBP Proxy) * 1.2 Extra Base modifier
      return baseline.targetShare * baseline.epaPerPlay * 1.2;

    case "shots_on_goal":
      // NHL Shots: (TOI Share Baseline) * 2.8 average shots per top-6 forward
      return baseline.targetShare * 2.8 * baseline.epaPerPlay;
      
    case "points":
      // NHL Points: (TOI Share Baseline) * 0.8 expected game involvement rate
      return baseline.targetShare * 0.8 * baseline.epaPerPlay;

case "points_nba":
      // NBA Points: (Expected Minutes) * (Usage Shot Rate) * Efficiency multiplier
      // baseline.targetShare * 48 gives projected minutes
      const projectedMinutes = baseline.targetShare * 48;
      return projectedMinutes * baseline.epaPerPlay * 1.85;

    case "rebounds":
      // NBA Rebounds: Expected Minutes * baseline rebound rate (~0.22 per minute)
      return (baseline.targetShare * 48) * 0.22;

    case "assists":
      // NBA Assists: Expected Minutes * baseline assist rate (~0.16 per minute)
      return (baseline.targetShare * 48) * 0.16;
      
    default:
      return 0;
  }
}

