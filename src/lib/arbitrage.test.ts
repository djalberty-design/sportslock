import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateArbitrage,
  detectMiddle,
  scanArbitrageOpportunities,
  buildLineShoppingMatrix,
  SPORTSBOOKS,
} from "./arbitrage.ts";
import type { ScanRow } from "./market/types.ts";

test("calculateArbitrage detects risk-free arbitrage when sum < 1.0", () => {
  // Book A: +110 (dec 2.10)
  // Book B: +105 (dec 2.05)
  // Inv A = 1/2.1 = 0.47619
  // Inv B = 1/2.05 = 0.48780
  // Sum = 0.96399 (< 1.0) -> Arbitrage exists!
  const calc = calculateArbitrage(110, 105, 1000);

  assert.equal(calc.isArbitrage, true);
  assert.ok(calc.arbitrageSum < 1.0);
  assert.ok(calc.roiPct > 3.0);
  assert.ok(calc.guaranteedProfit > 30.0);

  // Verify total stake adds up
  assert.equal(Math.round(calc.stakeA + calc.stakeB), 1000);

  // Both returns should exceed initial $1000 stake
  assert.ok(calc.returnA >= 1030);
  assert.ok(calc.returnB >= 1030);
});

test("calculateArbitrage correctly rejects standard vig markets", () => {
  // Standard -110 / -110 market (4.76% vig)
  const calc = calculateArbitrage(-110, -110, 1000);

  assert.equal(calc.isArbitrage, false);
  assert.ok(calc.arbitrageSum > 1.0);
  assert.ok(calc.roiPct < 0);
  assert.ok(calc.guaranteedProfit <= 0);
});

test("detectMiddle accurately identifies point discrepancy windows", () => {
  // Over 215.5 vs Under 218.5 -> 3-point middle window
  const middle = detectMiddle(215.5, 218.5, "total");
  assert.equal(middle.isMiddle, true);
  assert.equal(middle.middlePoints, 3.0);

  // Identical lines -> no middle
  const noMiddle = detectMiddle(215.5, 215.5, "total");
  assert.equal(noMiddle.isMiddle, false);
  assert.equal(noMiddle.middlePoints, 0);
});

test("SPORTSBOOKS dictionary includes Hard Rock as legal Florida book", () => {
  assert.ok(SPORTSBOOKS.hardrock);
  assert.equal(SPORTSBOOKS.hardrock.isLegalFlorida, true);
  assert.equal(SPORTSBOOKS.draftkings.isLegalFlorida, false);
});

test("scanArbitrageOpportunities and buildLineShoppingMatrix process scan rows", () => {
  const dummyRows: ScanRow[] = [
    {
      eventId: "game-1",
      sport: "basketball_nba",
      marketType: "ml",
      selection: "Boston Celtics",
      side: "home",
      home: "Boston Celtics",
      away: "Miami Heat",
      price: 115,
      fairProb: 0.52,
    } as ScanRow,
    {
      eventId: "game-1",
      sport: "basketball_nba",
      marketType: "ml",
      selection: "Miami Heat",
      side: "away",
      home: "Boston Celtics",
      away: "Miami Heat",
      price: 105,
      fairProb: 0.48,
    } as ScanRow,
  ];

  const shopping = buildLineShoppingMatrix(dummyRows);
  assert.ok(Array.isArray(shopping));
  assert.equal(shopping.length, 2);
  assert.ok(shopping[0].bestPrice !== undefined);

  const opps = scanArbitrageOpportunities(dummyRows, 1000);
  assert.ok(Array.isArray(opps));
});
