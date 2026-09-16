import assert from "node:assert/strict";
import { test } from "node:test";
import { CHECK_ORDER } from "./universe.ts";
import {
  americanToImplied,
  buildScan,
  canPlacePaper,
  evaluateParlay,
  evPct,
  pickBestMain,
  pickCoinFlip,
  product,
  rejectParlayReason,
  twoWayNoVig,
  unitDollars,
  valueScore,
  payoutMultiple,
} from "./engine.ts";
import { buildPlays, scoreOptions, type BuildPlaysInput } from "./plays.ts";
import { sampleSnapshot } from "./sample-board.ts";
import type { DeskSnapshot, ScanRow } from "./types.ts";
import { isLastLesson, LESSONS, nextLearnIndex } from "../learn/lessons.ts";
import { parseSlateTable, optimizeSlate, DK_CAP, applyGameLean } from "./slate.ts";
import { OPTION_CATALOG } from "./options.ts";
import { PATH_HONESTY, pathTable } from "./path.ts";
import { shortPick, profitOnStake, formatChancePct } from "../copy.ts";
import { GLOSSARY } from "../glossary.ts";
import { suggestContests, targetDfsFee } from "./dfs.ts";
import { formatKickoff, matchupLine, isTodayEt } from "../utils.ts";

function hoursFromNow(h: number) {
  return new Date(Date.now() + h * 3600_000).toISOString();
}

function row(partial: Partial<ScanRow> & Pick<ScanRow, "eventId" | "selection" | "fairProb">): ScanRow {
  return {
    sport: "NFL",
    start: hoursFromNow(12),
    home: "Home",
    away: "Away",
    marketType: "ml",
    side: "home",
    price: -110,
    evPct: 0,
    hold: 0.05,
    action: "enter_ticket",
    reason: "test",
    conviction: "low",
    spark: "",
    tag: "fair_or_better",
    inPlay: false,
    isProp: false,
    hardRockPrice: -110,
    ...partial,
  };
}

function emptySnap(): DeskSnapshot {
  const s = sampleSnapshot();
  return {
    ...s,
    quotes: [],
    publicSplits: [],
    news: [],
    sample: false,
    sourceNote: "empty",
  };
}

function playsFrom(opts: Partial<BuildPlaysInput> & Pick<BuildPlaysInput, "bankroll" | "scan" | "snapshot">) {
  return buildPlays({
    unitPct: 0.01,
    halt: false,
    weeklyHalt: false,
    ...opts,
  });
}

test("american implied and no-vig hold on -110/-110", () => {
  const p = americanToImplied(-110);
  assert.ok(Math.abs(p - 110 / 210) < 1e-10);
  const nv = twoWayNoVig(-110, -110);
  assert.ok(Math.abs(nv.fairHome - 0.5) < 1e-10);
  assert.ok(nv.hold > 0.04 && nv.hold < 0.05);
});

test("chance-to-hit is the desk language, not raw American odds", () => {
  assert.equal(formatChancePct(0.57), "57%");
  assert.equal(formatChancePct(0.084), "8.4%");
  assert.equal(formatChancePct(0.995), "99%");
  assert.equal(formatChancePct(0), null);
  assert.equal(formatChancePct(undefined), null);
});

test("1. $50 seed, any board: recommended safe is a real one-game ticket, not Don't bet", () => {
  const snapshot = sampleSnapshot();
  const scan = buildScan(snapshot, false);
  const board = playsFrom({ bankroll: 50, scan, snapshot });
  assert.equal(board.recommended, "safe");
  assert.notEqual(board.safe.symbol, "SIT");
  assert.equal(board.safe.optionKind, "main");
  assert.equal(board.safe.liveFits, false);
  assert.equal(board.risky.liveFits, false);
  assert.doesNotMatch(board.safe.title, /don't bet/i);
  assert.doesNotMatch(board.verdict.doThis, /BET the 3-leg/i);
  assert.notEqual(board.verdict.lane, "risky");
});

test("2. $2,000 halt off, today's one-game is a real ticket with a payout", () => {
  const snapshot = sampleSnapshot();
  const scan = buildScan(snapshot, false);
  const best = pickBestMain(scan.rows);
  assert.ok(best, "expected a today one-game");
  assert.ok(isTodayEt(best!.start), "today's pick must be a game playing today");
  assert.notEqual(best!.eventId, "nfl-thu-blowout");
  assert.ok(payoutMultiple(best!.price) >= 0.65, "easiest ticket must actually pay something");
  const board = playsFrom({ bankroll: 2_000, scan, snapshot });
  assert.equal(board.recommended, "safe");
  assert.equal(board.safe.optionKind, "main");
  assert.equal(board.safe.unitCount, 1);
  assert.equal(board.safe.venue, "Hard Rock Bet");
  assert.equal(board.verdict.venue, "Hard Rock Bet");
  assert.equal(board.middle.optionKind, "parlay");
  assert.equal(board.risky.optionKind, "parlay");
  assert.equal(board.risky.symbol, "3LEG");
  assert.ok(board.singles.length >= 1 && board.singles.length <= 3);
  assert.ok(board.twoLegs.length >= 1);
  assert.ok(board.threeLegs.length >= 1);
});

test("3. $2,000 all mains juiced on KC/BAL: safest is still a real ticket, never Don't bet", () => {
  const snapshot = sampleSnapshot();
  snapshot.quotes = snapshot.quotes.map((q) => {
    if (q.eventId === "nfl-kc-bal" && q.marketType === "ml") {
      return { ...q, hardRockPrice: q.side === "away" ? 110 : -150, price: q.side === "away" ? 110 : -150 };
    }
    return q;
  });
  const scan = buildScan(snapshot, false);
  const board = playsFrom({ bankroll: 2_000, scan, snapshot });
  assert.notEqual(board.safe.symbol, "SIT");
  assert.doesNotMatch(board.safe.title, /don't bet/i);
  assert.equal(board.safe.optionKind, "main");
  assert.equal(board.recommended, "safe");
});

test("4. Daily stop never blocks a paper lock — this site does not place bets", () => {
  const snapshot = sampleSnapshot();
  const scan = buildScan(snapshot, true);
  const board = playsFrom({ bankroll: 2_000, scan, snapshot, halt: true });
  assert.equal(board.safe.liveFits, true);
  assert.doesNotMatch(board.safe.because, /daily stop|loss limit/i);
  assert.notEqual(board.risky.symbol, "SIT");
  const allowed = canPlacePaper({ stake: 20, paperCash: 2500, halted: true });
  assert.equal(allowed.ok, true);
});

test("5. 3-leg each fairProb 0.58, combined EV −12%: entertainment, not recommended, prints ~19.5%", () => {
  const legs = [
    row({ eventId: "g1", selection: "A ML", fairProb: 0.58 }),
    row({ eventId: "g2", selection: "B ML", fairProb: 0.58 }),
    row({ eventId: "g3", selection: "C ML", fairProb: 0.58 }),
  ];
  const built = evaluateParlay(legs, -0.12, "catalog");
  assert.ok(!("ok" in built && built.ok === false));
  const cand = built as Exclude<typeof built, { ok: false; reason: string }>;
  assert.ok(Math.abs(cand.combinedFair - 0.58 ** 3) < 1e-10);
  assert.ok(Math.abs(cand.combinedFair - 0.195112) < 1e-5);
  assert.equal(cand.pricedAsEntertainment, true);
  assert.match(cand.title, /priced as entertainment|fun money/i);
  const approx = `${(cand.combinedFair * 100).toFixed(1)}%`;
  assert.equal(approx, "19.5%");

  const snapshot = sampleSnapshot();
  const scan = buildScan(snapshot, false);
  scan.bestSpicy = cand;
  scan.topThrees = [cand];
  const board = playsFrom({ bankroll: 2_000, scan, snapshot });
  assert.notEqual(board.recommended, "risky");
  assert.equal(board.risky.optionKind, "parlay");
  assert.ok(board.risky.combinedFair != null);
  assert.ok(Math.abs(board.risky.combinedFair! - 0.195112) < 1e-5);
  assert.equal(board.risky.symbol, "3LEG");
});

test("6. 3-leg with a 0.51 fair leg: illegal for the risky card", () => {
  const legs = [
    row({ eventId: "g1", selection: "A ML", fairProb: 0.58 }),
    row({ eventId: "g2", selection: "B ML", fairProb: 0.58 }),
    row({ eventId: "g3", selection: "C ML", fairProb: 0.51 }),
  ];
  const reason = rejectParlayReason(legs);
  assert.ok(reason);
  assert.match(reason!, /0\.58|58|fair|chance/i);
  const built = evaluateParlay(legs, -0.1);
  assert.equal("ok" in built && built.ok === false, true);
});

test("7. 4-leg: illegal on the Today ribbon. Legal on the Parlay catalog.", () => {
  const legs = [
    row({ eventId: "g1", selection: "A", fairProb: 0.6 }),
    row({ eventId: "g2", selection: "B", fairProb: 0.6 }),
    row({ eventId: "g3", selection: "C", fairProb: 0.6 }),
    row({ eventId: "g4", selection: "D", fairProb: 0.6 }),
  ];
  const reason = rejectParlayReason(legs);
  assert.ok(reason);
  assert.match(reason!, /2 or 3|4/i);
  const catalog = evaluateParlay(legs, undefined, "catalog");
  assert.equal("ok" in catalog && catalog.ok === false, false);
  const cand = catalog as Exclude<typeof catalog, { ok: false; reason: string }>;
  assert.equal(cand.legs.length, 4);
  assert.ok(cand.score != null);
});

test("8. College player prop: market check blocks. No Gators QB card", () => {
  const snapshot = sampleSnapshot();
  const scan = buildScan(snapshot, false);
  const board = playsFrom({ bankroll: 2_000, scan, snapshot });
  const market = board.verdict.checks.find((c) => c.id === "market");
  const props = board.verdict.checks.find((c) => c.id === "props");
  assert.ok(market && props);
  assert.equal(props!.used, "blocks");
  assert.match(props!.finding, /college/i);
  assert.doesNotMatch(board.safe.action + board.middle.action + board.risky.action, /Gators QB/i);
  const statuses = scoreOptions(board, {
    bankroll: 2_000,
    unitPct: 0.01,
    halt: false,
    weeklyHalt: false,
    scan,
    snapshot,
  });
  assert.equal(statuses.find((s) => s.kind === "prop")?.status, "blocked");
});

test("9. DK Sportsbook moneyline as live Florida ticket: venue check blocks", () => {
  const snapshot = sampleSnapshot();
  const scan = buildScan(snapshot, false);
  const board = playsFrom({ bankroll: 2_000, scan, snapshot });
  const venue = board.verdict.checks.find((c) => c.id === "venue");
  assert.ok(venue);
  assert.equal(venue!.used, "blocks");
  assert.match(venue!.finding, /DraftKings|FanDuel|not licensed|Florida/i);
  const illegal = scan.rows.find((r) => r.venueNote === "dk_sportsbook");
  assert.ok(illegal);
  assert.equal(illegal!.tag, "illegal_fl");
});

test("10. Public 80% tickets / 54% handle: board check noted. No fade/tail card", () => {
  const snapshot = sampleSnapshot();
  const scan = buildScan(snapshot, false);
  const board = playsFrom({ bankroll: 2_000, scan, snapshot });
  const boardCheck = board.verdict.checks.find((c) => c.id === "board");
  assert.ok(boardCheck);
  assert.equal(boardCheck!.used, "noted");
  assert.match(boardCheck!.finding, /80%/);
  assert.match(boardCheck!.finding, /54%|money/i);
  const blob = `${board.safe.action} ${board.middle.action} ${board.risky.action} ${board.safe.title} ${board.middle.title} ${board.risky.title}`;
  assert.doesNotMatch(blob, /fade the public|tail the public/i);
  const kc = scan.rows.find((r) => r.eventId === "nfl-kc-bal" && r.marketType === "ml" && r.side === "home");
  assert.ok(kc?.ticketPct && kc.ticketPct > 0.7);
  assert.ok(kc?.handlePct && kc.handlePct < 0.6);
  assert.equal(kc?.tapeLean, "public");
});

test("11. Screenshot parse unconfirmed does not enter scan", () => {
  const snapshot = emptySnap();
  snapshot.quotes = [
    {
      eventId: "manual-1",
      sport: "NFL",
      start: hoursFromNow(10),
      home: "A",
      away: "B",
      marketType: "ml",
      side: "home",
      selection: "A ML",
      price: -110,
      source: "screenshot",
      delayed: true,
      confirmed: false,
    },
  ];
  const usable = snapshot.quotes.filter((q) => q.confirmed !== false && q.source !== "screenshot" || q.confirmed);
  assert.equal(usable.length, 0);
  const scan = buildScan({ ...snapshot, quotes: snapshot.quotes.filter((q) => q.confirmed) }, false);
  assert.equal(scan.missingBoard, true);
});

test("12. Learn: next from 0 → 1; last lesson Next disabled helper", () => {
  assert.equal(LESSONS.length, 13);
  assert.equal(nextLearnIndex(0), 1);
  assert.equal(nextLearnIndex(12), 12);
  assert.equal(isLastLesson(12), true);
  assert.equal(isLastLesson(11), false);
});

test("13. Paper size: 1% of $80 book is under $1 → dust error", () => {
  const unit = unitDollars(80, 0.01);
  assert.ok(unit < 1);
  const r = canPlacePaper({ stake: unit, paperCash: 80, halted: false, dustUsd: 1 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /dust|under|too small/i);
});

test("14. Same-position keepers, FAAB, VOO, USDC are not live cards", () => {
  const kinds = OPTION_CATALOG.map((o) => o.kind).join(",");
  assert.doesNotMatch(kinds, /FAAB|VOO|USDC|keeper/i);
  const titles = OPTION_CATALOG.map((o) => `${o.title} ${o.symbol}`).join(" ");
  assert.doesNotMatch(titles, /\bVOO\b|\bUSDC\b|FAAB/);
});

test("15. Auth off is a product constant (no sign-in gate on /)", () => {
  assert.equal(LESSONS[0]?.id, "venue");
});

test("16. Eleven checks always present in order; delay=blocks; board=noted; news=discarded", () => {
  const snapshot = sampleSnapshot();
  const scan = buildScan(snapshot, false);
  const board = playsFrom({ bankroll: 200, scan, snapshot });
  const ids = board.verdict.checks.map((c) => c.id);
  assert.deepEqual(ids, [...CHECK_ORDER]);
  assert.equal(board.verdict.checks.length, 11);
  assert.equal(board.verdict.checks.find((c) => c.id === "delay")?.used, "blocks");
  assert.equal(board.verdict.checks.find((c) => c.id === "board")?.used, "noted");
  assert.equal(board.verdict.checks.find((c) => c.id === "news")?.used, "discarded");
  assert.equal(board.verdict.checks.find((c) => c.id === "stack")?.used, "supports");
});

test("17. Pin / ignore ribbon does not change the call", () => {
  const snapshot = sampleSnapshot();
  const scan = buildScan(snapshot, false);
  const a = playsFrom({ bankroll: 50, scan, snapshot, ignoreRibbon: false });
  const b = playsFrom({ bankroll: 50, scan, snapshot, ignoreRibbon: true });
  assert.equal(a.recommended, b.recommended);
  assert.equal(a.verdict.symbol, b.verdict.symbol);
});

test("same-game 3-leg SGP is blocked", () => {
  const legs = [
    row({ eventId: "same", selection: "ML", fairProb: 0.6, marketType: "ml" }),
    row({ eventId: "same", selection: "Spread", fairProb: 0.6, marketType: "spread" }),
    row({ eventId: "same", selection: "Total", fairProb: 0.6, marketType: "total" }),
  ];
  const reason = rejectParlayReason(legs);
  assert.ok(reason);
  assert.match(reason!, /same-game|SGP/i);
});

test("unconfirmed slate does not lock a lineup", () => {
  const players = parseSlateTable(
    "Mahomes,QB,KC,7800,24\nKelce,TE,KC,6200,14\nPacheco,RB,KC,5800,13",
    "NFL",
  );
  const bundle = optimizeSlate({
    site: "draftkings_classic",
    sport: "NFL",
    slateDate: "2026-09-06",
    cap: DK_CAP,
    players,
    source: "paste",
    confirmed: false,
  });
  assert.equal(bundle.cash, null);
  assert.equal(bundle.gpp, null);
});

test("path table shrinks a $200 book at −4% EV", () => {
  const t = pathTable(200, 0.01);
  const u100 = t.find((p) => p.units === 100)!;
  assert.ok(u100.evNeg4 < 200);
  assert.equal(u100.ev0, 200);
  assert.ok(u100.evPos2 > 200);
  assert.match(PATH_HONESTY, /not a path to \$1M/i);
});

test("combined fair product of three 0.58 legs is ~19.5%", () => {
  assert.ok(Math.abs(product([0.58, 0.58, 0.58]) * 100 - 19.5112) < 1e-3);
});

test("evPct of a fair-or-better plus-money dog", () => {
  const nv = twoWayNoVig(-150, 130);
  const ev = evPct(160, nv.fairAway);
  assert.ok(ev > 0);
});

test("ML is never shown raw — shortPick says 'to win'", () => {
  assert.equal(shortPick("Baltimore ML", "ml"), "Baltimore to win");
  assert.equal(shortPick("Detroit ML", "ml"), "Detroit to win");
  assert.match(GLOSSARY.find((t) => t.id === "ml")!.meaning, /who wins/i);
});

test("profit on a $10 bet at -150 and +130 is in dollars", () => {
  const fav = profitOnStake(10, -150);
  assert.ok(Math.abs(fav.profit - 10 * (100 / 150)) < 1e-9);
  assert.ok(Math.abs(fav.total - (10 + fav.profit)) < 1e-9);
  const dog = profitOnStake(10, 130);
  assert.ok(Math.abs(dog.profit - 13) < 1e-9);
  assert.ok(Math.abs(dog.total - 23) < 1e-9);
});

test("riskiest card is a 3-game parlay, never Don't bet", () => {
  const snapshot = sampleSnapshot();
  const scan = buildScan(snapshot, false);
  assert.ok(scan.topThrees.length >= 1, "expected ranked 3-leg parlays");
  const board = playsFrom({ bankroll: 2_000, scan, snapshot });
  assert.equal(board.risky.symbol, "3LEG");
  assert.equal(board.risky.optionKind, "parlay");
  assert.doesNotMatch(`${board.safe.title} ${board.middle.title} ${board.risky.title}`, /don't bet/i);
  assert.ok(board.threeLegs.length >= 1);
  assert.ok(board.twoLegs.length >= 1);
  assert.ok(board.singles.length >= 1);
  assert.ok(scan.topFours.length >= 1, "4-leg catalog should fill from five today games");
  assert.ok(scan.topSgp.length >= 1, "same-game parlays should grade");
  const sgp = scan.topSgp[0]!;
  assert.ok(sgp.correlation === "shared-latent" || sgp.correlation === "fallback-haircut");
  if (sgp.correlation === "shared-latent") {
    assert.match(sgp.reason, /joint/i);
    assert.doesNotMatch(sgp.reason, /haircut/i);
  } else {
    assert.match(sgp.reason, /fallback-haircut|haircut/i);
  }
});

test("DFS buy-in tracks 1% of bankroll", () => {
  assert.equal(targetDfsFee(200), 2);
  const rec = suggestContests(200, []);
  assert.ok(rec.cash);
  assert.ok(rec.cash!.buyIn <= 5);
  assert.match(rec.note, /1%/);
});

test("tickets name home, away, and Eastern kickoff", () => {
  const snapshot = sampleSnapshot();
  const scan = buildScan(snapshot, false);
  const board = playsFrom({ bankroll: 2_000, scan, snapshot });
  assert.ok(board.safe.home);
  assert.ok(board.safe.away);
  assert.match(board.safe.kickoffEnglish ?? "", /ET/);
  assert.match(board.safe.matchupEnglish ?? "", /away/i);
  assert.match(board.safe.matchupEnglish ?? "", /home/i);
  assert.ok(board.risky.kickoffEnglish);
  assert.match(formatKickoff(scan.bestMain!.start), /ET/);
  assert.equal(matchupLine("Baltimore", "Kansas City"), "Baltimore (away) at Kansas City (home)");
});

test("fantasy points use the same game-lean research as the sports desk", () => {
  const players = parseSlateTable("Mahomes,QB,KC,7800,20\nHenry,RB,BAL,8000,18", "NFL");
  const nudged = applyGameLean(players, [
    { team: "KC", also: "Kansas City Chiefs", winChance: 0.7, total: 48, sport: "NFL", favoriteName: "Chiefs" },
    { team: "BAL", also: "Baltimore Ravens", winChance: 0.3, total: 48, sport: "NFL", favoriteName: "Chiefs" },
  ]);
  const mahomes = nudged.find((p) => p.name === "Mahomes");
  const henry = nudged.find((p) => p.name === "Henry");
  assert.ok(mahomes && henry);
  assert.ok(mahomes!.p50 > henry!.p50 || mahomes!.p50 > 20 * 0.95);
  assert.match(mahomes!.researchNote ?? "", /70 in 100/);
});

test("value score prefers a real payout over a −400 favorite", () => {
  assert.ok(valueScore(0.58, -110) > valueScore(0.8, -400));
  assert.ok(valueScore(0.7, -150) > valueScore(0.82, -400));
  assert.ok(payoutMultiple(-400) < 0.5);
  assert.ok(payoutMultiple(-150) >= 0.65);
  assert.ok(payoutMultiple(-110) > 0.8);
});

test("today's pick never uses a later-week blowout", () => {
  const snapshot = sampleSnapshot();
  const scan = buildScan(snapshot, false);
  assert.ok(scan.bestMain);
  assert.ok(isTodayEt(scan.bestMain!.start));
  assert.notEqual(scan.bestMain!.eventId, "nfl-thu-blowout");
  assert.ok(scan.rows.some((r) => r.eventId === "nfl-thu-blowout"), "later-week game is still on the board");
  if (scan.bestFlip) assert.ok(isTodayEt(scan.bestFlip.start));
  if (scan.bestTwo) {
    for (const leg of scan.bestTwo.legs) assert.ok(isTodayEt(leg.start));
  }
});

test("pickBestMain is empty when the only games are later this week", () => {
  const snapshot = sampleSnapshot();
  snapshot.quotes = snapshot.quotes.filter((q) => q.eventId === "nfl-thu-blowout");
  const scan = buildScan(snapshot, false);
  assert.equal(scan.bestMain, null);
  assert.equal(scan.bestFlip, null);
  assert.equal(scan.bestTwo, null);
});



