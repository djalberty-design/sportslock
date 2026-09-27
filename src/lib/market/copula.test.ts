import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyPropFamily, growthScore, sameGameRho } from "./copula.ts";

test("Kelly multiplier scales growth without changing the zero-edge floor", () => {
  const full = growthScore(0.55, 2.0, 1.0, 1.0);
  const quarter = growthScore(0.55, 2.0, 1.0, 0.25);
  assert.ok(full > 0);
  assert.ok(Math.abs(quarter - full * 0.25) < 1e-9);
});

test("rushing and receiving yards do not classify as passing", () => {
  assert.equal(classifyPropFamily("Saquon Barkley over 80.5 rushing yards"), "rush");
  assert.equal(classifyPropFamily("CeeDee Lamb over 75.5 receiving yards"), "receiving");
  assert.equal(classifyPropFamily("Patrick Mahomes over 249.5 passing yards"), "pass");
  assert.notEqual(classifyPropFamily("Amon-Ra St. Brown over 70.5 rec yds"), "pass");
});

test("two-game eventIds stay distinct when building an SGP vs cross-game pair", () => {
  const rushOverMl = sameGameRho([
    { marketType: "prop", side: "over", selection: "Barkley over 80.5 rushing yards", fairProb: 0.52 },
    { marketType: "ml", side: "home", selection: "Eagles ML", fairProb: 0.58 },
  ]);
  const recvOverMl = sameGameRho([
    { marketType: "prop", side: "over", selection: "Lamb over 75.5 receiving yards", fairProb: 0.52 },
    { marketType: "ml", side: "home", selection: "Cowboys ML", fairProb: 0.58 },
  ]);
  const passOverMl = sameGameRho([
    { marketType: "prop", side: "over", selection: "Mahomes over 249.5 passing yards", fairProb: 0.52 },
    { marketType: "ml", side: "home", selection: "Chiefs ML", fairProb: 0.58 },
  ]);
  assert.notEqual(recvOverMl, passOverMl);
  assert.ok(rushOverMl !== passOverMl);
});
