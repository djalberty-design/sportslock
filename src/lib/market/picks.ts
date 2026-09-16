/**
 * AI Picks desk — rank every ticket the book posts, not just game winners.
 *
 * Popular (ML / spread / total), player props, period markets, same-game
 * parlays, and cross-game 2/3/4-legs all go through ticketScore:
 * chance × payout × market-quality × edge vs the juice.
 * Tape is a layer. Never a lock.
 */
import { formatChancePct, shortPick } from "../copy.ts";
import { isTodayEt, matchupLine } from "../utils.ts";
import { americanToDecimal, americanToImplied, evaluateParlay, payoutMultiple, product } from "./engine.ts";
import { calibratedChance, parlayInfoQuality } from "./calibrate.ts";
import { teamNick } from "./logos.ts";
import { cellsInMarket, buildSheet } from "./sheet.ts";
import { correlationOf, sgpHaircut } from "./parlays.ts";
import { rowToPick, type EventResearch, type ParlayPick } from "./research.ts";
import { deskScore, parlayScore } from "./tape.ts";
import { isCollegeSport, isMainMarket } from "./universe.ts";
import { earlyMover } from "./edge.ts";
import { DEFAULT_SAFEST_FLOOR } from "../desk-settings.ts";
import { isLiveDeskPick, liveQualityCap } from "./call-gate.ts";
import { combineParlayFair } from "./joint-grade.ts";
import type {
  DeskSnapshot,
  EventBrief,
  MarketType,
  ParlayCandidate,
  ParlayLeg,
  PickBucket,
  ScanBundle,
  ScanRow,
  TapeLean,
} from "./types.ts";

export type DeskConfidence = "high" | "medium" | "low";
export type DeskMood = "value" | "safe" | "pay";

export type DeskPick = {
  id: string;
  bucket: PickBucket;
  selection: string;
  chance: number;
  price?: number;
  decimalPayout: number;
  score: number;
  row?: ScanRow;
  parlay?: ParlayCandidate;
  sport: string;
  eventId?: string;
  home?: string;
  away?: string;
  start?: string;
  why: string;
  ticketPct?: number;
  handlePct?: number;
  tapeLean?: ScanRow["tapeLean"];
  tapeNote?: string;
  player?: string;
  researchOnly?: boolean;
  implied?: number;
  edge?: number;
  infoQuality: number;
  confidence: DeskConfidence;
  homeAbbr?: string;
  awayAbbr?: string;
  homeLogo?: string;
  awayLogo?: string;
  tapeStamp?: "hr-fl" | "photographed" | "research";
  simFair?: number;
  poolFair?: number;
  processLooked?: boolean;
  processSource?: string;
  earlyMover?: boolean;
  safestFallback?: boolean;
};

export type DeskPicks = {
  hero: DeskPick | null;
  popular: DeskPick[];
  props: DeskPick[];
  periods: DeskPick[];
  sgp: DeskPick[];
  two: DeskPick[];
  three: DeskPick[];
  four: DeskPick[];
  ribbon: DeskPick[];
  all: DeskPick[];
};

const BUCKETS: PickBucket[] = ["popular", "prop", "period", "sgp", "parlay2", "parlay3", "parlay4"];

/** Unique market cell (no bucket) — used to de-dupe sheet vs posted rows. */
export function rowTicketId(row: {
  eventId: string;
  marketType: string;
  side: string;
  selection: string;
  point?: number;
  player?: string;
}): string {
  return ["r", row.eventId, row.marketType, row.side, row.point ?? "", row.player ?? "", row.selection].join("|");
}

export function pickId(
  row: {
    eventId: string;
    marketType: string;
    side: string;
    selection: string;
    point?: number;
    player?: string;
  },
  bucket: PickBucket,
): string {
  return ["r", bucket, row.eventId, row.marketType, row.side, row.point ?? "", row.player ?? "", row.selection].join(
    "|",
  );
}

export function parlayTicketId(p: ParlayCandidate): string {
  return parlayTicketIdFromLegs(p.legs);
}

/**
 * URL-safe parlay id. `|`, `.`, `~`, spaces, and `+` get eaten by query parsers
 * and then `/ticket` rebuilds the wrong legs (moneyline TBA at ~25%).
 * Shape: `p2__eventId__market__side__eventId__market__side`
 */
export function parlayTicketIdFromLegs(
  legs: Array<{ eventId: string; marketType: string; side: string; selection?: string }>,
): string {
  const blob = legs
    .map((l) => `${safeIdToken(l.eventId || "x")}__${safeIdToken(l.marketType || "ml")}__${safeIdToken(l.side || "home")}`)
    .join("__");
  return `p${legs.length}__${blob}`;
}

function safeIdToken(s: string): string {
  return String(s).replace(/[^A-Za-z0-9_-]/g, "_");
}

export function decodeTicketId(id: string): string {
  let s = String(id ?? "").trim();
  for (let i = 0; i < 2; i++) {
    try {
      const next = decodeURIComponent(s);
      if (next === s) break;
      s = next;
    } catch {
      break;
    }
  }
  return s.replace(/%7E/gi, "~").replace(/%7C/gi, "|");
}

/** Same id TicketPage and ParlayTray read so the slip cannot print two integers. */
export function resolveTicketId(routerId: string): string {
  const fromRouter = decodeTicketId(routerId);
  if (typeof window === "undefined") return fromRouter;
  try {
    const raw = new URLSearchParams(window.location.search).get("id") ?? "";
    const decoded = decodeTicketId(raw);
    if (decoded.length > fromRouter.length) return decoded;
    if (fromRouter.length <= 2 && decoded.length > fromRouter.length) return decoded;
    return decoded || fromRouter;
  } catch {
    return fromRouter;
  }
}

function chunkLegs(
  parts: string[],
  group: number,
): Array<{ eventId: string; marketType: string; side: string; selection: string }> | null {
  if (group < 3 || parts.length < group * 2 || parts.length % group !== 0) return null;
  const out = [];
  for (let i = 0; i < parts.length; i += group) {
    out.push({
      eventId: parts[i] ?? "",
      marketType: parts[i + 1] || "ml",
      side: parts[i + 2] ?? "",
      selection: "",
    });
  }
  return out.length >= 2 ? out : null;
}

export function parseParlayTicketId(
  id: string,
): Array<{ eventId: string; marketType: string; side: string; selection: string }> | null {
  const raw = decodeTicketId(id);
  if (!raw) return null;

  const under = /^p(\d+)__(.+)$/.exec(raw);
  if (under) {
    const n = Number(under[1]);
    const parts = under[2].split("__").filter(Boolean);
    if (n >= 2 && parts.length === n * 3) return chunkLegs(parts, 3);
  }

  const dotted = /^p(\d+)\.(.+)$/.exec(raw);
  if (dotted && !raw.includes("|") && !raw.includes("~") && !raw.includes("__")) {
    const n = Number(dotted[1]);
    const parts = dotted[2].split(".").filter(Boolean);
    if (n >= 2 && parts.length === n * 3) return chunkLegs(parts, 3);
  }

  const compact = /^p(\d+)-(.+)$/.exec(raw);
  if (compact) {
    const chunks = compact[2].split("--").filter(Boolean);
    if (!chunks.length) return null;
    return chunks.map((chunk) => {
      const [eventId, marketType, side] = chunk.split("~");
      return {
        eventId: eventId ?? "",
        marketType: marketType || "ml",
        side: side ?? "",
        selection: "",
      };
    });
  }

  if (raw.startsWith("p|")) {
    const rest = raw.slice(2);
    const bar = rest.indexOf("|");
    if (bar < 0) return null;
    const blob = rest.slice(bar + 1);
    const chunks = blob.split("||").filter(Boolean);
    if (!chunks.length) return null;
    return chunks.map((chunk) => {
      const [eventId, marketType, side, ...sel] = chunk.split("~");
      return {
        eventId: eventId ?? "",
        marketType: marketType || "ml",
        side: side ?? "",
        selection: sel.join("~"),
      };
    });
  }

  return null;
}

export function matchLegRow(
  rows: ScanRow[],
  leg: { eventId: string; marketType: string; side: string; selection?: string },
): ScanRow | undefined {
  if (!leg.eventId) return undefined;
  return (
    rows.find(
      (r) =>
        r.eventId === leg.eventId &&
        r.marketType === leg.marketType &&
        r.side === leg.side &&
        (!leg.selection || r.selection === leg.selection),
    ) ??
    rows.find((r) => r.eventId === leg.eventId && r.marketType === leg.marketType && r.side === leg.side) ??
    (leg.selection
      ? rows.find((r) => r.eventId === leg.eventId && r.selection === leg.selection)
      : undefined)
  );
}

function sameLegSet(
  a: Array<{ eventId: string; marketType: string; side: string }>,
  b: Array<{ eventId: string; marketType: string; side: string }>,
): boolean {
  if (a.length !== b.length) return false;
  const key = (l: { eventId: string; marketType: string; side: string }) => `${l.eventId}|${l.marketType}|${l.side}`;
  const left = a.map(key).sort().join(";");
  const right = b.map(key).sort().join(";");
  return left === right;
}

/**
 * How much information this market actually carries.
 * Sharps do not treat a 1st-inning 0.5 the same as a full-game moneyline.
 * Period slices are shrunk in the sheet; this stops them from stealing The Call.
 * NFL/CFB spreads get a key-number tilt (3 and 7) — Dimers / CLV desks treat those as physics.
 */
export function infoQuality(opts: {
  bucket: PickBucket;
  selection: string;
  marketType?: string;
  isProp?: boolean;
  point?: number;
  sport?: string;
  inPlay?: boolean;
}): number {
  const sel = (opts.selection || "").toLowerCase();
  const bucket = opts.bucket;
  let q = 0.75;
  if (bucket === "period" || /inning|quarter|1st half|2nd half|\bperiod\b/.test(sel)) {
    if (/1st inning|first inning|1st inn/.test(sel) && (opts.point === 0.5 || /0\.5/.test(sel))) q = 0.36;
    else if (/inning/.test(sel)) q = 0.46;
    else if (/f5|first 5|1st 5/.test(sel)) q = 0.64;
    else if (/quarter|\bperiod\b/.test(sel)) q = 0.5;
    else if (/half/.test(sel)) q = 0.58;
    else q = 0.48;
  } else if (bucket === "prop" || opts.isProp || opts.marketType === "prop") {
    q = /anytime|home run|to steal|to score|2\+/.test(sel) ? 0.68 : 0.8;
    if (/first (basket|goal|td|score)|next scorer/.test(sel)) q = 0.58;
  } else if (/exact|correct score/.test(sel)) {
    q = 0.4;
  } else if (/odd|even|highest/.test(sel)) {
    q = 0.48;
  } else if (opts.marketType === "ml") {
    q = 1;
  } else if (opts.marketType === "spread") {
    q = 0.94 + keyNumberTilt(opts.sport, opts.point);
  } else if (opts.marketType === "total") {
    const trimmed = sel.trim();
    const teamTotal = /\b(over|under)\s+\d/.test(trimmed) && !/^(over|under)\s/.test(trimmed);
    q = teamTotal ? 0.7 : 0.86;
  } else if (bucket === "sgp") q = 0.62;
  else if (bucket === "parlay2") q = 0.7;
  else if (bucket === "parlay3") q = 0.55;
  else if (bucket === "parlay4") q = 0.4;
  if (opts.inPlay) q *= 0.52;
  return Math.max(0.28, Math.min(1, q));
}

/** NFL/CFB: 3 and 7 are the most common margins. Sitting on the right side is extra information. */
export function keyNumberTilt(sport?: string, point?: number): number {
  if (!sport || point == null || !Number.isFinite(point)) return 0;
  if (sport !== "NFL" && sport !== "NCAAF") return 0;
  const favorite = point < 0;
  const abs = Math.abs(point);
  const near3 = Math.abs(abs - 3) <= 0.51;
  const near7 = Math.abs(abs - 7) <= 0.51;
  if (!near3 && !near7) return 0;
  const justInside = abs === 2.5 || abs === 6.5;
  const justPast = abs === 3.5 || abs === 7.5;
  if (favorite) {
    if (justInside) return 0.04;
    if (justPast) return -0.05;
    return 0;
  }
  if (justPast) return 0.04;
  if (justInside) return -0.04;
  return 0;
}

/** Desk chance minus the juice-implied chance. Positive = we are higher than the price. */
export function edgePts(chance: number, price?: number): number {
  if (!Number.isFinite(chance) || price == null || !Number.isFinite(price) || price === 0) return 0;
  const implied = americanToImplied(price);
  if (!Number.isFinite(implied)) return 0;
  return chance - implied;
}

/**
 * Pull the displayed chance toward the book when the market is noisy.
 * Experts (CLV desks, Olympus, Dimers): highest-confidence tail on thin markets
 * is where models overfit. Quality 1.0 keeps the ensemble. A 1st-inning 0.5
 * keeps only ~58% of the disagreement with the juice.
 */
export { calibratedChance, parlayInfoQuality, shownCombinedChance } from "./calibrate.ts";

/**
 * Ranking score. deskScore (chance² × √payout, tape nudge) is the core.
 * Quality haircuts noisy slices. Edge vs the juice is the sharp overlay.
 */
export function ticketScore(
  chance: number,
  price: number,
  lean: TapeLean | null | undefined,
  quality: number,
  edge: number,
): number {
  const base = deskScore(chance, price, lean);
  if (base <= -90) return base;
  let s = base * Math.max(0.28, Math.min(1, quality));
  s += Math.max(-0.07, Math.min(0.14, edge * 1.15));
  return s;
}

/** Quality badge is one scale. High ≥0.72, Med 0.55–0.71, Low <0.55. Chance does not rewrite the label. */
export function qualityBand(quality: number): DeskConfidence {
  const q = Number(quality);
  if (!Number.isFinite(q)) return "low";
  if (q >= 0.72) return "high";
  if (q >= 0.55) return "medium";
  return "low";
}

export function confidenceOf(quality: number, _chance?: number, _edge?: number, _simPoolGap?: number): DeskConfidence {
  return qualityBand(quality);
}

function fromRow(row: ScanRow, bucket: PickBucket, why: string): DeskPick {
  const pay = americanToDecimal(row.price);
  const selection0 = shortPick(row.selection, row.marketType);
  const selection = totalWithUnit(selection0, row.sport, row.marketType);
  const quality0 = infoQuality({
    bucket,
    selection: row.selection,
    marketType: row.marketType,
    isProp: row.isProp,
    point: row.point,
    sport: row.sport,
    inPlay: row.inPlay,
  });
  const closedForm =
    !row.isProp &&
    (row.marketType === "ml" || row.marketType === "spread" || row.marketType === "total") &&
    row.simFair == null;
  const quality = closedForm ? Math.min(quality0, 0.64) : quality0;
  const implied = Number.isFinite(row.price) ? americanToImplied(row.price) : undefined;
  const edge = implied != null && Number.isFinite(implied) ? row.fairProb - implied : 0;
  const shown = calibratedChance(row.fairProb, implied, quality);
  const gap =
    row.simFair != null && row.poolFair != null ? Math.abs(row.simFair - row.poolFair) : undefined;
  return {
    id: pickId(row, bucket),
    bucket,
    selection,
    chance: shown,
    price: row.price,
    decimalPayout: Number.isFinite(pay) ? pay : 1,
    score: ticketScore(row.fairProb, row.price, row.tapeLean, quality, edge),
    row,
    sport: row.sport,
    eventId: row.eventId,
    home: row.home,
    away: row.away,
    start: row.start,
    why,
    ticketPct: row.ticketPct,
    handlePct: row.handlePct,
    tapeLean: row.tapeLean,
    tapeNote: row.tapeNote,
    player: row.player,
    researchOnly: row.researchOnly,
    implied: implied != null && Number.isFinite(implied) ? implied : undefined,
    edge,
    infoQuality: quality,
    confidence: qualityBand(quality),
    homeAbbr: row.homeAbbr,
    awayAbbr: row.awayAbbr,
    homeLogo: row.homeLogo,
    awayLogo: row.awayLogo,
    tapeStamp: row.tapeStamp ?? (row.hardRockPrice != null ? "hr-fl" : "research"),
    simFair: row.simFair,
    poolFair: row.poolFair,
    processLooked: row.processLooked !== false,
    processSource: row.processSource,
    earlyMover: false,
  };
}

function fromParlay(p: ParlayCandidate, bucket: PickBucket): DeskPick {
  const dec = p.decimalPayout ?? 1;
  const names = p.legs.map((l) => shortPick(l.selection, l.marketType)).join(" + ");
  const quality = parlayInfoQuality(p.legs.length, Boolean(p.sameGame));
  const implied = dec > 1 ? 1 / dec : undefined;
  const edge = implied != null ? p.combinedFair - implied : 0;
  const price = p.legs[0]?.price;
  const shown = calibratedChance(p.combinedFair, implied, quality);
  return {
    id: parlayTicketId(p),
    bucket,
    selection: names,
    chance: shown,
    price,
    decimalPayout: Number.isFinite(dec) && dec > 1 ? dec : 1,
    score: (p.score ?? parlayScore(p.combinedFair, dec > 1 ? dec : 1.01)) * quality,
    parlay: p,
    sport: p.sports?.[0] ?? p.legs[0]?.sport ?? "",
    eventId: p.sameGame ? p.legs[0]?.eventId : undefined,
    home: p.sameGame ? p.legs[0]?.home : undefined,
    away: p.sameGame ? p.legs[0]?.away : undefined,
    start: p.legs.map((l) => l.start).sort()[0],
    why: stampDisplayedChance(p.reason, shown),
    researchOnly: p.researchOnly,
    implied,
    edge,
    infoQuality: quality,
    confidence: qualityBand(quality),
    tapeStamp: p.researchOnly ? "research" : "hr-fl",
    earlyMover: false,
  };
}

export function shownParlayChance(p: ParlayCandidate): number {
  const n = p.legs.length;
  const bucket: PickBucket = n >= 4 ? "parlay4" : n === 3 ? "parlay3" : p.sameGame ? "sgp" : "parlay2";
  return fromParlay(p, bucket).chance;
}

function stampDisplayedChance(reason: string, shown: number): string {
  const pct = formatChancePct(shown);
  if (!reason || !pct) return reason;
  const next = reason
    .replace(/Combined chance[^.]*≈\s*[\d.]+(?:\s*in 100)?%?\.?/gi, `Combined chance ≈ ${pct}.`)
    .replace(/about [\d.]+ in 100 tickets/gi, `about ${pct.replace("%", "")} in 100 tickets`);
  return next;
}

/** Displayed combined % from builder legs — same fromParlay calibration the catalog and /ticket use. */
export function shownParlayFromStoreLegs(
  legs: Array<{
    eventId: string;
    marketType: string;
    side: string;
    selection?: string;
    price?: number;
    fairProb?: number;
    sport?: string;
    start?: string;
    home?: string;
    away?: string;
  }>,
): number {
  if (legs.length < 2) return Number.isFinite(legs[0]?.fairProb) ? (legs[0]!.fairProb as number) : 0.5;
  const sameGame = new Set(legs.map((l) => l.eventId)).size < legs.length;
  // Normalize legs to ScanRow-compatible shape for combineParlayFair
  const normLegs = legs.map((l) => ({
    eventId: l.eventId,
    marketType: (l.marketType as string) || "ml",
    side: l.side,
    fairProb: Number.isFinite(l.fairProb) ? (l.fairProb as number) : 0.5,
    sport: l.sport ?? "",
    isProp: false,
  }));
  const combinedFair = Math.min(0.97, combineParlayFair(normLegs as Parameters<typeof combineParlayFair>[0]));
  const decimalPayout = product(legs.map((l) => americanToDecimal(Number.isFinite(l.price) ? (l.price as number) : -110)));
  const cand: ParlayCandidate = {
    legs: legs.map((l) => ({
      eventId: l.eventId,
      sport: l.sport ?? "",
      selection: l.selection ?? "",
      marketType: (l.marketType as MarketType) || "ml",
      side: l.side,
      price: l.price ?? -110,
      fairProb: l.fairProb ?? 0.5,
      start: l.start ?? "",
      home: l.home ?? "",
      away: l.away ?? "",
    })),
    combinedFair,
    combinedEv: 0,
    pricedAsEntertainment: legs.length >= 4 || combinedFair < 0.25,
    researchOnly: false,
    sameGame,
    title: `${legs.length}-leg`,
    reason: "",
    score: 0,
    decimalPayout,
  };
  return shownParlayChance(cand);
}

function totalWithUnit(selection: string, sport: string, marketType?: string): string {
  if (marketType !== "total") return selection;
  if (/\b(runs?|points?|goals?)\b/i.test(selection)) return selection;
  const unit = sport === "MLB" ? " runs" : sport === "NHL" ? " goals" : " points";
  if (/^(over|under)\s/i.test(selection)) return `${selection}${unit}`;
  return selection;
}

function marketKey(p: DeskPick): string {
  if (p.row) {
    return [p.eventId, p.row.marketType, p.row.side, p.row.point ?? "", p.row.player ?? ""].join("|");
  }
  return p.id;
}

function rowKey(row: ScanRow): string {
  return [row.eventId, row.marketType, row.side, row.point ?? "", row.player ?? "", row.selection].join("|");
}

function legalRow(row: ScanRow): boolean {
  if (row.tag === "illegal_fl" || row.tag === "unknown_market") return false;
  if (row.scheduleOnly) return false;
  if ((row.isProp || row.marketType === "prop") && isCollegeSport(row.sport)) return false;
  return true;
}

/** Popular is ML / spread / total. Schedule-only still names a research main so the lane cannot go empty. */
function legalPopular(row: ScanRow): boolean {
  if (row.tag === "illegal_fl") return false;
  if (row.isProp || row.marketType === "prop") return false;
  if (!isMainMarket(row.marketType)) return false;
  if (isPeriodSel(row.selection, row.marketType)) return false;
  return true;
}

function isPeriodSel(sel: string, marketType?: string): boolean {
  if (marketType === "prop") return false;
  return /inning|quarter|1st half|2nd half|\bperiod\b|f5|first 5/i.test(sel);
}

function onHorizon(row: ScanRow, now = new Date()): boolean {
  if (row.inPlay) return true;
  if (!row.start) return false;
  if (isTodayEt(row.start, now)) return true;
  const t = new Date(row.start).getTime();
  if (!Number.isFinite(t)) return false;
  return t >= now.getTime() - 4 * 3600_000 && t <= now.getTime() + 36 * 3600_000;
}

function uniqueTodayGames(rows: ScanRow[]): ScanRow[] {
  const seen = new Set<string>();
  const out: ScanRow[] = [];
  for (const r of rows) {
    if (!onHorizon(r)) continue;
    if (seen.has(r.eventId)) continue;
    seen.add(r.eventId);
    out.push(r);
  }
  return out;
}

function briefAsResearch(brief?: EventBrief, row?: ScanRow): EventResearch | undefined {
  if (!brief && !row) return undefined;
  return {
    eventId: brief?.eventId ?? row?.eventId ?? "",
    sport: row?.sport ?? "",
    espnId: "",
    home: row?.home ?? "",
    away: row?.away ?? "",
    start: row?.start,
    venue: brief?.venue,
    weather: brief?.weather,
    weatherTemp: brief?.weatherTemp,
    weatherWind: brief?.weatherWind,
    weatherPrecip: brief?.weatherPrecip,
    homeRecord: brief?.homeRecord,
    awayRecord: brief?.awayRecord,
    espnHomeWin: brief?.espnHomeWin,
    espnAwayWin: brief?.espnAwayWin,
    bookHomeWin: brief?.bookHomeWin,
    openHomeWin: brief?.openHomeWin,
    kalshiHomeWin: brief?.kalshiHomeWin,
    polyHomeWin: brief?.polyHomeWin,
    homeEra: brief?.homeEra,
    awayEra: brief?.awayEra,
    homeWhip: brief?.homeWhip,
    awayWhip: brief?.awayWhip,
    homeOuts: brief?.homeOuts,
    awayOuts: brief?.awayOuts,
    homeQuestionable: brief?.homeQuestionable,
    awayQuestionable: brief?.awayQuestionable,
    homePf: brief?.homePf,
    homePa: brief?.homePa,
    awayPf: brief?.awayPf,
    awayPa: brief?.awayPa,
    homeSpread: brief?.homeSpread,
    total: brief?.total,
    series: brief?.series,
    seriesHomeWins: brief?.seriesHomeWins,
    seriesAwayWins: brief?.seriesAwayWins,
    homeRestDays: brief?.homeRestDays,
    awayRestDays: brief?.awayRestDays,
    pitchers: [],
    lastFive: [],
    injuries: [],
    headlines: [],
    players: (brief?.players ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      homeAway: p.homeAway,
      position: p.position,
      headshot: p.headshot,
      starter: p.starter,
      stats: p.stats ?? {},
      recentStats: p.recentStats,
      recentN: p.recentN,
      usageMin: p.usageMin,
    })),
    homeLooks: brief?.homeLooks,
    awayLooks: brief?.awayLooks,
    homePitcherHand: brief?.homePitcherHand,
    awayPitcherHand: brief?.awayPitcherHand,
    note: "",
  };
}

function expandSheet(scan: ScanBundle, snapshot: DeskSnapshot): ScanRow[] {
  const extra: ScanRow[] = [];
  for (const g of uniqueTodayGames(scan.rows)) {
    if (g.inPlay) continue;
    const gameRows = scan.rows.filter((r) => r.eventId === g.eventId);
    const brief = snapshot.briefs?.find((b) => b.eventId === g.eventId);
    const ml = gameRows.find((r) => r.marketType === "ml" && r.side === "home");
    const homeWin = ml?.fairProb ?? brief?.chanceHome ?? 0.5;
    const tabs = buildSheet({
      sport: g.sport,
      home: g.home,
      away: g.away,
      homeNick: teamNick(g.home),
      awayNick: teamNick(g.away),
      rows: gameRows,
      research: briefAsResearch(brief, g),
      homeWin: Number.isFinite(homeWin) ? homeWin : 0.5,
    });
    const markets = [
      ...tabs.popular,
      ...tabs.props,
      ...tabs.innings,
      ...tabs.half,
      ...tabs.quarters,
      ...tabs.halves,
      ...tabs.periods,
    ];
    for (const m of markets) extra.push(...cellsInMarket(m));
  }
  return stampGameTape(extra, scan.rows);
}

function mergeRows(posted: ScanRow[], sheet: ScanRow[]): ScanRow[] {
  const seen = new Set(posted.map(rowKey));
  const out = [...posted];
  for (const r of sheet) {
    const k = rowKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

function popularWhy(r: ScanRow): string {
  const tape = r.tapeNote ? ` ${r.tapeNote}` : "";
  if (r.inPlay) {
    if (r.leftover) {
      return `Live remaining-stat. Leftover mean from score + clock, not a haircut of the pre-game %. Photograph Hard Rock now. Last-10 still ran. Not The Call.${tape}`;
    }
    return `Live ticket. The public number is delayed — photograph Hard Rock now. Last-10 scores and the full ensemble still run; quality is haircut because a delayed live fill is not a prior. Not The Call.${tape}`;
  }
  const m =
    r.marketType === "ml"
      ? "Who wins the game — moneyline. Highest-info market on the board."
      : r.marketType === "spread"
        ? "Spread. The favorite must cover the number. NFL/college: 3 and 7 are the key numbers."
        : "Over/under on the combined score. Last-10 combined scoring nudges the mean. Weather and pace move this more than a moneyline.";
  return `${m} Ranked on chance-to-hit, payout, market quality, and edge vs the juice.${tape} Not a lock. Photograph Hard Rock to lock the live number.`;
}

function propWhy(r: ScanRow): string {
  return `${r.player ?? "This player"} — ${shortPick(r.selection, r.marketType)}. Last-10 games (when we have them) blended with season rate, today's total, script, park, weather, and who is listed out. College player bets are blocked in Florida. Photograph the live Hard Rock number — analysis, not a fill.`;
}

function periodWhy(r: ScanRow): string {
  return `${shortPick(r.selection, r.marketType)} is a slice of the game. Last-10 scores still feed the full-game ensemble, then this period is shrunk toward 50/50 because one inning/quarter is noisier than the whole game. Not The Call. Not a lock.`;
}

/** The Call must be a high-info ticket that still pays — not a noisy 0.5 inning. */
function heroEligible(p: DeskPick): boolean {
  if (p.parlay) return false;
  // Use isLiveDeskPick — checks inPlay flag, in_play tag, AND start time so
  // a game that has kicked off but not yet flipped the feed doesn't slip through.
  if (isLiveDeskPick(p)) return false;
  if (p.bucket === "period") return false;
  if (!(p.decimalPayout >= 1.55)) return false;
  if (p.chance < 0.5 || p.chance > 0.76) return false;
  if (p.infoQuality < 0.72) return false;
  if (p.processLooked !== false) return false;
  if (p.implied != null && Number.isFinite(p.implied) && p.chance < p.implied - 0.01 && (p.edge ?? 0) <= 0) {
    return false;
  }
  const sel = (p.selection || "").toLowerCase();
  if (/exact|correct score|first (basket|goal|td|score)|next (play|pitch|score)|teaser|future|championship|micro/.test(sel)) {
    return false;
  }
  return p.score > -90;
}

export function sortByMood(list: DeskPick[], mood: DeskMood): DeskPick[] {
  const copy = [...list];
  const tapeFirst = (a: DeskPick, b: DeskPick) => tapePriority(b) - tapePriority(a);
  if (mood === "safe") {
    return copy.sort((a, b) => tapeFirst(a, b) || b.chance - a.chance || b.score - a.score || a.id.localeCompare(b.id));
  }
  if (mood === "pay") {
    const trusted = copy.filter((p) => p.infoQuality >= 0.64 && p.chance >= 0.48 && tapePriority(p) > 0);
    const pool = trusted.length ? trusted : copy;
    return pool.sort((a, b) => tapeFirst(a, b) || b.decimalPayout - a.decimalPayout || b.chance - a.chance || a.id.localeCompare(b.id));
  }
  return copy.sort((a, b) => tapeFirst(a, b) || b.score - a.score || b.chance - a.chance || a.id.localeCompare(b.id));
}

/** 65% preferred. If nobody clears it, show the single highest-probability ticket so Safest is never empty. */
export function safestColumn(pool: DeskPick[], n = 3, floor = DEFAULT_SAFEST_FLOOR): DeskPick[] {
  const ranked = [...pool].sort((a, b) => b.chance - a.chance || b.score - a.score || a.id.localeCompare(b.id));
  const above = ranked.filter((p) => p.chance >= floor);
  if (above.length) {
    return above.slice(0, n).map((p) => ({ ...p, safestFallback: false }));
  }
  const top = ranked[0];
  if (!top) return [];
  return [{ ...top, safestFallback: true }];
}

export function belowSixty(p: DeskPick): boolean {
  return Number.isFinite(p.chance) && p.chance < 0.6;
}

export function highestTodayLabel(p: DeskPick): string {
  const pct = Math.round(p.chance * 100);
  return `Highest Probability Today (${pct}%)`;
}

/** Photographed / HR-FL mains outrank low-quality research so a 94% sheet alt cannot steal Safest. */
function tapePriority(p: DeskPick): number {
  const research = p.researchOnly || p.tapeStamp === "research";
  if (p.tapeStamp === "photographed") return 4;
  if (p.tapeStamp === "hr-fl") return 3;
  if (research && (p.infoQuality < 0.55 || p.confidence === "low")) return 0;
  if (research) return 1;
  return 2;
}

export function pickHero(singles: DeskPick[], popular: DeskPick[], mood: DeskMood = "value"): DeskPick | null {
  const pool = sortByMood(singles.filter(heroEligible), mood);
  return pool[0] ?? null;
}

/** Copy game-level wagers-vs-dollars onto sheet cells that have no market tape of their own. */
function stampGameTape(cells: ScanRow[], gameRows: ScanRow[]): ScanRow[] {
  const donor =
    gameRows.find((r) => r.ticketPct != null && r.marketType === "ml") ??
    gameRows.find((r) => r.ticketPct != null);
  if (!donor || donor.ticketPct == null) return cells;
  return cells.map((c) => {
    if (c.ticketPct != null) return c;
    return {
      ...c,
      ticketPct: donor.ticketPct,
      handlePct: donor.handlePct,
      tapeLean: donor.tapeLean,
      tapeNote: donor.tapeNote
        ? `Colleague tape on this game (wagers vs dollars), not this specific market. ${donor.tapeNote}`
        : "Colleague tape on this game (wagers vs dollars). Analyzed, not copied.",
      homeAbbr: c.homeAbbr ?? donor.homeAbbr,
      awayAbbr: c.awayAbbr ?? donor.awayAbbr,
      homeLogo: c.homeLogo ?? donor.homeLogo,
      awayLogo: c.awayLogo ?? donor.awayLogo,
      processLooked: c.processLooked ?? donor.processLooked,
      processSource: c.processSource ?? donor.processSource,
    };
  });
}

function rankRows(rows: ScanRow[], bucket: PickBucket, why: (r: ScanRow) => string, n: number): DeskPick[] {
  const allow = bucket === "popular" ? legalPopular : legalRow;
  const scored = rows
    .filter(allow)
    .filter((r) => onHorizon(r))
    .map((r) => fromRow(r, bucket, why(r)))
    .sort((a, b) => {
      if (bucket === "popular") {
        const d = tapePriority(b) - tapePriority(a);
        if (d) return d;
      }
      return b.score - a.score || b.chance - a.chance || a.id.localeCompare(b.id);
    });
  const picks =
    bucket === "popular"
      ? (() => {
          const pre = scored.filter((p) => !p.row?.inPlay);
          return pre.length ? pre : scored;
        })()
      : scored;
  const perEvent = bucket === "period" ? 1 : bucket === "popular" ? 3 : 2;
  const count = new Map<string, number>();
  const out: DeskPick[] = [];
  for (const p of picks) {
    const id = p.eventId ?? p.id;
    const used = count.get(id) ?? 0;
    if (used >= perEvent) continue;
    count.set(id, used + 1);
    out.push(p);
    if (out.length >= n) break;
  }
  if (bucket === "popular") {
    const byEvent = new Map<string, DeskPick[]>();
    for (const p of picks) {
      const id = p.eventId ?? p.id;
      const list = byEvent.get(id) ?? [];
      list.push(p);
      byEvent.set(id, list);
    }
    for (const [eventId, list] of byEvent) {
      const fav = [...list].filter((p) => p.chance >= 0.5).sort((a, b) => b.chance - a.chance || b.score - a.score)[0];
      if (!fav) continue;
      if (out.some((p) => p.id === fav.id)) continue;
      const have = out.filter((p) => (p.eventId ?? p.id) === eventId);
      if (have.length >= perEvent) {
        const worst = [...have].sort((a, b) => a.chance - b.chance)[0];
        const idx = worst ? out.findIndex((p) => p.id === worst.id) : -1;
        if (idx >= 0) out[idx] = fav;
      } else if (out.length < n) {
        out.push(fav);
      }
    }
  }
  return out.slice(0, n);
}

function mixSameGame(propRows: ScanRow[], popularRows: ScanRow[], _periodRows: ScanRow[]): DeskPick[] {
  const byEvent = new Map<string, ScanRow[]>();
  for (const r of [...popularRows, ...propRows]) {
    if (!legalRow(r) || r.inPlay) continue;
    const list = byEvent.get(r.eventId) ?? [];
    list.push(r);
    byEvent.set(r.eventId, list);
  }
  const out: DeskPick[] = [];
  for (const group of byEvent.values()) {
    const ml = group.find((r) => r.marketType === "ml");
    const tot = group.find((r) => r.marketType === "total");
    if (!ml || !tot) continue;
    const ev = evaluateParlay([ml, tot], undefined, "catalog");
    if ("ok" in ev && ev.ok === false) continue;
    out.push(fromParlay(ev as ParlayCandidate, "sgp"));
  }
  return out;
}

export function pickFromScanRow(row: ScanRow): DeskPick {
  const bucket: PickBucket =
    row.isProp || row.marketType === "prop" ? "prop" : isPeriodSel(row.selection, row.marketType) ? "period" : "popular";
  const why = bucket === "prop" ? propWhy(row) : bucket === "period" ? periodWhy(row) : popularWhy(row);
  return fromRow(row, bucket, why);
}

export function candidateToPicks(p: ParlayCandidate, rows: ScanRow[]): ParlayPick[] {
  return p.legs.map((leg) => {
    const row = matchLegRow(rows, leg);
    return row
      ? rowToPick(row)
      : {
          key: `${leg.eventId}:${leg.marketType}:${leg.side}`,
          eventId: leg.eventId,
          sport: leg.sport,
          start: leg.start,
          home: leg.home,
          away: leg.away,
          marketType: leg.marketType,
          side: leg.side,
          selection: leg.selection,
          price: leg.price,
          fairProb: leg.fairProb,
        };
  });
}

function syntheticRow(leg: {
  eventId: string;
  marketType: string;
  side: string;
  selection: string;
  price?: number;
  fairProb?: number;
  sport?: string;
  start?: string;
  home?: string;
  away?: string;
}): ScanRow {
  return {
    eventId: leg.eventId || `unknown-${leg.selection}`,
    sport: leg.sport || "",
    start: leg.start || "",
    home: leg.home || "",
    away: leg.away || "",
    marketType: (leg.marketType as MarketType) || "ml",
    side: leg.side,
    selection: leg.selection,
    price: Number.isFinite(leg.price) ? (leg.price as number) : -110,
    fairProb: Number.isFinite(leg.fairProb) ? (leg.fairProb as number) : 0.5,
    evPct: 0,
    hold: 0,
    tag: "unknown_market",
    action: "stand_down",
    reason: "This leg could not be priced on the delayed board.",
    conviction: "low",
    spark: "",
  };
}

function fallbackParlay(rows: ScanRow[], reason: string): ParlayCandidate {
  const sameGame = new Set(rows.map((r) => r.eventId)).size < rows.length;
  const combinedFair = Math.min(0.97, combineParlayFair(rows));
  const decimalPayout = product(rows.map((l) => americanToDecimal(l.price)));
  const sports = [...new Set(rows.map((l) => l.sport))];
  const corr = correlationOf(rows, sameGame);
  const mapped: ParlayLeg[] = rows.map((l) => ({
    eventId: l.eventId,
    sport: l.sport,
    selection: l.selection,
    marketType: l.marketType,
    side: l.side,
    price: l.price,
    fairProb: l.fairProb,
    start: l.start,
    home: l.home,
    away: l.away,
  }));
  return {
    legs: mapped,
    combinedFair,
    combinedEv: combinedFair * (decimalPayout > 1 ? decimalPayout : 1) - 1,
    pricedAsEntertainment: rows.length >= 4 || combinedFair < 0.25,
    researchOnly: rows.some((l) => l.hardRockPrice == null),
    sameGame,
    title: `${rows.length}-game${sameGame ? " same-game" : ""} parlay`,
    reason: `${reason} Combined chance ≈ ${formatChancePct(calibratedChance(combinedFair, decimalPayout > 1 ? 1 / decimalPayout : undefined, parlayInfoQuality(rows.length, sameGame))) ?? "—"}. Combined is closed form. Quality capped at 0.64. No fake sim %.`,
    score: parlayScore(combinedFair, decimalPayout > 1 ? decimalPayout : 1.01),
    mix: sameGame ? "same-game" : sports.length > 1 ? "cross-sport" : "same-sport",
    decimalPayout,
    sports,
    correlation: corr,
  };
}

export function deskPickFromLegRefs(
  refs: Array<{
    eventId: string;
    marketType: string;
    side: string;
    selection: string;
    price?: number;
    fairProb?: number;
    sport?: string;
    start?: string;
    home?: string;
    away?: string;
  }>,
  scan: ScanBundle,
): DeskPick {
  const stood: string[] = [];
  const rows: ScanRow[] = refs.map((leg) => {
    const hit = matchLegRow(scan.rows, leg);
    if (!hit) {
      stood.push(leg.selection || `${leg.marketType} ${leg.side}`);
      return syntheticRow(leg);
    }
    if (hit.tag === "unknown_market" || hit.tag === "illegal_fl") stood.push(hit.selection);
    return hit;
  });
  if (rows.length === 1) return pickFromScanRow(rows[0]!);
  const n = rows.length;
  const sameGame = new Set(rows.map((r) => r.eventId)).size < n;
  const bucket: PickBucket = n >= 4 ? "parlay4" : n === 3 ? "parlay3" : sameGame ? "sgp" : "parlay2";
  const ev = evaluateParlay(rows, undefined, "catalog");
  const cand: ParlayCandidate = "ok" in ev && ev.ok === false ? fallbackParlay(rows, ev.reason) : (ev as ParlayCandidate);
  const pick = fromParlay(cand, bucket);
  const closed = rows.some(
    (r) =>
      !r.isProp &&
      (r.marketType === "ml" || r.marketType === "spread" || r.marketType === "total") &&
      r.simFair == null,
  );
  const usedSim = cand.correlation === "shared-latent";
  const live = rows.some((r) => r.inPlay || r.tag === "in_play");
  if (closed || (cand.sameGame && !usedSim) || stood.length || live) {
    pick.infoQuality = Math.min(pick.infoQuality, 0.64);
    pick.confidence = qualityBand(pick.infoQuality);
  }
  if (live) {
    pick.why = `${pick.why} Live leg on the slip — combined quality haircut. Never The Call. Never the gold ribbon.`;
  }
  if (stood.length) {
    pick.why = `${pick.why} Stood down: ${stood.join("; ")}. Still opened the slip.`;
  }
  return pick;
}

export function correlationFlag(corr?: ParlayCandidate["correlation"], sameGame?: boolean): string {
  if (corr === "shared-latent") return "joint-path · shared-latent";
  if (corr === "fallback-haircut") return "Thin fallback-haircut";
  if (sameGame) return "Same-game";
  return "near-independent";
}

export function ribbonSitWhy(p: DeskPick, rows?: ScanRow[]): string {
  const parlay = p.parlay;
  if (!parlay) return "A parlay cannot be The Call. Ribbon parlays live on Parlay as the high-hit badge.";
  const n = parlay.legs.length;
  if (n !== 2 && n !== 3) {
    return `Not on the gold ribbon. Ribbon is 2- or 3-leg mains. ${n}-leg is Catalog / fun money.`;
  }
  const live = parlay.legs.some((l) => matchLegRow(rows ?? [], l)?.inPlay);
  if (live) {
    return "Not on the gold ribbon — live legs cannot load onto the ribbon. Combined quality is haircut. Never The Call.";
  }
  if (parlay.legs.some((l) => isCollegeSport(l.sport) && l.marketType === "prop")) {
    return "College player legs cannot load. Florida compact blocks them. Stood that leg down.";
  }
  if (parlay.legs.some((l) => l.marketType === "prop")) {
    return "Not on the gold ribbon — player props are custom builder, never the gold badge.";
  }
  if (parlay.sameGame) {
    return "Not on the gold ribbon — same-game lives as SGP catalog, not the gold badge. Joint-path or Thin fallback-haircut still prints on the ticket.";
  }
  if (parlay.legs.some((l) => /1st inning|first inning/i.test(l.selection) && /0\.5/.test(l.selection))) {
    return "Not on the gold ribbon — a period 0.5 cannot be a ribbon leg.";
  }
  if (!ribbonEligible(p)) {
    return "Not on the gold ribbon — a leg missed the 56%/60% displayed floor, the combined floor, payout 1.45, or quality 0.72.";
  }
  return "On the gold ribbon: 2- or 3-leg mains, floors cleared, no live, no college player, no period 0.5.";
}

export function buildDeskPicks(scan: ScanBundle, snapshot: DeskSnapshot): DeskPicks {
  const posted = scan.rows.filter((r) => onHorizon(r));
  const sheet = expandSheet(scan, snapshot);
  const merged = mergeRows(posted, sheet);

  const popularRows = merged.filter(legalPopular);
  const propRows = merged.filter((r) => r.isProp || r.marketType === "prop");
  const periodRows = merged.filter((r) => isPeriodSel(r.selection, r.marketType) && r.marketType !== "prop" && !r.isProp);

  const popular = rankRows(popularRows, "popular", popularWhy, 24);
  const props = rankRows(propRows, "prop", propWhy, 8);
  const periods = rankRows(periodRows, "period", periodWhy, 6);

  const sgpGame = (scan.topSgp ?? []).slice(0, 4).map((p) => fromParlay(p, "sgp"));
  const sgpMixed = mixSameGame(propRows, popularRows, periodRows);
  const sgp = rankPicks([...sgpGame, ...sgpMixed], 6);
  const two = (scan.topTwos ?? []).slice(0, 6).map((p) => fromParlay(p, p.sameGame ? "sgp" : "parlay2"));
  const three = (scan.topThrees ?? []).slice(0, 6).map((p) => fromParlay(p, "parlay3"));
  const four = (scan.topFours ?? []).slice(0, 4).map((p) => fromParlay(p, "parlay4"));
  const ribbon = buildRibbon([...two, ...three]);

  const singles = [...popular, ...props, ...periods];
  const hero = pickHero(singles, popular, "value");

  const dropHero = (list: DeskPick[]) => (hero ? list.filter((p) => p.id !== hero.id) : list);

  const stamp = (p: DeskPick) => stampEarlyMover(p, snapshot);
  const all = [hero, ...singles, ...ribbon, ...sgp, ...two, ...three, ...four]
    .filter((p): p is DeskPick => Boolean(p))
    .map(stamp);

  return {
    hero: hero ? stamp(hero) : null,
    popular: dropHero(popular).map(stamp),
    props: dropHero(props).map(stamp),
    periods: dropHero(periods).map(stamp),
    sgp: sgp.map(stamp),
    two: two.map(stamp),
    three: three.map(stamp),
    four: four.map(stamp),
    ribbon: ribbon.map(stamp),
    all,
  };
}

function stampEarlyMover(p: DeskPick, snapshot: DeskSnapshot): DeskPick {
  if (p.row?.marketType !== "ml") return p.earlyMover ? { ...p, earlyMover: false } : p;
  const brief = snapshot.briefs?.find((b) => b.eventId === p.eventId);
  const predict = brief?.kalshiHomeWin ?? brief?.polyHomeWin;
  const sidePredict = predict == null ? undefined : p.row.side === "away" ? 1 - predict : predict;
  const flag = earlyMover(p.implied, sidePredict);
  return flag === p.earlyMover ? p : { ...p, earlyMover: flag };
}

/** Same-game ids look in SGP first so joint-path combinedFair wins over a 2-leg duplicate. */
function catalogParlays(scan: ScanBundle, id: string): ParlayCandidate[] {
  const twos = scan.topTwos ?? [];
  const threes = scan.topThrees ?? [];
  const fours = scan.topFours ?? [];
  const sgp = scan.topSgp ?? [];
  const refs = parseParlayTicketId(id);
  const sameGame = Boolean(refs && new Set(refs.map((r) => r.eventId)).size < refs.length);
  return sameGame ? [...sgp, ...twos, ...threes, ...fours] : [...twos, ...threes, ...fours, ...sgp];
}

export function lookupPick(id: string, scan: ScanBundle, snapshot: DeskSnapshot): DeskPick | null {
  if (!id) return null;
  const decoded = decodeTicketId(id);

  const fromRowId = (raw: string): DeskPick | null => {
    if (!raw.startsWith("r|") && !raw.startsWith("r%7C") && !raw.startsWith("r%7c")) return null;
    const bits = decodeTicketId(raw).split("|");
    let i = 1;
    let bucket: PickBucket = "popular";
    if (BUCKETS.includes(bits[1] as PickBucket)) {
      bucket = bits[1] as PickBucket;
      i = 2;
    }
    const eventId = bits[i];
    const marketType = bits[i + 1];
    const side = bits[i + 2];
    const selection = bits.slice(i + 5).join("|");
    const row =
      scan.rows.find(
        (r) =>
          r.eventId === eventId && r.marketType === marketType && r.side === side && r.selection === selection,
      ) ??
      scan.rows.find((r) => r.eventId === eventId && r.marketType === marketType && r.side === side);
    if (!row) return null;
    const why = bucket === "prop" ? propWhy(row) : bucket === "period" ? periodWhy(row) : popularWhy(row);
    return fromRow(row, bucket === "sgp" ? "popular" : bucket, why);
  };

  const rowHit = fromRowId(decoded) ?? fromRowId(id);
  if (rowHit) return rowHit;

  const lists = catalogParlays(scan, decoded);
  const named = lists.find((p) => parlayTicketId(p) === decoded || parlayTicketId(p) === id);
  if (named) {
    const n = named.legs.length;
    return fromParlay(named, n >= 4 ? "parlay4" : n === 3 ? "parlay3" : named.sameGame ? "sgp" : "parlay2");
  }
  const refs = parseParlayTicketId(decoded) ?? parseParlayTicketId(id);
  if (refs && refs.length >= 2) {
    const byLegs = lists.find((p) => sameLegSet(p.legs, refs));
    if (byLegs) {
      const n = byLegs.legs.length;
      return fromParlay(byLegs, n >= 4 ? "parlay4" : n === 3 ? "parlay3" : byLegs.sameGame ? "sgp" : "parlay2");
    }
    return deskPickFromLegRefs(refs, scan);
  }

  const bag = buildDeskPicks(scan, snapshot);
  return bag.all.find((p) => p.id === decoded || p.id === id) ?? null;
}

export function pickMatchup(p: DeskPick): string {
  if (p.away && p.home) return matchupLine(p.away, p.home);
  if (p.parlay) {
    return p.parlay.legs.map((l) => `${l.away} at ${l.home}`).join(" · ");
  }
  return p.sport || "Ticket";
}

export function payoutMultipleOf(p: DeskPick): number {
  return p.decimalPayout > 1 ? p.decimalPayout - 1 : payoutMultiple(p.price ?? 0);
}

export function pickInSport(p: DeskPick, sport: string | undefined): boolean {
  if (!sport || sport === "ALL") return true;
  if (p.parlay?.sports?.includes(sport)) return true;
  return p.sport === sport;
}

/** Same board in → same string out. No clock, no random. */
export function picksFingerprint(bag: DeskPicks): string {
  return bag.all
    .map((p) => `${p.id}|${p.chance.toFixed(6)}|${p.score.toFixed(6)}|${p.bucket}`)
    .join("\n");
}

function rankPicks(list: DeskPick[], n: number): DeskPick[] {
  const seen = new Set<string>();
  const out: DeskPick[] = [];
  for (const p of [...list].sort((a, b) => b.score - a.score || b.chance - a.chance || a.id.localeCompare(b.id))) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
    if (out.length >= n) break;
  }
  return out;
}

function ribbonEligible(p: DeskPick): boolean {
  const parlay = p.parlay;
  if (!parlay) return false;
  const n = parlay.legs.length;
  if (n !== 2 && n !== 3) return false;
  if (p.row?.inPlay) return false;
  if (p.score <= -90) return false;
  if (p.decimalPayout < 1.45) return false;
  const floor = n === 2 ? 0.56 : 0.6;
  const combinedFloor = n === 2 ? 0.38 : 0.28;
  if (p.chance < combinedFloor) return false;
  for (const l of parlay.legs) {
    if (l.marketType === "prop") return false;
    const q = infoQuality({ bucket: "popular", selection: l.selection, marketType: l.marketType });
    if (q < 0.72) return false;
    const implied = Number.isFinite(l.price) ? americanToImplied(l.price) : undefined;
    const shown = calibratedChance(l.fairProb, implied, q);
    if (shown < floor) return false;
  }
  return true;
}

/** High-hit 2/3-leg mains. Always sorted Safest. Cap 1 slip per event. */
export function buildRibbon(list: DeskPick[]): DeskPick[] {
  const ok = list.filter(ribbonEligible).sort(
    (a, b) =>
      (b.parlay?.combinedFair ?? 0) - (a.parlay?.combinedFair ?? 0) ||
      b.score - a.score ||
      a.id.localeCompare(b.id),
  );
  const seen = new Set<string>();
  const out: DeskPick[] = [];
  for (const p of ok) {
    const events = p.parlay?.legs.map((l) => l.eventId) ?? [];
    if (events.some((id) => seen.has(id))) continue;
    for (const id of events) seen.add(id);
    out.push(p);
    if (out.length >= 6) break;
  }
  return out;
}
