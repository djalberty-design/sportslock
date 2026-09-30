import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPublicScorecard, lossAttribution } from "./scorecard.ts";

test("CLV beat rate ignores picks with no real close", () => {
  const card = buildPublicScorecard([
    { recommended: true, oneSided: true, marketType: "ml", status: "WIN", modelProb: 0.55, marketPrice: -110, closePrice: -120 },
    { recommended: true, oneSided: true, marketType: "ml", status: "LOSS", modelProb: 0.58, marketPrice: -110, closePrice: null },
  ]);
  assert.equal(card.n, 2);
  assert.equal(card.clvSample, 1);
  assert.equal(card.clvBeatRate, 100);
  assert.match(card.caveat, /Sides and totals|real close/i);
});

test("loss with negative CLV is model error, beat-close loss is variance", () => {
  assert.equal(lossAttribution(-12, true), "model_error");
  assert.equal(lossAttribution(8, true), "variance");
  assert.equal(lossAttribution(null, true), "unknown_clv");
});

test("losing stretch stays on the scorecard", () => {
  const card = buildPublicScorecard([
    { status: "WIN", modelProb: 0.6, marketPrice: -110, closePrice: -115, recommended: true, oneSided: true, marketType: "ml" },
    { status: "LOSS", modelProb: 0.54, marketPrice: -110, closePrice: -108, recommended: true, oneSided: true, marketType: "ml" },
    { status: "LOSS", modelProb: 0.52, marketPrice: -110, closePrice: -105, recommended: true, oneSided: true, marketType: "ml" },
  ]);
  assert.equal(card.losingStretch, 2);
});
