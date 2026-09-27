import assert from "node:assert/strict";
import { test } from "node:test";
import { getHardRockUrl, hardRockLastMile } from "./hard-rock-links.ts";

test("Hard Rock URL is a sport lobby, never a fabricated game page", () => {
  assert.equal(getHardRockUrl("NFL"), "https://www.hardrock.bet/sports/football/nfl");
  assert.doesNotMatch(getHardRockUrl("NFL Patriots Chiefs"), /patriots|chiefs/i);
});

test("copy text carries team, market, and price", () => {
  const mile = hardRockLastMile({
    sport: "NFL",
    matchup: "BUF vs KC",
    pick: "BUF -2.5",
    price: -110,
  });
  assert.equal(mile.kind, "lobby");
  assert.match(mile.copyText, /BUF -2\.5/);
  assert.match(mile.copyText, /-110/);
});
