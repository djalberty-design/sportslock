import assert from "node:assert/strict";
import { test } from "node:test";
import { boardFreshness } from "./board-freshness.ts";

test("freshness badges move with age and never look live when stale", () => {
  const now = Date.parse("2026-09-27T12:00:00.000Z");
  assert.equal(boardFreshness("2026-09-27T11:50:00.000Z", now).kind, "fresh");
  assert.equal(boardFreshness("2026-09-27T08:00:00.000Z", now).kind, "aging");
  const stale = boardFreshness("2026-09-26T14:00:00.000Z", now);
  assert.equal(stale.kind, "stale");
  assert.match(stale.badge, /last valid board/i);
  const paused = boardFreshness("2026-09-25T12:00:00.000Z", now);
  assert.equal(paused.kind, "paused");
  assert.doesNotMatch(paused.badge, /live/i);
});
