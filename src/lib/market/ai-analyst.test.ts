import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toolQueryProps,
  toolFetchTeamDVOA,
  toolCalculateCorrelatedParlay,
  toolSearchBestBets,
  executeAgentChat,
} from "./ai-analyst.ts";

test("toolCalculateCorrelatedParlay calculates Clayton Copula joint probability and Kelly sizing", () => {
  const result = toolCalculateCorrelatedParlay({
    legs: [
      {
        selection: "Boston Celtics -4.5",
        marketType: "spread",
        side: "home",
        price: -110,
        fairProb: 0.55,
        sport: "NBA",
      },
      {
        selection: "Jayson Tatum Over 26.5 Points",
        marketType: "prop",
        side: "home",
        price: -115,
        fairProb: 0.56,
        sport: "NBA",
      },
    ],
    bankroll: 2000,
    riskMode: "balanced",
  });

  assert.equal(result.legs.length, 2);
  assert.ok(result.combinedAmericanOdds > +200, "Combined odds should exceed +200");
  assert.ok(result.copulaJointProb > 0 && result.copulaJointProb <= 1);
  assert.ok(result.recommendedKellyUnits > 0);
  assert.ok(result.recommendedWagerDollars > 0);
  assert.equal(result.antiChalkViolations.length, 0);
  assert.match(result.mathematicalThesis, /Clayton Copula/i);
});

test("toolCalculateCorrelatedParlay flags anti-chalk violation for odds steeper than -400", () => {
  const result = toolCalculateCorrelatedParlay({
    legs: [
      {
        selection: "Heavy Favorite ML",
        marketType: "ml",
        price: -550, // dec ~ 1.18 < 1.25
        fairProb: 0.85,
      },
      {
        selection: "Standard Leg",
        marketType: "spread",
        price: -110,
        fairProb: 0.54,
      },
    ],
  });

  assert.equal(result.antiChalkViolations.length, 1);
  assert.match(result.antiChalkViolations[0]!, /Chalk Violation/i);
});

test("toolFetchTeamDVOA returns deterministic efficiency and tempo metrics", () => {
  const dvoa = toolFetchTeamDVOA({ team: "Celtics", sport: "NBA" });
  assert.equal(dvoa.team, "Celtics");
  assert.equal(dvoa.sport, "NBA");
  assert.ok(Number.isFinite(dvoa.offenseDvoaPct));
  assert.ok(Number.isFinite(dvoa.defenseDvoaPct));
  assert.ok(Number.isFinite(dvoa.pacePer48));
  assert.match(dvoa.summary, /Celtics/);
});

test("toolSearchBestBets returns ranked plays with factor waterfalls", () => {
  const res = toolSearchBestBets({ sport: "NBA", limit: 3 });
  assert.ok(res.bets.length > 0);
  const first = res.bets[0]!;
  assert.ok(first.edgePct > 0);
  assert.ok(first.waterfall != null);
  assert.ok(first.waterfall.marketAnchorProb > 0);
});

test("executeAgentChat handles parlay intent and returns structured parlay analysis", async () => {
  const res = await executeAgentChat("Build me a 3-leg NBA parlay with high EV");
  assert.ok(res.reply.length > 50);
  assert.ok(res.parlaySummary != null);
  assert.equal(res.parlaySummary.legs.length, 3);
  assert.ok(res.toolCalls.length > 0);
  assert.ok(res.suggestedFollowUps.length > 0);
});

test("executeAgentChat handles player prop inquiries", async () => {
  const res = await executeAgentChat("Find best player props for points tonight");
  assert.ok(res.reply.length > 50);
  assert.ok(res.toolCalls.some(t => t.tool === "queryPropMarket"));
});
