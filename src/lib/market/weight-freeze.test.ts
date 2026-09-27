import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldSteerWeights, WEIGHT_STEERING_FROZEN } from "./weight-freeze.ts";

test("weight steering stays frozen before Phase 4", () => {
  assert.equal(WEIGHT_STEERING_FROZEN, true);
  assert.equal(shouldSteerWeights(200, false), false);
  assert.equal(shouldSteerWeights(12, true), false);
  assert.equal(shouldSteerWeights(50, true), true);
});
