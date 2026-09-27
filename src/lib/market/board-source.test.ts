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
