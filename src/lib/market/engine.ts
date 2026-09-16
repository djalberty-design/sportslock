import { floorToCent, isTodayEt } from "../utils.ts";
import {
  DEFAULTS,
  isCollegeSport,
  isMainMarket,
  isPlayCore,
} from "./universe.ts";
import type {
  DeskSnapshot,
  ParlayCandidate,
  ParlayLeg,
  QuoteLine,
  ScanBundle,
  ScanRow,
  ScanTag,
} from "./types.ts";
import { deskScore, parlayScore, stampRows } from "./tape.ts";
import { correlationOf, sgpHaircut, typicalParlayJuice } from "./parlays.ts";
import { growthScore, jointFromLegs, sameGameRho } from "./copula.ts";
import { combineParlayFair } from "./joint-grade.ts";
import { drawPaths, latentFromScores, simCover, simOver, simWin } from "./sim.ts";
import { leftoverOverProb } from "./live-state.ts";
import { buildLatents } from "./latents.ts";
import { buildUsage, usageOf } from "./usage.ts";
import { isKnownMarket, unknownMarketReason } from "./registry.ts";
import { processFromLooks } from "./looks.ts";
import { parlayInfoQuality, shownCombinedChance } from "./calibrate.ts";
import { formatChancePct } from "../copy.ts";
import { DEFAULT_COMBO_LEG_CAP, type RankSettings } from "../desk-settings.ts";

export const COMBO_SEED_CAP = DEFAULT_COMBO_LEG_CAP;

let activeKelly = 1;
let activeComboCap = COMBO_SEED_CAP;

export function americanToImplied(odds: number): number {
  if (!Number.isFinite(odds)) return NaN;
  if (odds >= 0) return 100 / (odds + 100);
  const a = Math.abs(odds);
  return a / (a + 100);
}

export function americanToDecimal(odds: number): number {
  if (!Number.isFinite(odds)) return NaN;
  if (odds >= 0) return odds / 100 + 1;
  return 100 / Math.abs(odds) + 1;
}

export function decimalToAmerican(dec: number): number {
  if (!Number.isFinite(dec) || dec <= 1) return 0;
  if (dec >= 2) return Math.round((dec - 1) * 100);
  return Math.round(-100 / (dec - 1));
}

export function twoWayNoVig(oddsHome: number, oddsAway: number) {
  const pHome = americanToImplied(oddsHome);
  const pAway = americanToImplied(oddsAway);
  const sum = pHome + pAway;
  
  if (!Number.isFinite(sum) || sum <= 0 || pHome >= 1 || pAway >= 1) {
    return { fairHome: NaN, fairAway: NaN, hold: NaN };
  }
  if (sum === 1) return { fairHome: pHome, fairAway: pAway, hold: 0 };

  let low = 0.5;
  let high = 2.0;
  let k = 1.0;
  for (let i = 0; i < 15; i++) {
    k = (low + high) / 2;
    const diff = Math.pow(pHome, k) + Math.pow(pAway, k) - 1;
    if (diff > 0) low = k;
    else high = k;
  }

  return {
    fairHome: Math.pow(pHome, k),
    fairAway: Math.pow(pAway, k),
    hold: sum - 1,
  };
}

export function evPct(bookOdds: number, fairProb: number): number {
  if (!Number.isFinite(bookOdds) || !Number.isFinite(fairProb)) return NaN;
  return americanToDecimal(bookOdds) * fairProb - 1;
}

export function unitDollars(bankroll: number, unitPct: number): number {
  return floorToCent(bankroll * unitPct);
}

export function coreFunSplit(bankroll: number): {
  core: number;
  fun: number;
  coreTicket: number;
  funTicket: number;
} {
  const b = Number.isFinite(bankroll) && bankroll > 0 ? bankroll : 0;
  const core = floorToCent(b * 0.85);
  const fun = floorToCent(b * 0.15);
  const coreTicket = floorToCent(core * 0.01);
  const funTicket = Math.min(3, Math.max(fun > 0 ? 1 : 0, Math.min(3, fun)));
  return { core, fun, coreTicket, funTicket: floorToCent(funTicket) };
}

export function sizeLabel(bankroll: number): "seed" | "tiny" | "small" | "working" | "full" {
  if (bankroll < DEFAULTS.seedLt) return "seed";
  if (bankroll < DEFAULTS.tinyLt) return "tiny";
  if (bankroll < 500) return "small";
  if (bankroll < 2_000) return "working";
  return "full";
}

export function isSeed(bankroll: number): boolean {
  return bankroll < DEFAULTS.seedLt;
}

export function isTiny(bankroll: number): boolean {
  return bankroll < DEFAULTS.tinyLt;
}

export function product(nums: number[]): number {
  return nums.reduce((a, b) => a * b, 1);
}

export type OppositePair = { a: QuoteLine; b: QuoteLine };

export function pairTwoWays(quotes: QuoteLine[]): OppositePair[] {
  const pairs: OppositePair[] = [];
  const used = new Set<QuoteLine>();
  for (const a of quotes) {
    if (used.has(a) || a.isProp) continue;
    const b = quotes.find(
      (q) =>
        q !== a &&
        !used.has(q) &&
        q.eventId === a.eventId &&
        q.marketType === a.marketType &&
        q.side !== a.side,
    );
    if (b) {
      pairs.push({ a, b });
      used.add(a);
      used.add(b);
    }
  }
  return pairs;
}

function tagFor(ev: number, hold: number, row: Omit<ScanRow, "tag" | "action" | "reason" | "conviction" | "spark">): ScanTag {
  if (row.venueNote === "dk_sportsbook" || row.venueNote === "fd_sportsbook") return "illegal_fl";
  if (row.isProp && isCollegeSport(row.sport)) return "illegal_fl";
  if (row.isProp && !isKnownMarket(row.selection, row.marketType)) return "unknown_market";
  if (row.inPlay) return "in_play";
  if (Number.isFinite(ev) && ev >= 0 && row.hardRockPrice != null) return "fair_or_better";
  if (Number.isFinite(ev) && ev >= DEFAULTS.closeEnoughEv && ev < 0 && isMainMarket(row.marketType) && (isPlayCore(row.sport) || isCollegeSport(row.sport))) {
    return "close_enough";
  }
  if (Number.isFinite(ev) && ev < DEFAULTS.closeEnoughEv) return "juiced";
  if (Number.isFinite(hold) && hold >= 0.04 && (!Number.isFinite(ev) || ev < 0)) return "juiced";
  return "juiced";
}

function tapeStampOf(line: { source?: string; hardRockPrice?: number; venueNote?: string; confirmed?: boolean }): ScanRow["tapeStamp"] {
  if (line.source === "screenshot" || line.confirmed) return "photographed";
  if (line.hardRockPrice != null || line.source === "hardrock_fl" || line.venueNote === "hardrock") return "hr-fl";
  return "research";
}

export function scoreQuotes(snapshot: DeskSnapshot): ScanRow[] {
  const rows: ScanRow[] = [];
  const pairs = pairTwoWays(snapshot.quotes);
  const paired = new Set<QuoteLine>();
  for (const { a, b } of pairs) {
    paired.add(a);
    paired.add(b);
    const consA = a.consensusPrice ?? a.price;
    const consB = b.consensusPrice ?? b.price;
    const { fairHome: fairA, fairAway: fairB, hold } = twoWayNoVig(consA, consB);
    for (const [line, fair] of [
      [a, fairA],
      [b, fairB],
    ] as const) {
      const book = line.hardRockPrice ?? (line.source === "hardrock_fl" ? line.price : undefined);
      const price = book ?? line.price;
      const ev = Number.isFinite(fair) ? evPct(price, fair) : NaN;
      // inPlay is strictly from the API feed — no Date.now() fallback.
      // A clock inference would corrupt The Call with stale pre-game picks.
      const inPlay = Boolean(line.inPlay);
      // Completed games (phase = "post" | "final") are dropped from the active board.
      if (line.phase === "post" || line.phase === "final") continue;
      const base = {
        eventId: line.eventId,
        sport: line.sport,
        start: line.start,
        home: line.home,
        away: line.away,
        marketType: line.marketType,
        side: line.side,
        selection: line.selection,
        price,
        fairProb: fair,
        evPct: ev,
        hold,
        hardRockPrice: book,
        consensusPrice: line.consensusPrice ?? line.price,
        point: line.point,
        inPlay,
        isProp: Boolean(line.isProp),
        player: line.player,
        venueNote: line.venueNote,
        homeRecord: line.homeRecord,
        awayRecord: line.awayRecord,
        homePitcher: line.homePitcher,
        awayPitcher: line.awayPitcher,
        homeAbbr: line.homeAbbr,
        awayAbbr: line.awayAbbr,
        homeLogo: line.homeLogo,
        awayLogo: line.awayLogo,
        homeSpread: line.homeSpread,
        total: line.total,
        openPrice: line.openPrice,
        scheduleOnly: line.scheduleOnly,
        phase: line.phase,
        source: line.source,
        tapeStamp: tapeStampOf(line),
        homeScore: line.homeScore,
        awayScore: line.awayScore,
        clock: line.clock,
        period: line.period,
        situation: line.situation,
      };
      const tag = tagFor(ev, hold, base);
      const stand =
        tag === "illegal_fl" ||
        tag === "in_play" ||
        tag === "juiced" ||
        tag === "unknown_market" ||
        !Number.isFinite(ev) ||
        Boolean(line.scheduleOnly);
      rows.push({
        ...base,
        tag: line.scheduleOnly ? "juiced" : tag,
        action: stand ? "stand_down" : "enter_ticket",
        reason:
          line.scheduleOnly
            ? "This matchup is on the calendar. ESPN has not posted a two-way price yet — photograph Hard Rock when the number drops."
            : tag === "illegal_fl"
            ? line.isProp && isCollegeSport(line.sport)
              ? "College player bets are not allowed on Hard Rock Bet."
              : "DraftKings / FanDuel sportsbook bets are not legal Florida live plays."
            : tag === "unknown_market"
              ? unknownMarketReason(line.selection)
            : tag === "in_play"
              ? "The game already started — Live desk only. Never The Call. Photograph Hard Rock now."
              : tag === "fair_or_better"
                ? "Hard Rock price is fair or better versus the true two-way odds."
                : tag === "close_enough"
                  ? "Close to a fair price. Fine as fun money — not the recommended pick."
                  : "The sportsbook's cut makes this overpriced. Don't bet it.",
        conviction: tag === "fair_or_better" ? "medium" : "low",
        spark: Number.isFinite(ev) ? `${(ev * 100).toFixed(1)}% edge` : "n/a",
      });
    }
  }

  for (const line of snapshot.quotes) {
    if (paired.has(line)) continue;
    // inPlay strictly from API feed; completed games dropped. (BIBLE live-board rules)
    if (line.phase === "post" || line.phase === "final") continue;
    const inPlay = Boolean(line.inPlay);
    const book = line.hardRockPrice ?? (line.source === "hardrock_fl" ? line.price : undefined);
    const price = book ?? line.price;
    const implied = americanToImplied(price);
    const base = {
      eventId: line.eventId,
      sport: line.sport,
      start: line.start,
      home: line.home,
      away: line.away,
      marketType: line.marketType,
      side: line.side,
      selection: line.selection,
      price,
      fairProb: implied,
      evPct: NaN,
      hold: NaN,
      hardRockPrice: book,
      consensusPrice: line.consensusPrice,
      point: line.point,
      inPlay,
      isProp: Boolean(line.isProp),
      player: line.player,
      venueNote: line.venueNote,
      homeRecord: line.homeRecord,
      awayRecord: line.awayRecord,
      homePitcher: line.homePitcher,
      awayPitcher: line.awayPitcher,
      homeAbbr: line.homeAbbr,
      awayAbbr: line.awayAbbr,
      homeLogo: line.homeLogo,
      awayLogo: line.awayLogo,
      homeSpread: line.homeSpread,
      total: line.total,
      openPrice: line.openPrice,
      scheduleOnly: line.scheduleOnly,
      phase: line.phase,
      source: line.source,
      tapeStamp: tapeStampOf(line),
      homeScore: line.homeScore,
      awayScore: line.awayScore,
      clock: line.clock,
      period: line.period,
      situation: line.situation,
    };
    const tag = tagFor(NaN, NaN, {
      ...base,
      isProp: base.isProp,
      inPlay: base.inPlay,
      venueNote: base.venueNote,
      sport: base.sport,
      marketType: base.marketType,
      hardRockPrice: base.hardRockPrice,
    });
    const unknown = Boolean(line.isProp) && !isKnownMarket(line.selection, line.marketType);
    const college = Boolean(line.isProp) && isCollegeSport(line.sport);
    const finalTag = college
      ? "illegal_fl"
      : unknown
        ? "unknown_market"
        : tag === "illegal_fl"
          ? "illegal_fl"
          : inPlay
            ? "in_play"
            : "juiced";
    rows.push({
      ...base,
      tag: finalTag,
      action: "stand_down",
      reason:
        college
          ? "College player bets are not allowed on Hard Rock Bet."
          : unknown
            ? unknownMarketReason(line.selection)
            : "Only one side of the market is listed — we cannot call this a fair price.",
      conviction: "low",
      spark: "missing two-way",
    });
  }
  return rows;
}

export function payoutMultiple(price: number): number {
  if (!Number.isFinite(price) || price === 0) return 0;
  return price >= 0 ? price / 100 : 100 / Math.abs(price);
}

export function valueScore(chance: number, price: number): number {
  if (!Number.isFinite(chance) || chance <= 0 || !Number.isFinite(price)) return -99;
  const pay = payoutMultiple(price);
  if (pay <= 0) return -99;
  const ev = chance * (1 + pay) - 1;
  const blend = chance * chance * Math.sqrt(pay);
  if (pay < 0.65) return blend * 0.35 + ev * 0.15;
  return blend * 0.55 + Math.max(ev, -0.08) * 0.45 + chance * 0.12;
}

function legalMains(rows: ScanRow[], todayOnly: boolean): ScanRow[] {
  return rows.filter(
    (r) =>
      r.tag !== "illegal_fl" &&
      r.tag !== "unknown_market" &&
      r.tag !== "in_play" &&
      !r.inPlay &&
      isMainMarket(r.marketType) &&
      !r.isProp &&
      !r.scheduleOnly &&
      (isPlayCore(r.sport) || isCollegeSport(r.sport)) &&
      (!todayOnly || isTodayEt(r.start)),
  );
}

function byValue(a: ScanRow, b: ScanRow): number {
  const vb = deskScore(b.fairProb, b.price, b.tapeLean);
  const va = deskScore(a.fairProb, a.price, a.tapeLean);
  if (Math.abs(vb - va) > 0.002) return vb - va;
  return (Number.isFinite(b.fairProb) ? b.fairProb : 0) - (Number.isFinite(a.fairProb) ? a.fairProb : 0);
}

export function pickBestMain(rows: ScanRow[]): ScanRow | null {
  const pool = legalMains(rows, true);
  if (!pool.length) return null;
  const pays = pool.filter((r) => payoutMultiple(r.price) >= 0.65 && Number.isFinite(r.fairProb));
  const easy = pays.filter((r) => r.fairProb >= 0.5);
  const likely = pays.filter((r) => r.fairProb >= 0.45);
  const ranked = easy.length ? easy : likely.length ? likely : pays.length ? pays : pool;
  return [...ranked].sort(byValue)[0] ?? null;
}

export function pickAnyMain(rows: ScanRow[]): ScanRow | null {
  const best = pickBestMain(rows);
  if (best) return best;
  const pool = legalMains(rows, true);
  if (!pool.length) return null;
  return [...pool].sort(byValue)[0] ?? null;
}

export function pickCoinFlip(rows: ScanRow[], excludeEventIds: string[] = []): ScanRow | null {
  const legal = rows.filter(
    (r) =>
      !r.inPlay &&
      r.tag !== "in_play" &&
      r.tag !== "illegal_fl" &&
      r.tag !== "unknown_market" &&
      isMainMarket(r.marketType) &&
      !r.isProp &&
      !r.scheduleOnly &&
      onDeskHorizon(r.start) &&
      !excludeEventIds.includes(r.eventId) &&
      Number.isFinite(r.fairProb),
  );
  const plus = legal.filter((r) => r.price >= 100);
  const tight = plus.filter((r) => Math.abs(r.fairProb - 0.5) <= 0.05);
  const mid = plus.filter((r) => Math.abs(r.fairProb - 0.5) <= 0.08);
  const loose = plus.filter((r) => Math.abs(r.fairProb - 0.5) <= 0.12);
  const pool = tight.length ? tight : mid.length ? mid : loose.length ? loose : plus.length ? plus : legal;
  const ranked = [...(pool.length ? pool : legal)].sort((a, b) => {
    const pay = (r: ScanRow) => (r.price >= 0 ? r.price : 0);
    return pay(b) - pay(a) || Math.abs(a.fairProb - 0.5) - Math.abs(b.fairProb - 0.5);
  });
  return ranked[0] ?? null;
}

export type ParlayMode = "ribbon" | "catalog";

function parlayLegal(legs: ScanRow[], mode: ParlayMode = "ribbon"): { ok: true } | { ok: false; reason: string } {
  if (legs.some((l) => l.inPlay || l.tag === "in_play")) {
    return { ok: false, reason: "Before the game only. No in-progress legs." };
  }
  const max = mode === "catalog" ? 8 : 3;
  if (legs.length < 2 || legs.length > max) {
    return {
      ok: false,
      reason:
        mode === "catalog"
          ? "2 to 8 legs on the Parlay desk. 4+ is catalog / fun money, never the gold badge."
          : "2 or 3 games only on the AI Picks badge. 4-game tickets live on Parlay.",
    };
  }
  if (mode === "ribbon" && legs.length > 3) {
    return { ok: false, reason: "4-game parlays are not the AI Picks badge. Open Parlay." };
  }
  for (const l of legs) {
    if (l.tag === "illegal_fl") return { ok: false, reason: "Not a legal Florida ticket." };
    if (l.tag === "unknown_market") return { ok: false, reason: unknownMarketReason(l.selection) };
    if (l.isProp || l.marketType === "prop") {
      if (mode === "ribbon" || isCollegeSport(l.sport)) {
        return {
          ok: false,
          reason: isCollegeSport(l.sport)
            ? "No college player bets ever."
            : "Player bets are not on the AI Picks badge parlay. They rank on AI Picks as singles and on Parlay as custom legs.",
        };
      }
    } else if (mode === "ribbon" && !isMainMarket(l.marketType)) {
      return { ok: false, reason: "Game bets only (winner / spread / over-under / team total / F5)." };
    }
  }
  const games = new Set(legs.map((l) => l.eventId));
  if (mode === "ribbon" && games.size < legs.length) {
    return { ok: false, reason: "Ribbon is one ticket per game. Same-game lives as SGP catalog, not the gold badge." };
  }
  const floor =
    mode === "catalog"
      ? legs.length === 2
        ? DEFAULTS.catalogMinLeg2
        : legs.length === 3
          ? DEFAULTS.catalogMinLeg3
          : DEFAULTS.catalogMinLeg4
      : legs.length === 2
        ? DEFAULTS.minLegFairProb2
        : DEFAULTS.minLegFairProb3;
  for (const l of legs) {
    if (!Number.isFinite(l.fairProb) || l.fairProb < floor) {
      return {
        ok: false,
        reason: `Each game needs a true chance of at least ${Math.round(floor * 100)}% for a ${legs.length}-game parlay.`,
      };
    }
  }
  return { ok: true };
}

export function evaluateParlay(
  legs: ScanRow[],
  combinedEv?: number,
  mode: ParlayMode = "ribbon",
): ParlayCandidate | { ok: false; reason: string } {
  const gate = parlayLegal(legs, mode);
  if (!gate.ok) return gate;
  const games = new Set(legs.map((l) => l.eventId));
  const sameGame = games.size < legs.length;
  const mlAndSpread = sameGame && legs.some((l) => l.marketType === "ml") && legs.some((l) => l.marketType === "spread");
  // combineParlayFair is the canonical parlay pricer — handles SGP joint paths,
  // cross-game independence, and fallback haircut in one place (BIBLE §sgp rule).
  const combinedFair = Math.min(0.97, combineParlayFair(legs));
  const juice = typicalParlayJuice(legs.length);
  const ev =
    combinedEv ??
    (() => {
      const fairDec = 1 / Math.max(0.02, combinedFair);
      return 1 / (fairDec * (1 + juice)) / combinedFair - 1 + (1 - 1 / (1 + juice));
    })();
  const pricedAsEntertainment = ev < DEFAULTS.entertainmentEvLt;
  const mapped: ParlayLeg[] = legs.map((l) => ({
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
  const decimalPayout = product(legs.map((l) => americanToDecimal(l.price)));
  const sports = [...new Set(legs.map((l) => l.sport))];
  const corr = correlationOf(legs, sameGame);
  const shownPct = formatChancePct(shownCombinedChance(combinedFair, decimalPayout, legs.length, sameGame)) ?? `${Math.round(combinedFair * 100)}%`;
  const cand: ParlayCandidate = {
    legs: mapped,
    combinedFair,
    combinedEv: ev,
    pricedAsEntertainment,
    researchOnly: legs.some((l) => l.hardRockPrice == null),
    sameGame,
    title: pricedAsEntertainment
      ? `${legs.length}-game${sameGame ? " same-game" : ""} parlay — fun money`
      : `${legs.length}-game${sameGame ? " same-game" : ""} parlay`,
    reason:
      corr === "shared-latent"
        ? `Same-game joint paths. Combined chance ≈ ${shownPct}.`
        : corr === "fallback-haircut"
          ? `Same-game combo. Joint from Fréchet bounds (they move together). Combined chance ≈ ${shownPct}.`
          : `Near-independent games (tiny shared residual). Combined chance ≈ ${shownPct}.`,
    score: Math.max(
      parlayScore(combinedFair, decimalPayout),
      growthScore(combinedFair, decimalPayout, parlayInfoQuality(legs.length, sameGame), activeKelly) * 12,
    ),
    mix: sameGame ? "same-game" : sports.length > 1 ? "cross-sport" : "same-sport",
    decimalPayout,
    sports,
    correlation: corr,
  };
  return cand;
}

export function rejectParlayReason(legs: ScanRow[]): string | null {
  const r = parlayLegal(legs);
  return r.ok ? null : r.reason;
}

export function pickBestSpicy(rows: ScanRow[]): ParlayCandidate | null {
  return tryParlay(rows, 3) ?? tryParlay(rows, 2);
}

function onDeskHorizon(iso: string, now = new Date()): boolean {
  if (!iso) return false;
  if (isTodayEt(iso, now)) return true;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return t >= now.getTime() - 4 * 3600_000 && t <= now.getTime() + 36 * 3600_000;
}

export function pickBestTwo(rows: ScanRow[]): ParlayCandidate | null {
  return tryParlay(rows, 2);
}

function tryParlay(rows: ScanRow[], n: 2 | 3): ParlayCandidate | null {
  const pool = rows.filter(
    (r) =>
      !r.inPlay &&
      r.tag !== "in_play" &&
      r.tag !== "illegal_fl" &&
      r.tag !== "unknown_market" &&
      isMainMarket(r.marketType) &&
      !r.isProp &&
      !r.scheduleOnly &&
      onDeskHorizon(r.start) &&
      Number.isFinite(r.fairProb),
  );
  const bestPerGame = bestRowPerGame(pool);
  bestPerGame.sort(byValue);

  const floor = n === 2 ? DEFAULTS.minLegFairProb2 : DEFAULTS.minLegFairProb3;
  const cands = bestPerGame.filter((r) => r.fairProb >= floor);
  if (cands.length < n) return null;
  const pick = cands.slice(0, n);
  const evEstimate = product(pick.map((l) => l.fairProb));
  const typicalParlayJuice = n === 3 ? 0.25 : 0.12;
  const fairPayout = 1 / evEstimate;
  const booked = fairPayout * (1 - typicalParlayJuice);
  const ev = booked * evEstimate - 1;
  const built = evaluateParlay(pick, ev, "ribbon");
  if ("ok" in built && built.ok === false) return null;
  return built as ParlayCandidate;
}

function bestRowPerGame(pool: ScanRow[]): ScanRow[] {
  const byGame = new Map<string, ScanRow[]>();
  for (const r of pool) {
    const arr = byGame.get(r.eventId) ?? [];
    arr.push(r);
    byGame.set(r.eventId, arr);
  }
  const best: ScanRow[] = [];
  for (const arr of byGame.values()) {
    const sorted = [...arr].sort(byValue);
    if (sorted[0]) best.push(sorted[0]);
  }
  return best;
}

function catalogPool(rows: ScanRow[]): ScanRow[] {
  return rows.filter(
    (r) =>
      !r.inPlay &&
      r.tag !== "in_play" &&
      r.tag !== "illegal_fl" &&
      r.tag !== "unknown_market" &&
      isMainMarket(r.marketType) &&
      !r.isProp &&
      !r.scheduleOnly &&
      onDeskHorizon(r.start) &&
      Number.isFinite(r.fairProb) &&
      r.fairProb >= 0.45 &&
      (isPlayCore(r.sport) || isCollegeSport(r.sport)),
  );
}

export function pickTopSingles(rows: ScanRow[], n = 3): ScanRow[] {
  const pool = legalMains(rows, true).filter((r) => payoutMultiple(r.price) >= 0.65 && Number.isFinite(r.fairProb));
  const ranked = [...(pool.length ? pool : legalMains(rows, true))].sort(byValue);
  const seen = new Set<string>();
  const out: ScanRow[] = [];
  for (const r of ranked) {
    if (seen.has(r.eventId)) continue;
    seen.add(r.eventId);
    out.push(r);
    if (out.length >= n) break;
  }
  return out;
}

function combinations<T>(arr: T[], k: number): T[][] {
  const out: T[][] = [];
  const rec = (start: number, acc: T[]) => {
    if (acc.length === k) {
      out.push(acc);
      return;
    }
    for (let i = start; i <= arr.length - (k - acc.length); i++) rec(i + 1, [...acc, arr[i]!]);
  };
  rec(0, []);
  return out;
}

function rankParlays(cands: ParlayCandidate[], limit: number): ParlayCandidate[] {
  return [...cands].sort((a, b) => (b.score ?? -99) - (a.score ?? -99) || b.combinedFair - a.combinedFair).slice(0, limit);
}

function buildFromLegs(legs: ScanRow[]): ParlayCandidate | null {
  const built = evaluateParlay(legs, undefined, "catalog");
  if ("ok" in built && built.ok === false) return null;
  return built as ParlayCandidate;
}

export function pruneComboSeeds(rows: ScanRow[], cap = activeComboCap): ScanRow[] {
  const pool = catalogPool(rows);
  const scored = [...pool].sort((a, b) => {
    const ea = Number.isFinite(a.price) && Number.isFinite(a.fairProb) ? evPct(a.price, a.fairProb) : -99;
    const eb = Number.isFinite(b.price) && Number.isFinite(b.fairProb) ? evPct(b.price, b.fairProb) : -99;
    if (Math.abs(eb - ea) > 1e-6) return eb - ea;
    return (Number.isFinite(b.fairProb) ? b.fairProb : 0) - (Number.isFinite(a.fairProb) ? a.fairProb : 0);
  });
  const out: ScanRow[] = [];
  const seen = new Set<string>();
  for (const r of scored) {
    if (seen.has(r.eventId)) continue;
    seen.add(r.eventId);
    out.push(r);
    if (out.length >= cap) return out;
  }
  for (const r of scored) {
    if (out.includes(r)) continue;
    out.push(r);
    if (out.length >= cap) break;
  }
  return out;
}

export function enumerateCrossParlays(rows: ScanRow[], n: 2 | 3 | 4, limit = 12): ParlayCandidate[] {
  const seeds = pruneComboSeeds(rows, activeComboCap);
  if (seeds.length < n) return [];
  const out: ParlayCandidate[] = [];
  for (const combo of combinations(seeds, n)) {
    if (new Set(combo.map((l) => l.eventId)).size !== n) continue;
    const built = buildFromLegs(combo);
    if (built) out.push(built);
  }
  return rankParlays(out, limit);
}

export function enumerateSgp(rows: ScanRow[], limit = 8): ParlayCandidate[] {
  const pool = catalogPool(rows);
  const byGame = new Map<string, ScanRow[]>();
  for (const r of pool) {
    const arr = byGame.get(r.eventId) ?? [];
    arr.push(r);
    byGame.set(r.eventId, arr);
  }
  const out: ParlayCandidate[] = [];
  for (const arr of byGame.values()) {
    const bestOf = (type: ScanRow["marketType"]) =>
      [...arr.filter((r) => r.marketType === type)].sort(byValue)[0];
    const ml = bestOf("ml");
    const spread = bestOf("spread");
    const total = bestOf("total");
    const pairs: ScanRow[][] = [];
    if (spread && total) pairs.push([spread, total]);
    if (ml && total) pairs.push([ml, total]);
    if (ml && spread) pairs.push([ml, spread]);
    for (const pair of pairs) {
      const built = buildFromLegs(pair);
      if (built) out.push(built);
    }
    if (ml && spread && total) {
      const three = buildFromLegs([ml, spread, total]);
      if (three) out.push(three);
    }
  }
  return rankParlays(out, limit);
}

function unitPct(n?: number): number | undefined {
  if (n == null || !Number.isFinite(n)) return undefined;
  return n > 1 ? n / 100 : n;
}

function eventSeed(snapshot: DeskSnapshot, eventId: string, pWinH: number): string {
  const quotes = snapshot.quotes
    .filter((q) => q.eventId === eventId)
    .map((q) => `${q.marketType}:${q.side}:${q.price}:${q.point ?? ""}`)
    .join("|");
  return `${eventId}|${pWinH.toFixed(5)}|${quotes}`;
}

function dynamicBlend(
  sim: number | undefined, 
  pool: number | undefined, 
  market: number | undefined, 
  startIso: string, 
  ticketPct?: number, 
  handlePct?: number
): number {
  let wSim = 0.5;
  let wPool = 0.3;
  let wMarket = 0.2;
  
  if (startIso) {
    const msUntil = new Date(startIso).getTime() - Date.now();
    if (msUntil > 0 && msUntil < 2 * 3600_000) {
      const urgency = 1 - (msUntil / (2 * 3600_000));
      wMarket += 0.2 * urgency;
      wSim -= 0.1 * urgency;
      wPool -= 0.1 * urgency;
    }
  }
  
  let sharpMultiplier = 1.0;
  if (handlePct != null && ticketPct != null && ticketPct > 0) {
    const diff = handlePct - ticketPct;
    
    // Sharp divergence (handle > ticket by 10%+)
    if (diff >= 10) {
      wMarket += 0.2;
      wPool = Math.max(0, wPool - 0.2);
      
      // Extreme divergence (handle > ticket by 20%+)
      if (diff >= 20) {
        sharpMultiplier = 1.05;
      }
    } else {
      // Legacy ratio fallbacks for non-sharp divergence
      const ratio = handlePct / ticketPct;
      if (ratio >= 1.5) wMarket *= 1.25;
      else if (ratio < 0.7) wMarket *= 0.75;
    }
  }
  
  const parts: { w: number; v: number }[] = [];
  if (sim != null && Number.isFinite(sim)) parts.push({ w: wSim, v: sim });
  if (pool != null && Number.isFinite(pool)) parts.push({ w: wPool, v: pool });
  if (market != null && Number.isFinite(market)) parts.push({ w: wMarket, v: market });
  
  if (!parts.length) return 0.5;
  const w = parts.reduce((s, p) => s + p.w, 0);
  let blended = parts.reduce((s, p) => s + (p.w / w) * p.v, 0);
  
  blended *= sharpMultiplier;
  
  return Math.min(0.99, Math.max(0.01, blended));
}

function applyEnsemble(rows: ScanRow[], snapshot: DeskSnapshot): ScanRow[] {
  const byEvent = new Map<string, ScanRow[]>();
  for (const r of rows) {
    const arr = byEvent.get(r.eventId) ?? [];
    arr.push(r);
    byEvent.set(r.eventId, arr);
  }
  const out: ScanRow[] = [];
  for (const [eventId, group] of byEvent) {
    const homeMl = group.find((r) => r.marketType === "ml" && r.side === "home");
    const awayMl = group.find((r) => r.marketType === "ml" && r.side === "away");
    const brief = snapshot.briefs?.find((b) => b.eventId === eventId);
    const pred = snapshot.predict?.find((p) => p.eventId === eventId);
    const split = snapshot.publicSplits.find((s) => s.eventId === eventId && (!s.marketType || s.marketType === "ml"));
    const row = homeMl ?? awayMl ?? group[0]!;
    let openHome = brief?.openHomeWin;
    if (openHome == null && homeMl?.openPrice != null && awayMl?.openPrice != null) {
      const nv = twoWayNoVig(homeMl.openPrice, awayMl.openPrice);
      if (Number.isFinite(nv.fairHome)) openHome = nv.fairHome;
    }
    const chanceInput = {
      home: row.home,
      away: row.away,
      sport: row.sport,
      start: row.start,
      oddsHome: homeMl && !homeMl.scheduleOnly ? homeMl.fairProb : undefined,
      bookHome: brief?.bookHomeWin,
      openHome,
      espnHome: brief?.espnHomeWin,
      kalshiHome: pred?.kalshiHome ?? brief?.kalshiHomeWin,
      kalshiVolume: pred?.kalshiVolume ?? brief?.kalshiVolume,
      kalshiSpread: pred?.kalshiSpread ?? brief?.kalshiSpread,
      polyHome: pred?.polyHome ?? brief?.polyHomeWin,
      polyVolume: pred?.polyVolume ?? brief?.polyVolume,
      homeSpread: brief?.homeSpread ?? row.homeSpread,
      total: brief?.total ?? row.total,
      homeRecord: brief?.homeRecord ?? row.homeRecord,
      awayRecord: brief?.awayRecord ?? row.awayRecord,
      ticketHome: brief?.ticketHome ?? unitPct(split?.ticketPct ?? split?.publicPct) ?? homeMl?.ticketPct,
      handleHome: brief?.handleHome ?? unitPct(split?.handlePct) ?? homeMl?.handlePct,
      steam: brief?.steam ?? split?.steam ?? homeMl?.tapeLean === "sharp",
      lastFive: brief?.form,
      weatherTemp: brief?.weatherTemp,
      weatherWind: brief?.weatherWind,
      weatherPrecip: brief?.weatherPrecip,
      venue: brief?.venue,
      homeSplit: brief?.homeSplit,
      awaySplit: brief?.awaySplit,
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
      seriesHomeWins: brief?.seriesHomeWins,
      seriesAwayWins: brief?.seriesAwayWins,
      homeRestDays: brief?.homeRestDays,
      awayRestDays: brief?.awayRestDays,
      homeLooks: brief?.homeLooks,
      awayLooks: brief?.awayLooks,
      homePitcherHand: brief?.homePitcherHand,
      awayPitcherHand: brief?.awayPitcherHand,
    };
    const built = buildLatents({
      ...chanceInput,
      eventId,
      inPlay: Boolean(row.inPlay),
      homeScore: row.homeScore,
      awayScore: row.awayScore,
      period: row.period,
      clock: row.clock,
    });
    const report = built.layers;
    const process = processFromLooks(row.sport, chanceInput.homeLooks, chanceInput.awayLooks);
    const simOk = Boolean(built.latent.ran);
    
    const paths = simOk ? drawPaths(built.latent, eventSeed(snapshot, eventId, built.latent.pWinH)) : [];
    
    const simHome = simOk ? simWin(paths) : { p: undefined as number | undefined, ran: false };
    const usage = buildUsage({
      eventId,
      sport: row.sport,
      players: brief?.players,
      injuries: brief?.injuries,
    });

    for (const r of group) {
      let poolFair = r.fairProb;
      let simFair: number | undefined;
      const marketFair = Number.isFinite(r.fairProb) ? r.fairProb : undefined;
      if (simOk && r.marketType === "ml" && report) {
        poolFair = r.side === "home" ? report.home : report.away;
        simFair = r.side === "home" ? simHome.p : simHome.p != null ? 1 - simHome.p : undefined;
      } else if (simOk && r.marketType === "spread" && r.point != null) {
        const homeCover = simCover(paths, r.side === "home" ? r.point : -r.point);
        simFair = r.side === "home" ? homeCover.p : 1 - simCover(paths, -(r.point)).p;
      } else if (simOk && r.marketType === "total") {
        const line = r.point ?? r.total ?? 0;
        const overP = simOver(paths, line).p;
        const isOver = r.side === "over" || /\bover\b/i.test(r.selection);
        simFair = isOver ? overP : 1 - overP;
      } else if (r.marketType === "ml" && report) {
        poolFair = r.side === "home" ? report.home : report.away;
      }
      const leftover = Boolean(r.inPlay && r.homeScore != null && r.awayScore != null);
      if (leftover && r.marketType === "total") {
        const line = r.point ?? r.total ?? 0;
        const pOver = leftoverOverProb({
          sport: r.sport,
          postedTotal: line,
          already: r.homeScore! + r.awayScore!,
          period: r.period,
          clock: r.clock,
        });
        const isOver = r.side === "over" || /\bover\b/i.test(r.selection);
        poolFair = isOver ? pOver : 1 - pOver;
      }
      
      let tPct = r.ticketPct;
      let hPct = r.handlePct;
      if (tPct == null && chanceInput.ticketHome != null) {
        tPct = r.side === "home" ? chanceInput.ticketHome : 100 - chanceInput.ticketHome;
      }
      if (hPct == null && chanceInput.handleHome != null) {
        hPct = r.side === "home" ? chanceInput.handleHome : 100 - chanceInput.handleHome;
      }
      const fairProb = dynamicBlend(simFair, poolFair, marketFair, r.start, tPct, hPct);
      
      let tapeLean = r.tapeLean;
      if (hPct != null && tPct != null) {
        const diff = hPct - tPct;
        if (diff >= 10 && chanceInput.steam) {
          tapeLean = "sharp_rlm";
        }
      }
      
      const playerUse = r.player ? usageOf(usage, r.player) : undefined;
      const listedOut = Boolean(playerUse?.standDown);
      const unknown = Boolean(r.isProp) && !isKnownMarket(r.selection, r.marketType);
      let tag = r.tag;
      let action = r.action;
      let reason = r.reason;
      if (listedOut) {
        tag = r.tag === "illegal_fl" ? r.tag : r.tag;
        action = "stand_down";
        reason = playerUse?.note ?? `${r.player} listed out. Tickets omitted.`;
      }
      if (unknown && tag !== "illegal_fl") {
        tag = "unknown_market";
        action = "stand_down";
        reason = unknownMarketReason(r.selection);
      }
      if (leftover) {
        reason =
          "Live remaining-stat from leftover mean (score + clock), not a haircut of the pre-game %. Photograph Hard Rock now. Not The Call.";
      }
      out.push({
        ...r,
        fairProb,
        poolFair,
        simFair,
        leftover,
        processLooked: process.empty,
        processSource: process.source,
        tapeLean,
        tag,
        action,
        reason,
      });
    }
  }
  return out;
}

export function buildScan(snapshot: DeskSnapshot, _halt: boolean, settings?: RankSettings): ScanBundle {
  activeKelly = settings?.kellyMultiplier ?? 1;
  activeComboCap = Math.min(20, Math.max(8, settings?.comboLegCap ?? COMBO_SEED_CAP));
  const scored = scoreQuotes(snapshot);
  const stamped = stampRows(scored, snapshot.publicSplits ?? []);
  let rows = applyEnsemble(stamped, snapshot);
  if (settings?.sportFeeds) {
    rows = rows.filter((r) => settings.sportFeeds[r.sport as keyof typeof settings.sportFeeds] !== false);
  }
  const missingBoard = snapshot.quotes.length === 0;
  const bestMain = missingBoard ? null : pickAnyMain(rows);
  const bestTwo = missingBoard ? null : pickBestTwo(rows);
  const bestSpicy = missingBoard ? null : pickBestSpicy(rows);
  const bestFlip = missingBoard ? null : pickCoinFlip(rows, bestMain ? [bestMain.eventId] : []);
  const topSingles = missingBoard ? [] : pickTopSingles(rows, 3);
  const topTwos = missingBoard ? [] : enumerateCrossParlays(rows, 2, 16);
  const topThrees = missingBoard ? [] : enumerateCrossParlays(rows, 3, 12);
  const topFours = missingBoard ? [] : enumerateCrossParlays(rows, 4, 8);
  const topSgp = missingBoard ? [] : enumerateSgp(rows, 10);
  if (missingBoard) {
    for (const r of rows) {
      if (r.action === "enter_ticket") r.action = "stand_down";
    }
  }
  return {
    asOf: snapshot.asOf,
    delayed: true,
    halt: false,
    rows,
    bestMain,
    bestSpicy,
    bestTwo,
    bestFlip,
    missingBoard,
    topSingles,
    topTwos,
    topThrees,
    topFours,
    topSgp,
  };
}

export function canPlacePaper(opts: {
  stake: number;
  paperCash: number;
  halted: boolean;
  dustUsd?: number;
  maxTicketPct?: number;
}): { ok: true } | { ok: false; error: string } {
  const dust = opts.dustUsd ?? DEFAULTS.dustUsd;
  void opts.halted;
  void opts.maxTicketPct;
  if (opts.stake < dust) {
    return { ok: false, error: `That bet is under $${dust}. Too small to bother.` };
  }
  if (opts.stake > opts.paperCash) {
    return { ok: false, error: "That bet is bigger than your tracker cash." };
  }
  return { ok: true };
}
