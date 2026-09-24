import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculatePureKellyFraction,
  calculateDynamicWager,
  RISK_PROFILES,
} from "./kelly.ts";

test("calculatePureKellyFraction returns 0 when no positive edge exists", () => {
  // 50% fair prob on -110 odds (implied 52.4%) -> negative EV -> Kelly 0
  const f = calculatePureKellyFraction(0.50, -110);
  assert.equal(f, 0);
});

test("calculatePureKellyFraction calculates correct positive Kelly on edge", () => {
  // 60% fair prob on +100 odds (even money: b=1)
  // f* = (0.60 * 1 - 0.40) / 1 = 0.20 (20%)
  const f = calculatePureKellyFraction(0.60, 100);
  assert.ok(Math.abs(f - 0.20) < 0.001);
});

test("calculateDynamicWager clamps between 0.25x and 4.00x base unit", () => {
  const baseUnit = 25.00;
  const bankroll = 1000.00;

  // Tiny edge or no edge: clamped to 0.25x base unit = $6.25
  const low = calculateDynamicWager({
    totalBankroll: bankroll,
    baseUnitSize: baseUnit,
    riskMode: "balanced",
    fairProb: 0.50,
    bookOdds: -110,
  });
  assert.equal(low.wagerDollars, 6.25);
  assert.equal(low.unitCount, 0.25);

  // Massive edge: e.g. 90% on +100 (f* = 80%)
  // Bankroll 1000 * (0.80 * 0.25) = 200, but clamped to 4x base unit = $100.00
  const high = calculateDynamicWager({
    totalBankroll: bankroll,
    baseUnitSize: baseUnit,
    riskMode: "balanced",
    fairProb: 0.90,
    bookOdds: 100,
  });
  assert.equal(high.wagerDollars, 100.00);
  assert.equal(high.unitCount, 4.00);
});

test("risk profiles scale fractional Kelly accordingly", () => {
  const bankroll = 1000.00;
  const baseUnit = 25.00;
  // 60% on -110 odds (b = 0.909, dec = 1.909)
  // f* = (0.6 * 0.909 - 0.4) / 0.909 = 0.160

  const conservative = calculateDynamicWager({
    totalBankroll: bankroll,
    baseUnitSize: baseUnit,
    riskMode: "conservative",
    fairProb: 0.60,
    bookOdds: -110,
  });

  const aggressive = calculateDynamicWager({
    totalBankroll: bankroll,
    baseUnitSize: baseUnit,
    riskMode: "aggressive",
    fairProb: 0.60,
    bookOdds: -110,
  });

  assert.ok(conservative.wagerDollars <= aggressive.wagerDollars);
  assert.equal(RISK_PROFILES.conservative.kellyMultiplier, 0.125);
  assert.equal(RISK_PROFILES.balanced.kellyMultiplier, 0.25);
  assert.equal(RISK_PROFILES.aggressive.kellyMultiplier, 0.50);
});
