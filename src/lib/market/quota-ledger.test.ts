import assert from "node:assert/strict";
import { test } from "node:test";
import { decideOddsFetch, ODDS_SAFETY_CEILING, remainingToCeiling } from "./quota-ledger.ts";

test("fail-closed at the 400-call safety ceiling", () => {
  const hit = decideOddsFetch({ monthlyUsed: ODDS_SAFETY_CEILING, weeklyUsed: 0 });
  assert.equal(hit.action, "serve_stale");
  assert.equal(remainingToCeiling(399), 1);
  assert.equal(decideOddsFetch({ monthlyUsed: 399, weeklyUsed: 0 }).action, "fetch");
});

test("one heavy Sunday cannot spend the rest of the month", () => {
  const blocked = decideOddsFetch({ monthlyUsed: 50, weeklyUsed: 100, requestedCalls: 1 });
  assert.equal(blocked.action, "serve_stale");
  assert.match(blocked.reason, /Weekly/);
});
