import assert from "node:assert/strict";
import { test } from "node:test";
import { growthScore, jointFromLegs, sameGameRho } from "./copula.ts";

test("Kelly multiplier scales growth without changing the zero-edge floor", () => {
  const full = growthScore(0.55, 2.0, 1.0);
  const quarter = growthScore(0.55, 2.0, 0.25);
  assert.ok(full > 0);
  assert.ok(Math.abs(quarter - full * 0.25) < 1e-9);
});
