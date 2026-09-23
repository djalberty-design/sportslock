// @ts-nocheck
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  chanceWords,
  gradeParlay,
  headlineBelongsToGame,
  leanEnglish,
  matchParsedToRows,
  overlayQuotesWithTickets,
  parseEspnSummary,
  parseInternalEventId,
  blendHomeWin,
  enrichParlayPicks,
  leaderStatsFromCore,
  uniqueUpcomingGames,
  type ParlayPick,
} from "./research.ts";
import type { ParsedTicket, QuoteLine, ScanRow } from "./types.ts";
import { valueScore } from "./engine.ts";
import { isTodayEt } from "../utils.ts";

test("parses espn-NFL-id event keys", () => {
  assert.deepEqual(parseInternalEventId("espn-NFL-401872656"), { sport: "NFL", espnId: "401872656" });
  assert.equal(parseInternalEventId("nope"), null);
});

test("core team leaders stamp season stats onto roster ids", () => {
  const bag = leaderStatsFromCore({
    categories: [
      {
        name: "homeRuns",
        leaders: [{ value: 30, athlete: { $ref: "http://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/seasons/2026/athletes/39832" } }],
      },
      {
        name: "avg",
        leaders: [{ value: 0.301, athlete: { $ref: "http://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/seasons/2026/athletes/30193?lang=en" } }],
      },
      { name: "qualityStarts", leaders: [{ value: 19, athlete: { $ref: "http://x/athletes/1" } }] },
    ],
  });
  assert.equal(bag.get("39832")?.hr, 30);
  assert.equal(bag.get("30193")?.avg, 0.301);
  assert.equal(bag.get("1"), undefined);
});

test("ESPN summary parser reads predictor, injuries, weather", () => {
  const research = parseEspnSummary(
    {
      header: {
        competitions: [
          {
            date: "2026-09-07T17:05Z",
            competitors: [
              { homeAway: "home", team: { displayName: "Philadelphia Phillies" }, record: [{ type: "total", summary: "80-63" }] },
              { homeAway: "away", team: { displayName: "Atlanta Braves" }, record: [{ type: "total", summary: "85-58" }] },
            ],
          },
        ],
      },
      predictor: { homeTeam: { gameProjection: "61.5" }, awayTeam: { gameProjection: "38.5" } },
      gameInfo: { venue: { fullName: "Citizens Bank Park", address: { city: "Philadelphia", state: "Pennsylvania" } }, weather: { temperature: 78, precipitation: 0, gust: 9 } },
      injuries: [
        {
          team: { displayName: "Philadelphia Phillies" },
          injuries: [{ athlete: { displayName: "Tanner Banks" }, status: "60-Day-IL", details: { type: "Forearm", detail: "Strain" } }],
        },
      ],
      news: { articles: [{ headline: "Phillies host Braves" }] },
    },
    "espn-MLB-1",
    "MLB",
    "1",
  );
  assert.equal(research.home, "Philadelphia Phillies");
  assert.equal(research.away, "Atlanta Braves");
  assert.ok(Math.abs((research.espnHomeWin ?? 0) - 0.615) < 0.001);
  assert.match(research.weather ?? "", /78/);
  assert.equal(research.injuries[0]?.player, "Tanner Banks");
  assert.equal(research.headlines[0]?.title, "Phillies host Braves");
});

test("league-wide and other-game news is dropped from a matchup", () => {
  const research = parseEspnSummary(
    {
      header: {
        competitions: [
          {
            competitors: [
              { homeAway: "home", team: { displayName: "Pittsburgh Pirates", abbreviation: "PIT" } },
              { homeAway: "away", team: { displayName: "Los Angeles Angels", abbreviation: "LAA" } },
            ],
          },
        ],
      },
      article: {
        headline: "Pirates beat Angels 1-0",
        categories: [
          { type: "team", description: "Pittsburgh Pirates" },
          { type: "team", description: "Los Angeles Angels" },
          { type: "event", description: "Los Angeles Angels @ Pittsburgh Pirates", eventId: "401816827" },
        ],
      },
      news: {
        articles: [
          {
            headline: "Mookie Betts' late home run rallies Dodgers past Nationals",
            categories: [
              { type: "team", description: "Los Angeles Dodgers", team: { description: "Los Angeles Dodgers" } },
              { type: "team", description: "Washington Nationals" },
              { type: "event", eventId: "401816841", description: "Washington Nationals @ Los Angeles Dodgers" },
            ],
          },
          {
            headline: "White Sox bullpen throws gem in 10-1 win over Twins",
            categories: [
              { type: "team", description: "Chicago White Sox" },
              { type: "team", description: "Minnesota Twins" },
            ],
          },
          {
            headline: "2026 MLB ABS challenge system tracker",
            categories: [
              { type: "team", description: "Los Angeles Angels" },
              { type: "team", description: "Boston Red Sox" },
              { type: "team", description: "Chicago White Sox" },
              { type: "team", description: "Los Angeles Dodgers" },
              { type: "team", description: "New York Yankees" },
              { type: "team", description: "Atlanta Braves" },
              { type: "team", description: "Chicago Cubs" },
            ],
          },
        ],
      },
    },
    "espn-MLB-401816827",
    "MLB",
    "401816827",
  );
  assert.deepEqual(
    research.headlines.map((h) => h.title),
    ["Pirates beat Angels 1-0"],
  );
  assert.equal(
    headlineBelongsToGame(
      { headline: "Dodgers win", categories: [{ type: "team", description: "Los Angeles Dodgers" }] },
      "Los Angeles Angels",
      "Boston Red Sox",
    ),
    false,
  );
});

test("blend weights the market more than ESPN", () => {
  const b = blendHomeWin({ oddsHome: 0.6, espnHome: 0.4 });
  assert.ok(b);
  assert.ok(b.home > 0.5);
  assert.ok(b.home <= 0.6);
});

test("parlay grade multiplies independent chances", () => {
  const legs: ParlayPick[] = [
    { key: "a", eventId: "1", sport: "MLB", start: "", home: "H1", away: "A1", marketType: "ml", side: "home", selection: "H1", price: -150, fairProb: 0.6 },
    { key: "b", eventId: "2", sport: "MLB", start: "", home: "H2", away: "A2", marketType: "ml", side: "away", selection: "A2", price: -110, fairProb: 0.5 },
  ];
  const g = gradeParlay(legs);
  assert.ok(Math.abs(g.combinedFair - 0.3) < 1e-9);
  assert.equal(g.legs.length, 2);
  assert.equal(g.longshot, false);
});

test("four-leg parlay is flagged as a long shot", () => {
  const legs: ParlayPick[] = [0.55, 0.55, 0.55, 0.55].map((p, i) => ({
    key: String(i),
    eventId: String(i),
    sport: "NFL",
    start: "",
    home: "H",
    away: "A",
    marketType: "ml",
    side: "home",
    selection: "H",
    price: -120,
    fairProb: p,
  }));
  const g = gradeParlay(legs);
  assert.equal(g.longshot, true);
  assert.equal(g.entertainment, true);
  assert.ok(g.combinedFair < 0.12);
});

test("lean prefers the home side when both looks agree", () => {
  const lean = leanEnglish({ home: "Phillies", away: "Braves", oddsHome: 0.6, espnHome: 0.615 });
  assert.equal(lean.side, "home");
  assert.match(lean.title, /Phillies/);
  assert.doesNotMatch(lean.title, /lock/i);
});

test("screenshot legs match live board rows", () => {
  const row = {
    eventId: "espn-MLB-1",
    sport: "MLB",
    start: "2026-09-07T17:05Z",
    home: "Philadelphia Phillies",
    away: "Atlanta Braves",
    marketType: "ml",
    side: "home",
    selection: "Phillies",
    price: -171,
    fairProb: 0.603,
    evPct: -0.04,
    hold: 0.05,
    action: "stand_down",
    reason: "",
    conviction: "low",
    spark: "",
    tag: "juiced",
    inPlay: false,
    isProp: false,
  } as ScanRow;
  const picks = matchParsedToRows(
    [{ sport: "MLB", home: "Phillies", away: "Braves", marketType: "ml", side: "home", selection: "Phillies to win", price: -170 }],
    [row],
  );
  assert.equal(picks[0]?.eventId, "espn-MLB-1");
  assert.ok(Math.abs(picks[0]!.fairProb - 0.603) < 0.001);
});

test("chance words never claim a lock", () => {
  assert.match(chanceWords(0.8), /favorite/);
  assert.doesNotMatch(chanceWords(0.8), /lock|guarantee/i);
});

test("screenshot overlay replaces matching Hard Rock price", () => {
  const quotes: QuoteLine[] = [
    {
      eventId: "espn-MLB-1",
      sport: "MLB",
      start: new Date().toISOString(),
      home: "Philadelphia Phillies",
      away: "Atlanta Braves",
      marketType: "ml",
      side: "home",
      selection: "Phillies to win",
      price: -150,
      hardRockPrice: -150,
      source: "espn",
      delayed: true,
    },
  ];
  const tickets: ParsedTicket[] = [
    {
      sport: "MLB",
      home: "Phillies",
      away: "Braves",
      marketType: "ml",
      side: "home",
      selection: "Phillies to win",
      price: -165,
      confidence: 1,
      confirmed: true,
    },
  ];
  const out = overlayQuotesWithTickets(quotes, tickets);
  assert.equal(out[0]?.hardRockPrice, -165);
  assert.equal(out[0]?.price, -165);
  assert.equal(out[0]?.source, "screenshot");
});

test("player-bet parlay legs run the prop ensemble after a screenshot", () => {
  const picks: ParlayPick[] = [
    {
      key: "a",
      eventId: "espn-NFL-1",
      sport: "NFL",
      start: new Date(Date.now() + 36e5 * 12).toISOString(),
      home: "Kansas City Chiefs",
      away: "Las Vegas Raiders",
      marketType: "prop",
      side: "over",
      selection: "Patrick Mahomes over 249.5 passing yards",
      price: -115,
      fairProb: 0.535,
      point: 249.5,
      player: "Patrick Mahomes",
    },
  ];
  const rows: ScanRow[] = [
    {
      eventId: "espn-NFL-1",
      sport: "NFL",
      start: picks[0]!.start,
      home: "Kansas City Chiefs",
      away: "Las Vegas Raiders",
      marketType: "ml",
      side: "home",
      selection: "Chiefs",
      price: -180,
      fairProb: 0.62,
      evPct: -0.04,
      hold: 0.04,
      action: "stand_down",
      reason: "x",
      conviction: "low",
      spark: "n/a",
      tag: "juiced",
      inPlay: false,
      isProp: false,
      total: 52.5,
    },
  ];
  const out = enrichParlayPicks(picks, rows, [{ eventId: "espn-NFL-1", total: 52.5 }]);
  assert.equal(out[0]?.marketType, "prop");
  assert.ok(out[0]!.propReport);
  assert.equal(out[0]!.propReport!.stat, "pass_yds");
  assert.ok(out[0]!.fairProb > 0.3 && out[0]!.fairProb < 0.8);
});

test("a 58% ticket at −110 outranks an 80% favorite at −400", () => {
  assert.ok(valueScore(0.58, -110) > valueScore(0.8, -400));
});

test("isTodayEt is calendar-day Eastern, not 'sometime this week'", () => {
  const now = new Date();
  assert.equal(isTodayEt(now.toISOString(), now), true);
  const thursday = new Date(now.getTime() + 4 * 86400_000).toISOString();
  assert.equal(isTodayEt(thursday, now), false);
});

test("uniqueUpcomingGames keeps schedule-only and non-ML games — they do not vanish", () => {
  const start = new Date(Date.now() + 3 * 3600_000).toISOString();
  const spreadOnly: ScanRow = {
    eventId: "espn-NBA-1",
    sport: "NBA",
    start,
    home: "Heat",
    away: "Magic",
    marketType: "spread",
    side: "home",
    selection: "Heat -3.5",
    price: -110,
    fairProb: 0.52,
    evPct: 0,
    hold: 0.05,
    tag: "juiced",
    action: "stand_down",
    reason: "schedule",
    conviction: "low",
    spark: "",
    scheduleOnly: true,
  };
  const games = uniqueUpcomingGames([spreadOnly]);
  assert.equal(games.length, 1);
  assert.equal(games[0]!.eventId, "espn-NBA-1");
});


