import assert from "node:assert/strict";
import { test } from "node:test";
import { lastSeenClose } from "./honest-close.ts";

test("close is the later tape print, not an edge-invented move", () => {
  const lock = { eventId: "e1", marketType: "ml", side: "home", snappedAt: "2026-09-27T12:00:00.000Z", price: -110 };
  const close = lastSeenClose(lock, [
    lock,
    { eventId: "e1", marketType: "ml", side: "home", snappedAt: "2026-09-27T16:00:00.000Z", price: -125 },
    { eventId: "e1", marketType: "spread", side: "home", snappedAt: "2026-09-27T16:00:00.000Z", price: -105 },
  ]);
  assert.equal(close, -125);
});

test("missing later print does not invent a close from edge", () => {
  const lock = { eventId: "e1", marketType: "ml", side: "away", snappedAt: "2026-09-27T12:00:00.000Z", price: 150 };
  assert.equal(lastSeenClose(lock, [lock]), 150);
});
