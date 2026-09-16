import assert from "node:assert/strict";
import { test } from "node:test";
import { frechetBounds, frechetJoint, growthScore, jointFromLegs, sameGameRho } from "./copula.ts";

test("Fréchet bounds sandwich the independent product", () => {
  const { lo, hi, indep } = frechetBounds(0.6, 0.55);
  assert.ok(lo <= indep && indep <= hi);
  assert.ok(Math.abs(lo - 0.15) < 1e-9);
  assert.ok(Math.abs(hi - 0.55) < 1e-9);
});

test("positive rho lifts same-game joint above the product", () => {
  const indep = 0.6 * 0.55;
  const j = frechetJoint(0.6, 0.55, 0.42);
  assert.ok(j > indep);
  assert.ok(j <= 0.55);
});

test("ML + spread same side is positively correlated", () => {
  const rho = sameGameRho([
    { marketType: "ml", side: "away" },
    { marketType: "spread", side: "away" },
  ]);
  assert.ok(rho >= 0.25 && rho <= 0.48);
});

test("cross-game product is still the product (rho 0)", () => {
  assert.ok(Math.abs(jointFromLegs([0.6, 0.5], 0) - 0.3) < 1e-9);
});

test("Kelly growth is zero when the price is a bad deal", () => {
  assert.equal(growthScore(0.4, 1.91, 1), 0);
  assert.ok(growthScore(0.58, 1.91, 1) > 0);
});

test("Kelly multiplier scales growth without changing the zero-edge floor", () => {
  assert.equal(growthScore(0.4, 1.91, 1, 0.25), 0);
  const full = growthScore(0.58, 1.91, 1, 1);
  const quarter = growthScore(0.58, 1.91, 1, 0.25);
  assert.ok(full > 0);
  assert.ok(Math.abs(quarter - full * 0.25) < 1e-9);
});
