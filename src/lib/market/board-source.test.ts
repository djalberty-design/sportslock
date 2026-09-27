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

test("a board saved yesterday is recomputed on a new ET day", () => {
  const now = Date.parse("2026-09-27T10:00:00.000-04:00");
  assert.equal(
    pickBoardSource({ storedAsOf: "2026-09-26T23:00:00.000-04:00", quotaAction: "fetch", now }),
    "compute",
  );
});

test("quota exhaustion still serves yesterday board", () => {
  const now = Date.parse("2026-09-27T10:00:00.000-04:00");
  assert.equal(
    pickBoardSource({ storedAsOf: "2026-09-26T23:00:00.000-04:00", quotaAction: "serve_stale", now }),
    "stored",
  );
});
