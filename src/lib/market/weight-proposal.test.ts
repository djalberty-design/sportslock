import assert from "node:assert/strict";
import { test } from "node:test";
import { proposeWeightShift } from "./weight-proposal.ts";
import { WEIGHT_STEERING_FROZEN } from "./weight-freeze.ts";

test("proposals stay dry while steering is frozen", () => {
  assert.equal(WEIGHT_STEERING_FROZEN, true);
  const p = proposeWeightShift({
    n: 80,
    clvSample: 80,
    clvBeatRate: 40,
    modelBrier: 0.24,
    bookBrier: 0.22,
    brierDelta: 0.02,
    last30Units: -4,
    losingStretch: 3,
    caveat: "",
  });
  assert.equal(p.apply, false);
  assert.equal(p.marketDelta, 0);
});
