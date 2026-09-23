import assert from "node:assert/strict";
import { test } from "node:test";
import { DESK_VERSION } from "./rules.ts";
import { deskSeed, Pcg64 } from "./seed.ts";
import { FAIR_BLEND, blendFair, drawPaths, latentFromScores, simCover, simOver, simWin } from "./sim.ts";
import { isKnownMarket, unknownMarketReason } from "./registry.ts";

test("same seed yields the same path stream", () => {
  const g = latentFromScores({
    eventId: "nfl-kc-bal",
    sport: "NFL",
    homeWin: 0.57,
    total: 47.5,
    homeSpread: -3.5,
  });
  const a = drawPaths(g, "snap-1", 400);
  const b = drawPaths(g, "snap-1", 400);
  assert.equal(a.length, b.length);
  assert.equal(a[0]!.muH, b[0]!.muH);
  assert.equal(a[0]!.muA, b[0]!.muA);
  assert.equal(simWin(a).p, simWin(b).p);
});

test("desk seed is a pure function of version + snapshot + event", () => {
  const x = deskSeed(DESK_VERSION, "s", "e1");
  const y = deskSeed(DESK_VERSION, "s", "e1");
  const z = deskSeed(DESK_VERSION, "s", "e2");
  assert.equal(x, y);
  assert.notEqual(x, z);
});

test("PCG64 has no wall-clock entropy", () => {
  const a = new Pcg64(1n);
  const b = new Pcg64(1n);
  assert.equal(a.float(), b.float());
});

test("NFL simulation puts extra mass on key numbers like 3", () => {
  const g = latentFromScores({ eventId: "nfl-x", sport: "NFL", homeWin: 0.5, total: 44.5 });
  const paths = drawPaths(g, "snap");
  const c25 = simCover(paths, -2.5);
  const c35 = simCover(paths, -3.5);
  const diff3 = c25.p - c35.p;
  assert.ok(diff3 > 0.10, `expected key number 3 spike > 10%, got ${diff3}`);
});

test("blendFair is 50% sim + 30% pool + 20% market", () => {
  assert.equal(blendFair(0.4, 0.7, 0.6), FAIR_BLEND.sim * 0.4 + FAIR_BLEND.pool * 0.7 + FAIR_BLEND.market * 0.6);
});

test("blendFair missing sim renormalizes market + pool — never invents a 50/50 sim look", () => {
  const expected = (FAIR_BLEND.market * 0.55 + FAIR_BLEND.pool * 0.6) / (FAIR_BLEND.market + FAIR_BLEND.pool);
  assert.ok(Math.abs(blendFair(undefined, 0.6, 0.55) - expected) < 1e-9);
});

test("blendFair with no looks is 0.5 only because nothing ran", () => {
  assert.equal(blendFair(undefined, undefined, undefined), 0.5);
});

test("sim cover and over are path statistics", () => {
  const g = latentFromScores({ eventId: "mlb-1", sport: "MLB", homeWin: 0.55, total: 8.5 });
  const paths = drawPaths(g, "s", 800);
  const cover = simCover(paths, -1.5);
  const over = simOver(paths, 8.5);
  assert.ok(cover.p > 0.15 && cover.p < 0.85);
  assert.ok(over.p > 0.15 && over.p < 0.85);
});

test("unknown Hard Rock markets stand down", () => {
  assert.equal(isKnownMarket("Kansas City to win", "ml"), true);
  assert.equal(isKnownMarket("Player A anytime TD", "prop"), true);
  assert.equal(isKnownMarket("quantum spin prop xyz", "prop"), false);
  assert.match(unknownMarketReason("quantum spin prop xyz"), /Unknown Hard Rock market/);
});
