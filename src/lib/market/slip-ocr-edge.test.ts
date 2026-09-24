import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectSportsbook,
  extractStakeAndPayout,
  reconcileLegsWithBoard,
  parseSlipImageEdge,
} from "./slip-ocr-edge.ts";

test("detectSportsbook identifies major sportsbook slip layouts", () => {
  assert.equal(detectSportsbook("Hard Rock Bet Florida App"), "Hard Rock Bet");
  assert.equal(detectSportsbook("DraftKings Sportsbook Wager ID 992"), "DraftKings");
  assert.equal(detectSportsbook("FanDuel Same Game Parlay"), "FanDuel");
  assert.equal(detectSportsbook("BetMGM Sportsbook Bet Confirmation"), "BetMGM");
  assert.equal(detectSportsbook("Caesars Palace Sportsbook"), "Caesars");
  assert.equal(detectSportsbook("Random Ticket"), "General");
});

test("extractStakeAndPayout extracts dollar amounts from ticket text", () => {
  const text1 = "Total Stake: $50.00 To Win: $145.50";
  const { stake: s1, payout: p1 } = extractStakeAndPayout(text1);
  assert.equal(s1, 50);
  assert.equal(p1, 145.5);

  const text2 = "Wager $25 Potential Payout: $72.50";
  const { stake: s2, payout: p2 } = extractStakeAndPayout(text2);
  assert.equal(s2, 25);
  assert.equal(p2, 72.5);
});

test("reconcileLegsWithBoard matches eventId from active board candidates", () => {
  const legs = [
    {
      sport: "NBA",
      selection: "Boston Celtics -4.5",
      marketType: "spread" as const,
      price: -110,
      confidence: 0.8,
    },
  ];

  const candidates = [
    {
      eventId: "nba_bos_mia_101",
      home: "Boston Celtics",
      away: "Miami Heat",
      sport: "NBA",
    },
  ];

  const reconciled = reconcileLegsWithBoard(legs, candidates);
  assert.equal(reconciled[0]!.eventId, "nba_bos_mia_101");
  assert.equal(reconciled[0]!.home, "Boston Celtics");
  assert.ok((reconciled[0]!.confidence || 0) >= 0.9);
});

test("parseSlipImageEdge completes edge extraction within performance budget", async () => {
  const start = Date.now();
  const res = await parseSlipImageEdge({
    image: "Hard Rock Bet Florida Miami Heat vs Boston Celtics Celtics -4.5 -110 Stake: $25.00 Payout: $48.50",
    activeCandidates: [
      {
        eventId: "evt_bos_mia",
        home: "Boston Celtics",
        away: "Miami Heat",
        sport: "NBA",
      },
    ],
  });
  const elapsed = Date.now() - start;

  assert.ok(res.ok);
  assert.equal(res.sportsbook, "Hard Rock Bet");
  assert.ok(res.legs.length > 0);
  assert.equal(res.matchedEventsCount, 1);
  assert.ok(elapsed < 500, `Expected sub-500ms execution, got ${elapsed}ms`);
});
