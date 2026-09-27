import { test } from "node:test";
import * as assert from "node:assert";
import { applyMlbParkToMeans } from "./mlb-park.ts";

test("MLB Park: Coors Field in July drastically inflates scoring and adds chaos", () => {
  const result = applyMlbParkToMeans({
    sport: "MLB",
    parkRunFactor: 1.15,
    weatherTemp: 95,
    humidity: 30,
    barometricPressure: 24.5,
  });
  assert.equal(result.empty, false);
  assert.ok(result.muH > 1.25);
  assert.ok(result.muA > 1.25);
  assert.ok(result.chaosAdd > 0.02);
});

test("MLB Park: Oracle Park in April suppresses scoring", () => {
  const result = applyMlbParkToMeans({
    sport: "MLB",
    parkRunFactor: 0.94,
    weatherTemp: 52,
    humidity: 75,
    barometricPressure: 30.1,
  });
  assert.equal(result.empty, false);
  assert.ok(result.muH < 0.94);
  assert.ok(result.muA < 0.94);
  assert.equal(result.chaosAdd, 0);
});

test("MLB Park: pressure-missing game still computes park+temp and does not invent inHg", () => {
  const result = applyMlbParkToMeans({
    sport: "MLB",
    parkRunFactor: 1.15,
    weatherTemp: 85,
    humidity: 40,
    weatherWind: 12,
  });
  assert.equal(result.empty, false);
  assert.match(String(result.note), /pressure omitted/i);
});

test("MLB Park: Empty Look Law stands down when park factor is missing", () => {
  const result = applyMlbParkToMeans({
    sport: "MLB",
    weatherTemp: 70,
    humidity: 50,
    barometricPressure: 29.92,
  });
  assert.equal(result.empty, true);
  assert.equal(result.muH, 1);
  assert.equal(result.muA, 1);
  assert.equal(result.chaosAdd, 0);
});

test("MLB Park: Ignores non-MLB sports", () => {
  const result = applyMlbParkToMeans({
    sport: "NFL",
    parkRunFactor: 1.0,
    weatherTemp: 70,
    humidity: 50,
    barometricPressure: 29.92,
  });
  assert.equal(result.empty, true);
});
