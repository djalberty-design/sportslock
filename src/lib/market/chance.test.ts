import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildChance,
  homeFieldLogit,
  invLogit,
  log5,
  logit,
  normalCdf,
  parseRecord,
  pythagoreanWp,
  spreadToWinProb,
} from "./chance.ts";

test("logit / invLogit round-trip near 0.6", () => {
  const p = 0.6;
  assert.ok(Math.abs(invLogit(logit(p)) - p) < 1e-6);
});

test("identical 0.6 looks stay near 0.6", () => {
  const r = buildChance({
    home: "Phillies",
    away: "Braves",
    sport: "MLB",
    oddsHome: 0.6,
    espnHome: 0.6,
    kalshiHome: 0.6,
    polyHome: 0.6,
  });
  assert.ok(r);
  assert.ok(Math.abs(r!.home - 0.6) < 0.02);
  assert.equal(r!.favorite, "home");
  assert.ok(r!.layers.some((l) => l.id === "kalshi"));
  assert.ok(r!.layers.some((l) => l.id === "polymarket"));
});

test("market prior outweighs a disagreeing ESPN model", () => {
  const r = buildChance({
    home: "Home",
    away: "Away",
    sport: "NFL",
    oddsHome: 0.6,
    espnHome: 0.4,
  });
  assert.ok(r);
  assert.ok(r!.home > 0.5);
  assert.ok(r!.home < 0.6);
  assert.ok(r!.layers.some((l) => l.id === "market"));
  assert.ok(r!.layers.some((l) => l.id === "espn"));
});

test("Kalshi and Polymarket show up as crowd layers, not sportsbook fills", () => {
  const r = buildChance({
    home: "Seahawks",
    away: "Patriots",
    sport: "NFL",
    oddsHome: 0.62,
    kalshiHome: 0.58,
    kalshiVolume: 4000,
    kalshiSpread: 0.02,
    polyHome: 0.625,
    polyVolume: 11000,
  });
  assert.ok(r);
  const crowd = r!.layers.filter((l) => l.family === "crowd");
  assert.equal(crowd.length, 2);
  assert.match(r!.because, /Kalshi/);
  assert.match(r!.because, /Polymarket/);
  assert.match(r!.because, /not a lock/i);
  assert.doesNotMatch(r!.because, /guarantee/i);
  assert.ok(r!.crowdHome != null);
});

test("thin Kalshi book is trusted less than a liquid one", () => {
  const thin = buildChance({
    home: "H",
    away: "A",
    sport: "MLB",
    oddsHome: 0.5,
    kalshiHome: 0.7,
    kalshiVolume: 8,
    kalshiSpread: 0.12,
  });
  const liquid = buildChance({
    home: "H",
    away: "A",
    sport: "MLB",
    oddsHome: 0.5,
    kalshiHome: 0.7,
    kalshiVolume: 80_000,
    kalshiSpread: 0.01,
  });
  assert.ok(thin && liquid);
  const thinP = thin!.layers.find((l) => l.id === "kalshi")!.precision;
  const liqP = liquid!.layers.find((l) => l.id === "kalshi")!.precision;
  assert.ok(liqP > thinP * 1.4);
  assert.ok(liquid!.home > thin!.home);
});

test("process layer always runs with a named source — empty is Looked, never invented", () => {
  const r = buildChance({
    home: "Phillies",
    away: "Braves",
    sport: "MLB",
    oddsHome: 0.55,
  });
  assert.ok(r);
  const process = r!.layers.find((l) => l.id === "process");
  assert.ok(process);
  assert.match(process!.label, /Statcast|Savant/i);
  assert.equal(process!.empty, true);
  assert.equal(process!.home, 0.5);
});

test("process Ran only when Statcast-family numbers are posted — ISO is not Statcast", () => {
  const r = buildChance({
    home: "Phillies",
    away: "Braves",
    sport: "MLB",
    oddsHome: 0.55,
    homeLooks: {
      team: "Phillies",
      season: { obp: 0.33, iso: 0.18, era: 3.4 },
    },
    awayLooks: {
      team: "Braves",
      season: { obp: 0.31, iso: 0.16, era: 3.9 },
    },
  });
  assert.ok(r);
  const process = r!.layers.find((l) => l.id === "process")!;
  assert.equal(process.empty, true);
  const ran = buildChance({
    home: "Phillies",
    away: "Braves",
    sport: "MLB",
    oddsHome: 0.55,
    homeLooks: { team: "Phillies", season: { xwoba: 0.34 } },
    awayLooks: { team: "Braves", season: { xwoba: 0.3 } },
  });
  assert.ok(ran);
  const p2 = ran!.layers.find((l) => l.id === "process")!;
  assert.equal(p2.empty, false);
  assert.ok(p2.home > 0.5);
});


test("log5 plus home field lifts an even matchup", () => {
  const raw = log5(0.5, 0.5);
  assert.ok(Math.abs(raw - 0.5) < 1e-9);
  const withHome = invLogit(logit(raw) + homeFieldLogit("NFL"));
  assert.ok(withHome > 0.53);
});

test("home/road splits do not double-count home field", () => {
  const r = buildChance({
    home: "Phillies",
    away: "Braves",
    sport: "MLB",
    homeSplit: "50-30",
    awaySplit: "30-50",
  });
  assert.ok(r);
  const log5Layer = r!.layers.find((l) => l.id === "log5");
  assert.ok(log5Layer);
  assert.match(log5Layer!.note, /do not add it twice/i);
});

test("better ERA on the home starter raises home chance", () => {
  const r = buildChance({
    home: "Phillies",
    away: "Braves",
    sport: "MLB",
    homeEra: 2.8,
    awayEra: 5.1,
    homeWhip: 1.05,
    awayWhip: 1.45,
  });
  assert.ok(r);
  const p = r!.layers.find((l) => l.id === "pitcher");
  assert.ok(p);
  assert.ok(p!.home > 0.58);
  assert.equal(r!.favorite, "home");
});

test("NFL home -7 spread implies a clear home favorite", () => {
  const p = spreadToWinProb(-7, "NFL");
  assert.ok(p > 0.68);
  assert.ok(p < 0.78);
  const toss = spreadToWinProb(0, "NFL");
  assert.ok(Math.abs(toss - 0.5) < 0.02);
});

test("normalCdf is symmetric and hits known points", () => {
  assert.ok(Math.abs(normalCdf(0) - 0.5) < 1e-4);
  assert.ok(Math.abs(normalCdf(1.96) - 0.975) < 2e-3);
  assert.ok(Math.abs(normalCdf(-1) - (1 - normalCdf(1))) < 1e-6);
});

test("pythagorean MLB rewards run differential", () => {
  const good = pythagoreanWp(800, 650, "MLB");
  const bad = pythagoreanWp(650, 800, "MLB");
  assert.ok(good && bad);
  assert.ok(good! > 0.58);
  assert.ok(bad! < 0.42);
});

test("NBA back-to-back rest layer hurts the tired home side", () => {
  const r = buildChance({
    home: "Celtics",
    away: "Heat",
    sport: "NBA",
    oddsHome: 0.5,
    homeRestDays: 1,
    awayRestDays: 3,
  });
  assert.ok(r);
  const rest = r!.layers.find((l) => l.id === "rest");
  assert.ok(rest);
  assert.ok(rest!.home < 0.48);
});

test("parseRecord ignores tiny samples", () => {
  assert.equal(parseRecord("1-0"), null);
  assert.ok(parseRecord("10-6"));
  assert.equal(parseRecord("10-6")!.wp, 10 / 16);
});

test("empty input still looks up every rule — 50/50, not a guess and not a skip", () => {
  const r = buildChance({ home: "A", away: "B", sport: "NFL" });
  assert.ok(r);
  assert.ok(Math.abs(r!.home - 0.5) < 0.06);
  for (const id of ["h2h", "venue-split", "defense", "form", "underlying", "steam", "platoon", "pitcher", "market"]) {
    const layer = r!.layers.find((l) => l.id === id);
    assert.ok(layer, `missing ${id}`);
  }
  assert.ok(r!.layers.find((l) => l.id === "h2h")?.empty);
  assert.ok(r!.layers.find((l) => l.id === "venue-split")?.empty);
});

test("live looks fire H2H, home/road, defense, platoon, underlying — same JSON, same ranking", () => {
  const looksHome = {
    team: "Phillies",
    abbr: "PHI",
    season: { ops: 0.71, obp: 0.31, iso: 0.16, era: 3.99, whip: 1.28, oppOps: 0.71 },
    vsOpp: { ops: 0.79, n: 6, era: 2.45 },
    home: { ops: 0.74 },
    last7: { ops: 0.81, iso: 0.2, obp: 0.34, era: 3.1 },
    vsLeft: { ops: 0.69 },
    vsRight: { ops: 0.73 },
  };
  const looksAway = {
    team: "Braves",
    abbr: "ATL",
    season: { ops: 0.74, obp: 0.32, iso: 0.18, era: 3.5, whip: 1.2, oppOps: 0.68 },
    vsOpp: { ops: 0.7, n: 6, era: 4.1 },
    away: { ops: 0.68 },
    last7: { ops: 0.7, iso: 0.14, obp: 0.3, era: 4.4 },
    vsLeft: { ops: 0.72 },
    vsRight: { ops: 0.75 },
  };
  const a = buildChance({
    home: "Phillies",
    away: "Braves",
    sport: "MLB",
    oddsHome: 0.55,
    homeLooks: looksHome,
    awayLooks: looksAway,
    homePitcherHand: "L",
    awayPitcherHand: "R",
    homeEra: 3.2,
    awayEra: 4.1,
  });
  const b = buildChance({
    home: "Phillies",
    away: "Braves",
    sport: "MLB",
    oddsHome: 0.55,
    homeLooks: looksHome,
    awayLooks: looksAway,
    homePitcherHand: "L",
    awayPitcherHand: "R",
    homeEra: 3.2,
    awayEra: 4.1,
  });
  assert.ok(a && b);
  assert.equal(a!.home, b!.home);
  assert.ok(a!.layers.some((l) => l.id === "h2h" && !l.empty));
  assert.ok(a!.layers.some((l) => l.id === "venue-split" && !l.empty));
  assert.ok(a!.layers.some((l) => l.id === "defense" && !l.empty));
  assert.ok(a!.layers.some((l) => l.id === "underlying" && !l.empty));
  assert.ok(a!.layers.some((l) => l.id === "platoon" && !l.empty));
});

test("recency-weighted form prefers the latest games", () => {
  const r = buildChance({
    home: "Home",
    away: "Away",
    sport: "NFL",
    lastFive: [
      {
        team: "Home",
        results: ["W", "W", "W", "L", "L"],
        games: [
          { result: "W", pf: 31, pa: 10, date: "2026-09-01" },
          { result: "W", pf: 28, pa: 14, date: "2026-08-25" },
          { result: "W", pf: 24, pa: 17, date: "2026-08-18" },
          { result: "L", pf: 13, pa: 27, date: "2026-08-11" },
          { result: "L", pf: 10, pa: 30, date: "2026-08-04" },
        ],
      },
      {
        team: "Away",
        results: ["L", "L", "L", "W", "W"],
        games: [
          { result: "L", pf: 10, pa: 31, date: "2026-09-01" },
          { result: "L", pf: 14, pa: 28, date: "2026-08-25" },
          { result: "L", pf: 17, pa: 24, date: "2026-08-18" },
          { result: "W", pf: 27, pa: 13, date: "2026-08-11" },
          { result: "W", pf: 30, pa: 10, date: "2026-08-04" },
        ],
      },
    ],
  });
  assert.ok(r);
  const form = r!.layers.find((l) => l.id === "form");
  const margin = r!.layers.find((l) => l.id === "margin");
  assert.ok(form && margin);
  assert.ok(form.home > 0.55);
  assert.ok(margin.home > 0.55);
});

test("because never claims a lock and names prediction markets as research", () => {
  const r = buildChance({
    home: "Phillies",
    away: "Braves",
    sport: "MLB",
    oddsHome: 0.72,
    espnHome: 0.7,
    kalshiHome: 0.69,
  });
  assert.ok(r);
  assert.match(r!.because, /not a lock/i);
  assert.doesNotMatch(r!.because, /guarantee/i);
  assert.match(r!.because, /research/i);
  assert.ok(r!.chance < 0.86);
});

test("80% tickets / 54% handle is a layer, not a copy-trade of 80%", () => {
  const r = buildChance({
    home: "Kansas City",
    away: "Baltimore",
    sport: "NFL",
    oddsHome: 0.57,
    ticketHome: 0.8,
    handleHome: 0.54,
    steam: true,
  });
  assert.ok(r);
  assert.ok(r!.layers.some((l) => l.id === "tickets"));
  assert.ok(r!.layers.some((l) => l.id === "handle"));
  assert.ok(r!.layers.some((l) => l.id === "steam"));
  assert.ok(r!.home < 0.7, `ensemble must not copy 80% tickets, got ${r!.home}`);
  assert.ok(r!.home > 0.48);
  assert.match(r!.layers.find((l) => l.id === "tickets")!.note, /never copy/i);
  const handle = r!.layers.find((l) => l.id === "handle")!;
  const tickets = r!.layers.find((l) => l.id === "tickets")!;
  assert.ok(handle.precision > tickets.precision);
});

test("scoring-margin efficiency layer shows up when both sides have points", () => {
  const r = buildChance({
    home: "Home",
    away: "Away",
    sport: "NFL",
    oddsHome: 0.55,
    homePf: 28,
    homePa: 20,
    awayPf: 21,
    awayPa: 24,
    homeRecord: "8-2",
    awayRecord: "5-5",
  });
  assert.ok(r);
  assert.ok(r!.layers.some((l) => l.id === "efficiency"));
  assert.ok(r!.layers.some((l) => l.id === "pythag"));
  assert.ok(r!.home > 0.52);
});

test("MLB bullpen fatigue on a back-to-back hurts the tired home side", () => {
  const r = buildChance({
    home: "Rockies",
    away: "Dodgers",
    sport: "MLB",
    oddsHome: 0.5,
    homeRestDays: 0.8,
    awayRestDays: 2,
  });
  assert.ok(r);
  const rest = r!.layers.find((l) => l.id === "rest");
  assert.ok(rest);
  assert.ok(rest!.home < 0.49);
});

test("last-10 scores are analysis of the live log, same games → same chance", () => {
  const lastFive = [
    {
      team: "Jays",
      results: ["W", "W", "L", "W", "W", "W", "L", "W", "L", "W"],
      games: [
        { result: "W", pf: 6, pa: 2, opponent: "BOS", homeAway: "home" as const },
        { result: "W", pf: 5, pa: 4, opponent: "NYY", homeAway: "away" as const },
        { result: "L", pf: 1, pa: 3, opponent: "TB", homeAway: "home" as const },
        { result: "W", pf: 8, pa: 3, opponent: "BAL", homeAway: "home" as const },
        { result: "W", pf: 4, pa: 1, opponent: "BOS", homeAway: "away" as const },
        { result: "W", pf: 7, pa: 2, opponent: "CLE", homeAway: "home" as const },
        { result: "L", pf: 0, pa: 4, opponent: "CWS", homeAway: "away" as const },
        { result: "W", pf: 3, pa: 2, opponent: "MIN", homeAway: "home" as const },
        { result: "L", pf: 2, pa: 5, opponent: "DET", homeAway: "away" as const },
        { result: "W", pf: 5, pa: 3, opponent: "KC", homeAway: "home" as const },
      ],
    },
    {
      team: "Athletics",
      results: ["L", "L", "W", "L", "L", "L", "W", "L", "W", "L"],
      games: [
        { result: "L", pf: 2, pa: 6, opponent: "HOU", homeAway: "away" as const },
        { result: "L", pf: 1, pa: 5, opponent: "SEA", homeAway: "home" as const },
        { result: "W", pf: 4, pa: 3, opponent: "TEX", homeAway: "away" as const },
        { result: "L", pf: 0, pa: 7, opponent: "HOU", homeAway: "home" as const },
        { result: "L", pf: 3, pa: 8, opponent: "NYY", homeAway: "away" as const },
        { result: "L", pf: 2, pa: 4, opponent: "LAA", homeAway: "home" as const },
        { result: "W", pf: 5, pa: 4, opponent: "CWS", homeAway: "away" as const },
        { result: "L", pf: 1, pa: 3, opponent: "MIN", homeAway: "home" as const },
        { result: "W", pf: 6, pa: 2, opponent: "KC", homeAway: "away" as const },
        { result: "L", pf: 2, pa: 5, opponent: "DET", homeAway: "home" as const },
      ],
    },
  ];
  const a = buildChance({
    home: "Jays",
    away: "Athletics",
    sport: "MLB",
    oddsHome: 0.55,
    lastFive,
  });
  const b = buildChance({
    home: "Jays",
    away: "Athletics",
    sport: "MLB",
    oddsHome: 0.55,
    lastFive,
  });
  assert.ok(a && b);
  assert.equal(a!.home, b!.home);
  assert.ok(a!.layers.some((l) => l.id === "form"));
  assert.ok(a!.layers.some((l) => l.id === "margin"));
  const form = a!.layers.find((l) => l.id === "form")!;
  assert.match(form.note, /live ESPN log|not a generated card/i);
  assert.match(form.label, /Last 10/);
});

test("Looked empty layers have zero precision — no 50/50 drag", () => {
  const r = buildChance({
    home: "Chiefs",
    away: "Raiders",
    sport: "NFL",
    oddsHome: 0.72,
  });
  assert.ok(r);
  const empty = r!.layers.filter((l) => l.empty);
  assert.ok(empty.length > 0);
  for (const l of empty) {
    assert.equal(l.precision, 0);
    assert.equal(l.home, 0.5);
  }
  assert.ok(r!.home > 0.62, `posterior ${r!.home} was dragged toward 50`);
});

test("Early-season NFL damping cuts form precision under 6 games", () => {
  const games = Array.from({ length: 3 }, () => ({ result: "W" as const, pf: 24, pa: 17 }));
  const r = buildChance({
    home: "Chiefs",
    away: "Raiders",
    sport: "NFL",
    oddsHome: 0.62,
    lastFive: [
      { team: "Chiefs", results: ["W", "W", "W"], games },
      { team: "Raiders", results: ["L", "L", "L"], games: games.map((g) => ({ ...g, result: "L" as const, pf: 17, pa: 24 })) },
    ],
  });
  assert.ok(r);
  const form = r!.layers.find((l) => l.id === "form");
  assert.ok(form);
  assert.ok(form!.precision < 1.3, `form precision ${form!.precision} was not damped`);
  assert.match(form!.note, /Early-season damping/);
});
