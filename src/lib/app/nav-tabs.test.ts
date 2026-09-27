import assert from "node:assert/strict";
import { test } from "node:test";
import { isPrimaryTab, OFF_NAV_ROUTES, PRIMARY_TABS } from "./nav-tabs.ts";

test("primary nav is Picks / Lab / Games / Ticket / Ledger", () => {
  assert.deepEqual(
    PRIMARY_TABS.map((t) => t.label),
    ["Picks", "Lab", "Games", "Ticket", "Ledger"],
  );
  assert.deepEqual(
    PRIMARY_TABS.map((t) => t.to),
    ["/", "/picks", "/games", "/ticket", "/results"],
  );
});

test("arbitrage stays off the primary bar", () => {
  assert.equal(isPrimaryTab("/arbitrage"), false);
  assert.ok(OFF_NAV_ROUTES.includes("/arbitrage"));
  assert.equal(isPrimaryTab("/picks"), true);
  assert.equal(isPrimaryTab("/games"), true);
});
