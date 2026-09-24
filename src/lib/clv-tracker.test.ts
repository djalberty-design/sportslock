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

test("computeClv accurately identifies positive Closing Line Value", () => {
  // Locked +120 (dec 2.20), Closed +105 (dec 2.05)
  // Got a higher payout than final consensus market price -> Positive CLV!
  const res = computeClv(120, 105);

  assert.equal(res.beatTheClosingLine, true);
  assert.ok(res.clvPct > 0);
  assert.ok(res.clvCents > 0);
});

test("computeClv flags negative CLV when market moves against pick", () => {
  // Locked -130 (dec 1.769), Closed -110 (dec 1.909)
  // Market drifted away -> Negative CLV
  const res = computeClv(-130, -110);

  assert.equal(res.beatTheClosingLine, false);
  assert.ok(res.clvPct < 0);
});

test("calculateBrierScore and evaluateBrierCalibration gauge forecasting precision", () => {
  // Strong forecast set where high confidence events hit
  const strong = [
    { fairProb: 0.80, hit: true },
    { fairProb: 0.75, hit: true },
    { fairProb: 0.30, hit: false },
    { fairProb: 0.70, hit: true },
    { fairProb: 0.20, hit: false },
  ];
  const brier = calculateBrierScore(strong);
  assert.ok(brier < 0.15);
  assert.equal(evaluateBrierCalibration(brier), "elite");

  // Pure coin flip set
  const coinFlips = [
    { fairProb: 0.50, hit: true },
    { fairProb: 0.50, hit: false },
    { fairProb: 0.50, hit: true },
    { fairProb: 0.50, hit: false },
  ];
  const coinBrier = calculateBrierScore(coinFlips);
  assert.equal(coinBrier, 0.25);
  assert.equal(evaluateBrierCalibration(coinBrier), "average");
});

test("calculatePortfolioStats tracks drawdown, high-water mark, and audit hash", () => {
  const records: ClvRecord[] = [
    { selection: "KC Chiefs -3.5", betPrice: -105, closingPrice: -120, hit: true, fairProb: 0.58 },
    { selection: "BOS Celtics ML", betPrice: -110, closingPrice: -125, hit: true, fairProb: 0.60 },
    { selection: "Over 218.5", betPrice: -110, closingPrice: -105, hit: false, fairProb: 0.52 },
    { selection: "LAL Lakers +4.5", betPrice: -110, closingPrice: -115, hit: true, fairProb: 0.54 },
  ];

  const { stats, curve } = calculatePortfolioStats(records);

  assert.equal(stats.totalBets, 4);
  assert.ok(stats.btclRate >= 70); // 3 of 4 beat the close
  assert.ok(stats.cumulativeUnits > 0);
  assert.ok(stats.highWaterMarkUnits >= stats.cumulativeUnits);
  assert.ok(stats.auditHash.startsWith("SL-AUDIT-"));
  assert.equal(curve.length, 4);
});

test("exportAuditLedger produces valid CSV and JSON outputs", () => {
  const records: ClvRecord[] = [
    { selection: "MIA Heat ML", betPrice: 140, closingPrice: 120, status: "WIN" },
  ];

  const csv = exportAuditLedger(records, "csv");
  assert.ok(csv.includes("ID,Timestamp,Sport,Market,Selection,Bet_Odds,Closing_Odds,CLV_Pct,Result,Status"));
  assert.ok(csv.includes("MIA Heat ML"));

  const json = exportAuditLedger(records, "json");
  const parsed = JSON.parse(json);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].selection, "MIA Heat ML");
});
