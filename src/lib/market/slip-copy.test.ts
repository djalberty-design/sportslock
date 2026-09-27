import assert from "node:assert/strict";
import { test } from "node:test";
import { slipCopyText } from "./slip-copy.ts";

test("copy text names both legs and Hard Rock", () => {
  const text = slipCopyText([
    {
      eventId: "e1",
      selection: "Kelce Over 55.5 Rec Yds",
      marketType: "prop",
      price: -115,
      fairProb: 0.54,
      sport: "NFL",
      home: "Ravens",
      away: "Chiefs",
    },
    {
      eventId: "e1",
      selection: "Hunt Over 45.5 Rush Yds",
      marketType: "prop",
      price: -110,
      fairProb: 0.53,
      sport: "NFL",
      home: "Ravens",
      away: "Chiefs",
    },
  ]);
  assert.match(text, /Kelce Over 55\.5 Rec Yds/);
  assert.match(text, /Hunt Over 45\.5 Rush Yds/);
  assert.match(text, /Hard Rock/);
});
