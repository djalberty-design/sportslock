// @ts-nocheck
import { test } from "node:test";
import * as assert from "node:assert";
import { applyNcaafBlowoutToMeans } from "./ncaaf-blowout.ts";

test("NCAAF: Elite powerhouse vs out-of-conference mismatch triggers dampener", () => {
  const result = applyNcaafBlowoutToMeans({
    sport: "NCAAF",
    homeTalentRating: 950, // e.g. Georgia
    awayTalentRating: 450, // e.g. FCS/Sun Belt
  });

  assert.equal(result.empty, false);
  
  // Delta is 500. This is well above 250 mismatchThreshold.
  // Dampen factor should scale heavily toward 0.90 for the home team
  assert.ok(result.muH <= 0.90);
  assert.equal(result.muA, 1.0); // Away team scoring mean unchanged by prevent defense dampener
  
  // Chaos injection should max out at +0.05
  assert.ok(result.chaosAdd >= 0.049);
});

test("NCAAF: Close conference matchup ignores blowout logic", () => {
  const result = applyNcaafBlowoutToMeans({
    sport: "NCAAF",
    homeTalentRating: 880, // e.g. Ohio State
    awayTalentRating: 860, // e.g. Penn State
  });

  assert.equal(result.empty, false);
  
  // Delta is 20. No dampener applied.
  assert.equal(result.muH, 1.0);
  assert.equal(result.muA, 1.0);
  assert.equal(result.chaosAdd, 0);
});

test("NCAAF: Empty Look Law respects missing data", () => {
  const result = applyNcaafBlowoutToMeans({
    sport: "NCAAF",
    homeTalentRating: 900,
    // awayTalentRating missing
  });

  assert.equal(result.empty, true);
  assert.equal(result.muH, 1.0);
});

test("NCAAF: Ignores non-NCAAF sports", () => {
  const result = applyNcaafBlowoutToMeans({
    sport: "NFL",
    homeTalentRating: 900,
    awayTalentRating: 200,
  });

  assert.equal(result.empty, true);
});
