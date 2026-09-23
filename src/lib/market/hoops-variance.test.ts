import { test } from "node:test";
import * as assert from "node:assert";
import { applyHoopsVarianceToMeans } from "./hoops-variance.ts";

test("Hoops Var: Tired team facing elite perimeter defense experiences scoring suppression and variance bump", () => {
  const result = applyHoopsVarianceToMeans({
    sport: "NCAAB",
    homeThreePointRate: 0.35, // Average volume
    awayThreePointRate: 0.45, // High volume (Boston Celtics style)
    homeOppThreePtAllowed: 0.32, // Elite perimeter defense
    awayOppThreePtAllowed: 0.38, // Average defense
    homeRestDays: 2, // Well rested
    awayRestDays: 0, // Tired legs (B2B)
  });

  assert.equal(result.empty, false);
  
  // Home team is rested and doesn't trigger mismatch (3P% is 0.35). Multiplier = 1.0.
  assert.equal(result.muH, 1.0);
  
  // Away team is exhausted (B2B -> 0.965) and facing elite defense (0.45 > 0.40 and 0.32 < 0.35 -> penalty)
  // Overall multiplier should be heavily suppressed (< 0.95)
  assert.ok(result.muA < 0.95);
  
  // Away team's mismatch should trigger up to +0.02 variance
  assert.ok(result.chaosAdd > 0.01);
});

test("Hoops Var: Empty Look Law strictly enforces missing advanced metrics", () => {
  const result = applyHoopsVarianceToMeans({
    sport: "NCAAB",
    homeThreePointRate: 0.42,
    awayThreePointRate: 0.33,
    homeOppThreePtAllowed: 0.38,
    // missing awayOppThreePtAllowed
  });

  assert.equal(result.empty, true);
  assert.equal(result.muH, 1.0);
  assert.equal(result.chaosAdd, 0);
});

test("Hoops Var: Ignores non-basketball sports", () => {
  const result = applyHoopsVarianceToMeans({
    sport: "NFL",
    homeThreePointRate: 0.42,
    awayThreePointRate: 0.42,
    homeOppThreePtAllowed: 0.32,
    awayOppThreePtAllowed: 0.32,
  });

  assert.equal(result.empty, true);
});
