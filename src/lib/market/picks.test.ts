// @ts-nocheck
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildScan } from "./engine.ts";
import { sampleSnapshot } from "./sample-board.ts";
import { isCollegeSport } from "./universe.ts";
import { formatChancePct } from "../copy.ts";
import {
  buildDeskPicks,
  calibratedChance,
  confidenceOf,
  decodeTicketId,
  infoQuality,
  keyNumberTilt,
  lookupPick,
  parseParlayTicketId,
  parlayTicketIdFromLegs,
  deskPickFromLegRefs,
  pickHero,
  qualityBand,
  safestColumn,
  belowSixty,
  highestTodayLabel,
  shownParlayChance,
  shownParlayFromStoreLegs,
  sortByMood,
  ticketScore,
  type DeskPick,
} from "./picks.ts";

async function bag() {
  const snapshot = sampleSnapshot();
  const scan = await buildScan(snapshot, false);
  const picks = buildDeskPicks(scan, snapshot);
  return { snapshot, scan, picks };
}

function stubPick(over: Partial<DeskPick> & { selection: string }): DeskPick {
  return {
    id: over.id ?? over.selection,
    bucket: over.bucket ?? "popular",
    selection: over.selection,
    chance: over.chance ?? 0.56,
    price: over.price ?? -110,
    decimalPayout: over.decimalPayout ?? 1.91,
    score: over.score ?? 1,
    sport: over.sport ?? "MLB",
    why: over.why ?? "test",
    infoQuality: over.infoQuality ?? 0.9,
    confidence: over.confidence ?? "high",
    processLooked: over.processLooked,
    processSource: over.processSource,
    implied: over.implied,
    edge: over.edge,
    row: over.row,
    parlay: over.parlay,
    player: over.player,
    researchOnly: over.researchOnly,
    tapeStamp: over.tapeStamp,
  };
}

test("hero has a chance-to-hit and a payout when one qualifies", async () => {
  const { picks } = await bag();
  if (picks.hero) {
    assert.ok(picks.hero.chance > 0.08 && picks.hero.chance < 1);
    assert.ok(picks.hero.decimalPayout >= 1.55);
    assert.notEqual(picks.hero.bucket, "parlay4");
    assert.ok((picks.hero.infoQuality ?? 0) >= 0.72);
    assert.equal(picks.hero.processLooked, false);
  }
});

test("catalog covers popular, player, and period tickets", async () => {
  const { picks } = await bag();
  assert.ok(picks.popular.length >= 1);
  assert.ok(picks.periods.length >= 1 || picks.props.length >= 0);
  for (const p of [...picks.popular, ...picks.props, ...picks.periods]) {
    assert.ok(p.chance > 0 && p.chance < 1);
    assert.ok(p.decimalPayout > 1);
    assert.ok(p.infoQuality > 0);
  }
});

test("Popular mains stay on the lane even when The Call sits down", async () => {
  const { scan, picks } = await bag();
  const mains = scan.rows.filter(
    (r) =>
      !r.isProp &&
      r.marketType !== "prop" &&
      (r.marketType === "ml" || r.marketType === "spread" || r.marketType === "total") &&
      !r.inPlay,
  );
  assert.ok(mains.length >= 1);
  assert.ok(picks.popular.length >= 1, "Popular cannot be empty while the board has mains");
  assert.ok(
    picks.popular.some((p) => p.chance >= 0.5),
    "Popular must keep a favorite/main that actually hits often — not only plus-money dogs",
  );
});

test("parlay ticket ids are URL-safe and still round-trip through lookup", async () => {
  const { scan, snapshot, picks } = await bag();
  const two = picks.two[0] ?? picks.ribbon[0];
  assert.ok(two?.parlay);
  const id = two!.id;
  assert.match(id, /^p\d+__/);
  assert.doesNotMatch(id, /[|.~+ ]/);
  const parsed = parseParlayTicketId(id);
  assert.ok(parsed && parsed.length >= 2);
  const hit = lookupPick(id, scan, snapshot);
  assert.ok(hit?.parlay);
  assert.equal(hit!.parlay!.legs.length, two!.parlay!.legs.length);
  const old = `p|2|${two!.parlay!.legs.map((l) => `${l.eventId}~${l.marketType}~${l.side}~${l.selection}`).join("||")}`;
  const fromOld = lookupPick(old, scan, snapshot);
  assert.ok(fromOld?.parlay);
  const compact = `p2-${two!.parlay!.legs.map((l) => `${l.eventId}~${l.marketType}~${l.side}`).join("--")}`;
  const fromCompact = lookupPick(compact, scan, snapshot);
  assert.ok(fromCompact?.parlay);
  assert.equal(decodeTicketId(encodeURIComponent(id)), id);
});

test("every named ticket has a hitting percentage and a payout", async () => {
  const { picks } = await bag();
  for (const p of picks.all) {
    assert.ok(p.chance > 0 && p.chance < 1, p.selection);
    assert.ok(p.decimalPayout > 1, p.selection);
  }
});

test("college player props stay off the catalog", async () => {
  const { picks } = await bag();
  for (const p of picks.props) {
    assert.equal(isCollegeSport(p.sport), false);
  }
});

test("lookup roundtrip finds the named ticket", async () => {
  const { snapshot, scan, picks } = await bag();
  const target = picks.hero ?? picks.popular[0];
  assert.ok(target);
  const hit = lookupPick(target!.id, scan, snapshot);
  assert.ok(hit);
  assert.equal(hit!.id, target!.id);
});

test("2-leg and 3-leg parlays are named; 4-leg is catalog only", async () => {
  const { picks } = await bag();
  assert.ok(picks.two.length >= 1);
  assert.ok(picks.three.length >= 1);
  for (const p of [...picks.two, ...picks.three]) {
    assert.ok(p.parlay);
    assert.ok(p.chance > 0 && p.chance < 0.9);
    assert.ok(p.decimalPayout > 1);
  }
  if (picks.four.length) {
    assert.notEqual(picks.hero?.bucket, "parlay4");
  }
});

test("The Call prefers high-info markets — a 1st-inning 0.5 cannot beat a moneyline", async () => {
  const qInning = infoQuality({ bucket: "period", selection: "1st inning under 0.5", point: 0.5 });
  const qMl = infoQuality({ bucket: "popular", selection: "Baltimore to win", marketType: "ml" });
  assert.ok(qMl > 0.9);
  assert.ok(qInning < 0.45);
  const ml = ticketScore(0.58, -110, "neutral", qMl, 0.02);
  const inn = ticketScore(0.57, -110, "neutral", qInning, 0.04);
  assert.ok(ml > inn, `ML ${ml} should beat noisy inning ${inn}`);
});

test("hero is not a period slice, a parlay, or live", async () => {
  const { picks } = await bag();
  if (picks.hero) {
    assert.notEqual(picks.hero.bucket, "period");
    assert.ok(!picks.hero.parlay);
    assert.notEqual(picks.hero.row?.inPlay, true);
    assert.ok((picks.hero.infoQuality ?? 0) >= 0.72);
  }
});

test("calibrated chance keeps a moneyline, shrinks a thin period toward the book", async () => {
  const fair = 0.57;
  const implied = 0.524;
  const ml = calibratedChance(fair, implied, 1);
  const inn = calibratedChance(fair, implied, 0.36);
  assert.ok(Math.abs(ml - fair) < 0.002);
  assert.ok(inn < ml);
  assert.ok(inn > implied);
});

test("NFL dog +3.5 is a better key-number ticket than +2.5", async () => {
  assert.ok(keyNumberTilt("NFL", 3.5) > keyNumberTilt("NFL", 2.5));
  assert.ok(keyNumberTilt("NFL", -2.5) > keyNumberTilt("NFL", -3.5));
  assert.equal(keyNumberTilt("MLB", 3.5), 0);
});

test("Safest mood still refuses a period as The Call", async () => {
  const { picks } = await bag();
  const singles = [picks.hero, ...picks.popular, ...picks.props, ...picks.periods].filter(
    (p): p is NonNullable<typeof p> => Boolean(p),
  );
  const safe = pickHero(singles, picks.popular, "safe");
  if (safe) assert.notEqual(safe.bucket, "period");
});

test("in-play tickets cannot be The Call and take a quality haircut", async () => {
  const qLive = infoQuality({ bucket: "popular", selection: "Jays to win", marketType: "ml", inPlay: true });
  const qPre = infoQuality({ bucket: "popular", selection: "Jays to win", marketType: "ml" });
  assert.ok(qPre >= 0.99);
  assert.ok(qLive < 0.55);
  const { snapshot, scan } = await bag();
  for (const r of scan.rows) r.inPlay = true;
  const picks = buildDeskPicks(scan, snapshot);
  if (picks.hero) {
    assert.notEqual(picks.hero.row?.inPlay, true);
  }
  const livePool = [...picks.popular, ...picks.props, ...picks.periods];
  const hero = pickHero(livePool, picks.popular, "value");
  if (hero) assert.notEqual(hero.row?.inPlay, true);
});

test("same board twice produces the same ranking", async () => {
  const a = await bag();
  const b = await bag();
  assert.equal(a.picks.hero?.id, b.picks.hero?.id);
  assert.deepEqual(
    a.picks.all.map((p) => p.id),
    b.picks.all.map((p) => p.id),
  );
});

test("seeded sim is deterministic and unknown markets stand down", async () => {
  const { scan, picks } = await bag();
  assert.equal(
    picks.all.map((p) => `${p.id}|${p.chance.toFixed(6)}|${p.score.toFixed(6)}`).join("\n"),
    picks.all.map((p) => `${p.id}|${p.chance.toFixed(6)}|${p.score.toFixed(6)}`).join("\n"),
  );
  for (const r of scan.rows) {
    if (r.tag === "unknown_market" && !isCollegeSport(r.sport)) {
      assert.fail(`unexpected unknown_market: ${r.selection}`);
    }
  }
  if (picks.hero) {
    assert.notEqual(picks.hero.row?.inPlay, true);
    assert.ok(picks.hero.chance <= 0.99);
  }
});

test("ribbon is 2- or 3-leg mains only — no 4-leg gold badge", async () => {
  const { picks } = await bag();
  for (const p of picks.ribbon) {
    assert.ok(p.parlay);
    assert.ok(p.parlay!.legs.length === 2 || p.parlay!.legs.length === 3);
  }
});

test("closed-form quality is capped at 0.64 when sim does not emit", async () => {
  const b = await bag();
  const r = b.scan.rows.find((x) => x.marketType === "ml" && x.simFair == null);
  if (!r) {
    const withSim = b.scan.rows.find((x) => x.marketType === "ml" && x.simFair != null);
    assert.ok(withSim, "sample board should emit sim on mains when latent.ran");
    return;
  }
  const p = b.picks.popular.find((x) => x.row?.eventId === r.eventId);
  if (p) assert.ok(p.infoQuality <= 0.64);
});

test("Alvarez over 2.5 (Looked, quality 0.64, edge −2) cannot be The Call", async () => {
  const alvarez = stubPick({
    id: "alvarez-over-2.5",
    bucket: "prop",
    selection: "Yordan Alvarez over 2.5",
    chance: 0.52,
    implied: 0.54,
    edge: -0.02,
    infoQuality: 0.64,
    processLooked: true,
    decimalPayout: 1.91,
    player: "Yordan Alvarez",
  });
  assert.equal(pickHero([alvarez], [], "safe"), null);
  assert.equal(pickHero([alvarez], [], "value"), null);
  assert.equal(pickHero([alvarez], [], "pay"), null);
});

test("missing process stamp is Looked and cannot steal The Call", async () => {
  const missing = stubPick({
    id: "missing-process",
    selection: "Orioles to win",
    chance: 0.56,
    implied: 0.54,
    edge: 0.02,
    infoQuality: 0.9,
    decimalPayout: 1.83,
  });
  assert.equal(pickHero([missing], [], "value"), null);
});

test("a high-info ML with process Ran and a non-negative edge can be The Call", async () => {
  const ml = stubPick({
    id: "bal-ml",
    bucket: "popular",
    selection: "Baltimore to win",
    chance: 0.56,
    implied: 0.54,
    edge: 0.02,
    infoQuality: 0.99,
    processLooked: false,
    decimalPayout: 1.83,
  });
  assert.equal(pickHero([ml], [ml], "safe")?.id, "bal-ml");
  const live = stubPick({
    id: "live-ml",
    selection: "Jays to win",
    chance: 0.6,
    implied: 0.55,
    edge: 0.04,
    infoQuality: 0.9,
    processLooked: false,
    decimalPayout: 1.7,
    row: { inPlay: true } as import("./types.ts").ScanRow,
  });
  const period = stubPick({
    id: "inn",
    bucket: "period",
    selection: "1st inning under 0.5",
    chance: 0.62,
    implied: 0.55,
    edge: 0.04,
    infoQuality: 0.8,
    processLooked: false,
    decimalPayout: 1.7,
  });
  const underBook = stubPick({
    id: "under-book",
    selection: "Dodgers to win",
    chance: 0.51,
    implied: 0.54,
    edge: -0.03,
    infoQuality: 0.9,
    processLooked: false,
    decimalPayout: 1.83,
  });
  const alvarez = stubPick({
    id: "alvarez-over-2.5",
    bucket: "prop",
    selection: "Yordan Alvarez over 2.5",
    chance: 0.52,
    implied: 0.54,
    edge: -0.02,
    infoQuality: 0.64,
    processLooked: true,
    decimalPayout: 1.91,
  });
  assert.equal(pickHero([alvarez, live, period, underBook, ml], [ml], "value")?.id, "bal-ml");
  assert.equal(pickHero([alvarez, live, period, underBook], [], "safe"), null);
});

test("Load this ticket id round-trips through lookup and reconstructs custom legs", async () => {
  const { scan, snapshot, picks } = await bag();
  const two = picks.two[0] ?? picks.ribbon[0];
  assert.ok(two?.parlay);
  const id = two!.id;
  assert.match(id, /^p\d+__/);
  const hit = lookupPick(id, scan, snapshot);
  assert.ok(hit?.parlay);
  assert.equal(hit!.parlay!.legs.length, two!.parlay!.legs.length);
  const spreads = scan.rows.filter((r) => r.marketType === "spread" && !r.inPlay && r.tag !== "illegal_fl");
  const a = spreads[0];
  const b = spreads.find((r) => r.eventId !== a?.eventId);
  if (a && b) {
    const customId = parlayTicketIdFromLegs([a, b]);
    assert.match(customId, /^p2__/);
    const custom = lookupPick(customId, scan, snapshot);
    assert.ok(custom?.parlay);
    assert.equal(custom!.parlay!.legs.length, 2);
    assert.ok(custom!.chance > 0 && custom!.chance < 1);
    assert.ok(custom!.chance <= 0.99);
  }
});

test("unknown parlay leg still opens the slip and stands that leg down", async () => {
  const { scan, snapshot } = await bag();
  const row = scan.rows.find((r) => r.marketType === "ml" && !r.inPlay);
  assert.ok(row);
  const id = parlayTicketIdFromLegs([
    row!,
    { eventId: "missing-game", marketType: "ml", side: "home", selection: "Ghost to win" },
  ]);
  const hit = lookupPick(id, scan, snapshot);
  assert.ok(hit?.parlay);
  assert.equal(hit!.parlay!.legs.length, 2);
  assert.match(hit!.why, /Stood down/i);
});

test("forced live parlay still opens with a combined quality haircut", async () => {
  const { scan } = await bag();
  const mls = scan.rows.filter((r) => r.marketType === "ml" && !r.isProp && r.tag !== "illegal_fl");
  const a = mls[0];
  const b = mls.find((r) => r.eventId !== a?.eventId);
  assert.ok(a && b);
  a!.inPlay = true;
  const hit = deskPickFromLegRefs([a!, b!], scan);
  assert.ok(hit.parlay);
  assert.equal(hit.parlay!.legs.length, 2);
  assert.ok(hit.infoQuality <= 0.64);
  assert.match(hit.why, /Live/);
});

test("4-leg catalog id opens a parlay ticket", async () => {
  const { scan, snapshot, picks } = await bag();
  const four = picks.four[0];
  if (!four?.parlay) return;
  const hit = lookupPick(four.id, scan, snapshot);
  assert.ok(hit?.parlay);
  assert.equal(hit!.parlay!.legs.length, four.parlay.legs.length);
  assert.match(four.id, /^p\d+__/);
});

test("Popular keeps tonight's mains even when live games flood the board", async () => {
  const { scan, snapshot } = await bag();
  const events = [...new Set(scan.rows.filter((r) => r.marketType === "ml" && !r.isProp).map((r) => r.eventId))];
  const keep = events[0];
  assert.ok(keep);
  for (const r of scan.rows) {
    if (r.eventId !== keep) r.inPlay = true;
  }
  const next = buildDeskPicks(scan, snapshot);
  assert.ok(next.popular.length >= 1, "Popular cannot sit empty while a pre-game main is on the board");
  assert.ok(
    next.popular.some((p) => !p.row?.inPlay),
    "Tonight's pre-game mains beat live leftovers on Popular",
  );
});

test("ribbon tap reconstructs a 2-leg slip — combined ticket plus each leg on the board", async () => {
  const { scan, snapshot, picks } = await bag();
  const slip = picks.ribbon[0] ?? picks.two[0];
  assert.ok(slip?.parlay, "sample board should name a 2-leg slip");
  assert.ok(slip!.parlay!.legs.length === 2 || slip!.parlay!.legs.length === 3);
  const hit = lookupPick(slip!.id, scan, snapshot);
  assert.ok(hit?.parlay);
  assert.equal(hit!.parlay!.legs.length, slip!.parlay!.legs.length);
  assert.ok(hit!.chance > 0 && hit!.chance < 1);
  assert.ok(hit!.implied != null);
  for (const leg of hit!.parlay!.legs) {
    const row = scan.rows.find(
      (r) => r.eventId === leg.eventId && r.marketType === leg.marketType && r.side === leg.side,
    );
    assert.ok(row, `leg ${leg.selection} should be on the board`);
  }
});

test("Safest does not lead with a low-quality research 94% total", async () => {
  const junk = stubPick({
    id: "u12.5",
    selection: "Under 12.5 runs",
    chance: 0.94,
    infoQuality: 0.48,
    confidence: "low",
    researchOnly: true,
    tapeStamp: "research",
    decimalPayout: 1.06,
  });
  const tape = stubPick({
    id: "mets-spread",
    selection: "Mets +1.5",
    chance: 0.7,
    infoQuality: 0.94,
    confidence: "medium",
    tapeStamp: "photographed",
    decimalPayout: 1.91,
  });
  const ranked = sortByMood([junk, tape], "safe");
  assert.equal(ranked[0].id, "mets-spread");
  assert.notEqual(ranked[0].id, "u12.5");
});

test("spread parlay id reconstructs spreads, not moneyline TBA", async () => {
  const { scan, snapshot, picks } = await bag();
  const two = picks.two[0] ?? picks.ribbon[0];
  assert.ok(two?.parlay);
  const spreads = two!.parlay!.legs.every((l) => l.marketType === "spread")
    ? two
    : picks.two.find((p) => p.parlay?.legs.every((l) => l.marketType === "spread"));
  const target = spreads ?? two;
  assert.ok(target?.parlay);
  const hit = lookupPick(target!.id, scan, snapshot);
  assert.ok(hit?.parlay);
  assert.equal(hit!.parlay!.legs.length, target!.parlay!.legs.length);
  for (let i = 0; i < target!.parlay!.legs.length; i++) {
    assert.equal(hit!.parlay!.legs[i]!.marketType, target!.parlay!.legs[i]!.marketType);
    assert.match(hit!.selection, /\+|−|-|over|under|to win/i);
  }
  assert.doesNotMatch(hit!.selection, /^to win \+ to win$/i);
  assert.ok(Math.abs(hit!.chance - target!.chance) < 0.02);
});

test("quality badge is High ≥0.72, Med 0.55–0.71, Low <0.55 — chance does not rewrite it", async () => {
  assert.equal(qualityBand(0.72), "high");
  assert.equal(qualityBand(0.7), "medium");
  assert.equal(qualityBand(0.62), "medium");
  assert.equal(qualityBand(0.55), "medium");
  assert.equal(qualityBand(0.54), "low");
  assert.equal(confidenceOf(0.7, 0.37, 0.06), "medium");
  assert.equal(confidenceOf(0.62, 0.47), "medium");
  assert.equal(confidenceOf(0.54, 0.94, 0.2), "low");
});

test("catalog, lookup, and store-leg display share one combined %", async () => {
  const { scan, snapshot, picks } = await bag();
  const two = picks.two[0];
  assert.ok(two?.parlay);
  const shown = shownParlayChance(two!.parlay!);
  const hit = lookupPick(two!.id, scan, snapshot);
  assert.ok(hit);
  assert.equal(hit!.chance, shown);
  assert.equal(hit!.chance, two!.chance);
  const fromStore = shownParlayFromStoreLegs(two!.parlay!.legs);
  assert.ok(Math.abs(fromStore - shown) < 0.03);
});

test("reason line prints the displayed integer, not raw combinedFair", async () => {
  const { scan, snapshot, picks } = await bag();
  const slips = [...(picks.two ?? []), ...(picks.sgp ?? [])].filter(
    (p) => p.parlay && /Combined chance/i.test(p.parlay.reason),
  );
  assert.ok(slips.length >= 1);
  for (const slip of slips) {
    const hit = lookupPick(slip.id, scan, snapshot);
    assert.ok(hit?.parlay);
    const pct = formatChancePct(hit!.chance);
    assert.ok(pct);
    assert.equal(formatChancePct(shownParlayChance(hit!.parlay!)), pct);
    assert.match(hit!.why, new RegExp(pct!.replace("%", "\\s*%")));
    assert.match(hit!.parlay!.reason, new RegExp(pct!.replace("%", "\\s*%")));
    const rawTenths = `${(hit!.parlay!.combinedFair * 100).toFixed(1)}%`;
    if (rawTenths !== pct && `${Math.round(hit!.parlay!.combinedFair * 100)}%` !== pct) {
      assert.doesNotMatch(hit!.why, new RegExp(rawTenths.replace(".", "\\.")));
      assert.doesNotMatch(hit!.parlay!.reason, new RegExp(rawTenths.replace(".", "\\.")));
    }
  }
});

test("Safest column prefers 65% and falls back to the single highest if nobody clears it", async () => {
  const a = stubPick({ id: "a", selection: "A", chance: 0.71 });
  const b = stubPick({ id: "b", selection: "B", chance: 0.66 });
  const c = stubPick({ id: "c", selection: "C", chance: 0.52 });
  const d = stubPick({ id: "d", selection: "D", chance: 0.49 });
  const top = safestColumn([d, c, a, b], 3, 0.65);
  assert.deepEqual(
    top.map((p) => p.id),
    ["a", "b"],
  );
  assert.equal(top.every((p) => !p.safestFallback), true);

  const fallback = safestColumn([c, d], 3, 0.65);
  assert.equal(fallback.length, 1);
  assert.equal(fallback[0]?.id, "c");
  assert.equal(fallback[0]?.safestFallback, true);
  assert.equal(highestTodayLabel(fallback[0]!), "Highest Probability Today (52%)");
});

test("belowSixty flags under 60% and not 60%+", async () => {
  assert.equal(belowSixty(stubPick({ id: "u", selection: "U", chance: 0.59 })), true);
  assert.equal(belowSixty(stubPick({ id: "s", selection: "S", chance: 0.6 })), false);
});
