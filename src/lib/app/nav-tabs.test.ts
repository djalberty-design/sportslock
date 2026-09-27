import assert from "node:assert/strict";
import { test } from "node:test";
import { isPrimaryTab, OFF_NAV_ROUTES, PRIMARY_TABS } from "./nav-tabs.ts";

test("primary nav is Board / Ticket / Ledger", () => {
  assert.deepEqual(
    PRIMARY_TABS.map((t) => t.label),
    ["Board", "Ticket", "Ledger"],
  );
  assert.deepEqual(
    PRIMARY_TABS.map((t) => t.to),
    ["/", "/ticket", "/results"],
  );
});

test("Lab, arbitrage, and matchups stay off the bar", () => {
  assert.equal(isPrimaryTab("/picks"), false);
  assert.equal(isPrimaryTab("/arbitrage"), false);
  assert.equal(isPrimaryTab("/games"), false);
  assert.ok(OFF_NAV_ROUTES.includes("/picks"));
});
