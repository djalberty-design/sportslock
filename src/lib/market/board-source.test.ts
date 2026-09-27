import assert from "node:assert/strict";
import { test } from "node:test";
import { pickBoardSource } from "./board-source.ts";

test("page load reads the stored board when it is still usable", () => {
  const now = Date.parse("2026-09-27T12:00:00.000Z");
  assert.equal(
    pickBoardSource({ storedAsOf: "2026-09-27T11:00:00.000Z", quotaAction: "fetch", now }),
    "stored",
  );
});

test("quota exhaustion always serves the last valid board", () => {
  assert.equal(
    pickBoardSource({
      storedAsOf: "2026-09-20T12:00:00.000Z",
      quotaAction: "serve_stale",
    }),
    "stored",
  );
});

test("empty store falls back to compute", () => {
  assert.equal(pickBoardSource({ storedAsOf: null, quotaAction: "fetch" }), "compute");
});

test("yesterday's stored board triggers compute on a new ET day when quota allows", () => {
  const now = Date.parse("2026-09-27T12:00:00.000Z"); // 8:00 AM ET Sunday
  const storedAsOf = "2026-09-26T23:00:00.000Z"; // 7:00 PM ET Saturday (13h old, would be 'stale' < 24h)
  assert.equal(
    pickBoardSource({ storedAsOf, quotaAction: "fetch", now }),
    "compute",
  );
});

test("yesterday's stored board stays stored when quota is exhausted", () => {
  const now = Date.parse("2026-09-27T12:00:00.000Z");
  const storedAsOf = "2026-09-26T23:00:00.000Z";
  assert.equal(
    pickBoardSource({ storedAsOf, quotaAction: "serve_stale", now }),
    "stored",
  );
});

