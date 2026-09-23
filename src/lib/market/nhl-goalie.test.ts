// @ts-nocheck
import { test } from "node:test";
import * as assert from "node:assert";
import { applyNhlGoalieToMeans } from "./nhl-goalie.ts";

test("NHL Iso: Elite goaltender facing exhausted road team correctly compresses total and spikes variance", () => {
  const result = applyNhlGoalieToMeans({
    sport: "NHL",
    homeGoalieGsax: 1.2, // Elite home goalie (e.g. Shesterkin/Hellebuyck)
    awayGoalieGsax: -0.1, // Average away goalie
    homeIsB2B: false,
    awayIsB2B: true, // Away team is tired
    awayTravelMiles: 1200, // Heavy travel
  });

  assert.equal(result.empty, false);
  
  // Home Goalie (1.2 GSAx) -> reduces away scoring
  // Away team B2B + heavy travel -> further reduces away scoring
  // muA should be heavily penalized (e.g. < 0.85)
  assert.ok(result.muA < 0.85);

  // Away Goalie (-0.1 GSAx) -> slightly inflates home scoring
  assert.ok(result.muH > 1.0);
  
  // Away team B2B + heavy travel -> spikes chaosAdd (up to +0.03 for empty net variance)
  assert.ok(result.chaosAdd > 0.02);
});

test("NHL Iso: Empty Look Law respects missing goalie data", () => {
  const result = applyNhlGoalieToMeans({
    sport: "NHL",
    homeGoalieGsax: 1.2,
    // awayGoalieGsax missing
  });

  assert.equal(result.empty, true);
  assert.equal(result.muH, 1.0);
  assert.equal(result.chaosAdd, 0);
});

test("NHL Iso: Ignores non-NHL sports", () => {
  const result = applyNhlGoalieToMeans({
    sport: "MLB",
    homeGoalieGsax: 1.2,
    awayGoalieGsax: 0.5,
  });

  assert.equal(result.empty, true);
});
