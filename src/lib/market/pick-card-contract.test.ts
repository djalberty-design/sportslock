import assert from "node:assert/strict";
import { test } from "node:test";
import {
  confidenceGrade,
  edgePct,
  formatAmerican,
  formatLineAge,
  kellyStakeDollars,
  ticketCopyText,
  toPickCardView,
} from "./pick-card-contract.ts";

test("visible card contract is pick / Hard Rock price / one edge / one stake / grade U", () => {
  const view = toPickCardView(
    {
      selection: "CLE ML",
      sport: "NFL",
      chance: 0.48,
      implied: 0.432,
      edge: 0.048,
      price: 125,
      home: "CIN",
      away: "CLE",
      start: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
    },
    { bankroll: 200, unit: 20, now: Date.now() },
  );
  assert.equal(view.pick, "CLE ML");
  assert.equal(view.book, "Hard Rock");
  assert.equal(view.price, 125);
  assert.equal(view.edgePct, 4.8);
  assert.equal(view.confidenceGrade, "U");
  assert.equal(typeof view.kellyStake, "number");
  assert.ok((view.kellyStake as number) > 0);
  assert.match(view.copyText, /CLE ML/);
  assert.match(view.copyText, /Hard Rock \+125/);
});

test("grade stays U until Phase 4 buckets exist", () => {
  assert.equal(confidenceGrade({ confidence: "A" }), "U");
});

test("copy line is team / market / book / price — not a deep link", () => {
  assert.equal(
    ticketCopyText({ pick: "CLE ML", book: "Hard Rock", price: 125, matchup: "CLE vs CIN" }),
    "CLE vs CIN · CLE ML · Hard Rock +125",
  );
  assert.equal(formatAmerican(-110), "-110");
  assert.equal(formatLineAge(420), "7m old");
});

test("edgePct prefers stored edge and does not invent a second number", () => {
  assert.equal(edgePct({ edge: 0.048, chance: 0.5, implied: 0.4 }), 4.8);
  assert.equal(kellyStakeDollars({ bankroll: 0, unit: 10, fairProb: 0.55, bookOdds: -110 }), null);
});
