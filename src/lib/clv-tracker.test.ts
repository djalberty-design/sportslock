import assert from "node:assert/strict";
import { test } from "node:test";
import {
  computeClv,
  calculateBrierScore,
  evaluateBrierCalibration,
  calculatePortfolioStats,
  exportAuditLedger,
  type ClvRecord,
} from "./clv-tracker.ts";

test("CLV cents: locked −105, closed −120 → +15 (favorite same-sign)", () => {
  const res = computeClv(-105, -120);
  assert.equal(res.clvCents, 15);
  assert.equal(res.beatTheClosingLine, true);
  assert.ok(res.clvPct > 0);
});

test("CLV cents: locked +150, closed +130 → +20 (dog same-sign)", () => {
  const res = computeClv(150, 130);
  assert.equal(res.clvCents, 20);
  assert.equal(res.beatTheClosingLine, true);
  assert.ok(res.clvPct > 0);
});

test("CLV cents: locked +100, closed −110 → +10 (plus-to-minus cross)", () => {
  const res = computeClv(100, -110);
  assert.equal(res.clvCents, 10);
  assert.equal(res.beatTheClosingLine, true);
});

test("computeClv accurately identifies positive Closing Line Value", () => {
  const res = computeClv(120, 105);
  assert.equal(res.beatTheClosingLine, true);
  assert.ok(res.clvPct > 0);
  assert.equal(res.clvCents, 15);
});

test("computeClv flags negative CLV when market moves against pick", () => {
  const res = computeClv(-130, -110);
  assert.equal(res.beatTheClosingLine, false);
  assert.ok(res.clvPct < 0);
});
