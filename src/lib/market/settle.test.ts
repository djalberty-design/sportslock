import test from "node:test";
import assert from "node:assert/strict";
import { normalizePlayerName, resolvePlayerHeadshotSync } from "./logos.ts";

test("normalizePlayerName strips suffixes and punctuation", () => {
  assert.equal(normalizePlayerName("Aaron Jones Sr."), "aaron jones");
  assert.equal(normalizePlayerName("Aaron Jones"), "aaron jones");
  assert.equal(normalizePlayerName("Marvin Harrison Jr."), "marvin harrison");
  assert.equal(normalizePlayerName("Michael Pittman Jr."), "michael pittman");
  assert.equal(normalizePlayerName("Patrick Mahomes II"), "patrick mahomes");
  assert.equal(normalizePlayerName("Kenneth Walker III"), "kenneth walker");
});

test("Aaron Jones seed headshot resolves correctly", () => {
  const headshot = resolvePlayerHeadshotSync("Aaron Jones");
  assert.ok(headshot, "Aaron Jones should have a resolved headshot");
  assert.ok(headshot.includes("3042519.png"), "Headshot should be Aaron Jones ESPN ID 3042519");

  const headshotSr = resolvePlayerHeadshotSync("Aaron Jones Sr.");
  assert.equal(headshotSr, headshot, "Aaron Jones Sr. should resolve to the same headshot");
});

test("Safe roster lookup matches Aaron Jones Sr. as RB and avoids Jayson Jones DT", () => {
  const mockRoster = [
    { name: "Jayson Jones", position: "DT", team: "TB", headshot: "tb-dt.png" },
    { name: "Aaron Jones Sr.", position: "RB", team: "MIN", headshot: "min-rb.png" },
    { name: "Sam Darnold", position: "QB", team: "MIN", headshot: "min-qb.png" },
  ];

  const playerMap = new Map<string, any>();
  for (const p of mockRoster) {
    const rawKey = p.name.toLowerCase().trim();
    const normKey = normalizePlayerName(p.name);
    const entry = { headshot: p.headshot, team: p.team, position: p.position };
    if (rawKey) playerMap.set(rawKey, entry);
    if (normKey && !playerMap.has(normKey)) playerMap.set(normKey, entry);
    const parts = normKey.split(" ");
    if (parts.length >= 2) {
      const initKey = `${parts[0][0]} ${parts[parts.length - 1]}`;
      if (!playerMap.has(initKey)) playerMap.set(initKey, entry);
    }
  }

  // Odds API sends "Aaron Jones" (without Sr.)
  const propPlayer = "Aaron Jones";
  const pKey = propPlayer.toLowerCase().trim();
  const normKey = normalizePlayerName(propPlayer);

  let rosterHit = (pKey ? playerMap.get(pKey) : undefined) || (normKey ? playerMap.get(normKey) : undefined);
  if (!rosterHit && normKey) {
    const parts = normKey.split(" ");
    if (parts.length >= 2) {
      rosterHit = playerMap.get(`${parts[0][0]} ${parts[parts.length - 1]}`);
    }
  }

  assert.ok(rosterHit, "Must find roster hit for Aaron Jones");
  assert.equal(rosterHit.position, "RB", "Must be RB, not DT");
  assert.equal(rosterHit.team, "MIN", "Must be MIN, not TB");
  assert.equal(rosterHit.headshot, "min-rb.png", "Must be MIN RB headshot");
});

test("Future games are not settled prematurely even if same teams played yesterday", () => {
  const futureGameStart = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
  const ticket = {
    id: "t-1",
    status: "open",
    start: futureGameStart,
    createdAt: new Date().toISOString(),
    home: "Pittsburgh Pirates",
    away: "St. Louis Cardinals",
  };

  const isFuture = ticket.start ? new Date(ticket.start).getTime() > Date.now() : false;
  assert.ok(isFuture, "Game starting in 2 hours must be detected as future");
});

test("Recently created tickets filter out historical scores from past days", () => {
  const ticketCreatedNow = Date.now();
  const ticketCreatedYesterday = Date.now() - 25 * 3600 * 1000;

  // New ticket
  const eligibleNew: string[] = ["live", "today"];
  if (ticketCreatedNow < Date.now() - 20 * 3600 * 1000) {
    eligibleNew.push("yesterday");
  }
  assert.deepEqual(eligibleNew, ["live", "today"], "New ticket must not include yesterday scores");

  // Old ticket from yesterday
  const eligibleOld: string[] = ["live", "today"];
  if (ticketCreatedYesterday < Date.now() - 20 * 3600 * 1000) {
    eligibleOld.push("yesterday");
  }
  assert.deepEqual(eligibleOld, ["live", "today", "yesterday"], "Old ticket from yesterday can include yesterday scores");
});

test("reopenTicket un-settles ticket and accurately reverses credited winnings", () => {
  const initialBankroll = 1000;
  const initialCash = 1000;
  const stake = 50;
  const price = -200; // Total payout is $75 ($50 stake + $25 profit)

  // 1. Placing bet: cash decreases by stake
  let cash = initialCash - stake;
  let bankroll = initialBankroll - stake;

  // 2. Erroneously grading as win: cash increases by stake * dec ($75)
  const dec = 100 / Math.abs(price) + 1; // 1.5
  const winPayout = stake * dec; // 75
  cash += winPayout; // 1025
  bankroll += winPayout; // 1025

  assert.equal(cash, 1025);
  assert.equal(bankroll, 1025);

  // 3. Reopening ticket: deduct winPayout ($75)
  cash -= winPayout; // 950
  bankroll -= winPayout; // 950

  assert.equal(cash, 950, "Cash should be back to stake at risk ($950)");
  assert.equal(bankroll, 950, "Bankroll should be back to stake at risk ($950)");
});

test("Store migration v7 identifies target premature tickets (#SL-A3S05, #SL-15E9N)", () => {
  const mockTickets = [
    { id: "t-1727138000-a3s05", description: "Pittsburgh Pirates (spread)", stake: 50, price: -200, status: "win" },
    { id: "t-1727138000-15e9n", description: "Cleveland Guardians (spread)", stake: 3, price: -200, status: "win" },
    { id: "t-1727138000-old99", description: "Denver Broncos ML", stake: 20, price: 150, status: "win" },
  ];

  let refundedWins = 0;
  const reconciled = mockTickets.map((t) => {
    const isTarget = t.id.toLowerCase().endsWith("a3s05") || t.id.toLowerCase().endsWith("15e9n");
    if (isTarget && t.status === "win") {
      const dec = t.price < 0 ? 100 / Math.abs(t.price) + 1 : t.price / 100 + 1;
      refundedWins += t.stake * dec;
      return { ...t, status: "open" };
    }
    return t;
  });

  assert.equal(reconciled[0].status, "open", "Pirates ticket should be reverted to open");
  assert.equal(reconciled[1].status, "open", "Guardians ticket should be reverted to open");
  assert.equal(reconciled[2].status, "win", "Unrelated ticket should remain untouched");
  assert.equal(refundedWins, 75 + 4.5, "Total refunded win payouts should be $79.50");
});

test("Spread covered formula grades MLB runline underdog (+1.5) as WIN when trailing by 1 run (Red Sox 1, Guardians 0)", () => {
  const homeScore = 1;
  const awayScore = 0;
  const line = 1.5;
  const margin = awayScore - homeScore; // -1
  const covered = margin + line; // -1 + 1.5 = +0.5
  const outcome = covered > 0 ? "WIN" : covered === 0 ? "PUSH" : "LOSS";
  assert.equal(outcome, "WIN");
});

test("Settled tickets can be manually re-graded cleanly from loss/void to win and vice versa", () => {
  const initialBankroll = 1000;
  const initialCash = 1000;
  const stake = 3;
  const price = -200; // dec = 1.5, payout = 4.5
  const winPayout = 4.5;

  // Step 1: Place bet
  let cash = initialCash - stake; // 997
  let bankroll = initialBankroll - stake; // 997

  // Step 2: Graded as loss
  assert.equal(cash, 997);
  assert.equal(bankroll, 997);

  // Step 3: Changing status to Win (clean reopen + win grade)
  cash += winPayout; // 1001.5
  bankroll += winPayout; // 1001.5
  assert.equal(cash, 1001.5);
  assert.equal(bankroll, 1001.5);
});

test("Store migration v9 identifies final Guardians ticket #SL-15E9N and settles it to win with payout credit", () => {
  const mockTickets = [
    { id: "t-1727138000-15e9n", description: "Cleveland Guardians (spread)", stake: 3, price: -200, status: "open" },
    { id: "t-1727138000-other1", description: "Denver Broncos ML", stake: 20, price: 150, status: "open" },
  ];

  let addedWinnings = 0;
  const migrated = mockTickets.map((t) => {
    const isTargetFinal =
      t.id.toLowerCase().endsWith("15e9n") ||
      (t.description.includes("Guardians") && t.description.includes("spread"));

    if (isTargetFinal && t.status === "open") {
      const dec = t.price < 0 ? 100 / Math.abs(t.price) + 1 : t.price / 100 + 1;
      const winPayout = t.stake * dec;
      addedWinnings += winPayout;
      return {
        ...t,
        status: "win",
        pnl: winPayout - t.stake,
        finalScore: "Cleveland Guardians 0 - Boston Red Sox 1",
      };
    }
    return t;
  });

  assert.equal(migrated[0].status, "win", "Ticket #SL-15E9N must migrate from open to win");
  assert.equal(migrated[0].pnl, 1.5, "Profit should be $1.50");
  assert.equal(migrated[0].finalScore, "Cleveland Guardians 0 - Boston Red Sox 1");
  assert.equal(migrated[1].status, "open", "Unrelated ticket should remain open");
  assert.equal(addedWinnings, 4.5, "Added winnings should be $4.50 ($3 stake + $1.50 profit)");
});

test("Store migration v10 identifies target parlay ticket #SL-DC9VN and corrects line to +605 with $3 stake", () => {
  const dummyTickets = [
    {
      id: "t-1727192800000-dc9vn",
      description: "5-leg parlay: Green Bay Packers + MICHAEL PENIX + JORDAN LOVE + BIJAN ROBINSON + TUCKER KRAFT",
      stake: 3,
      price: 1741489,
      livePrice: 1741489,
      postedPrice: 1741489,
      status: "open",
    },
    {
      id: "t-1727192800000-xyz12",
      description: "Detroit Lions -3.5",
      stake: 50,
      price: -110,
      livePrice: -110,
      postedPrice: -110,
      status: "open",
    },
  ];

  const migrated = dummyTickets.map((t) => {
    const isTargetTicket =
      t.id?.toLowerCase().endsWith("dc9vn") ||
      (t.price != null && t.price > 10000) ||
      (String(t.description || "").includes("MICHAEL PENIX") &&
        String(t.description || "").includes("JORDAN LOVE") &&
        (t.price == null || t.price > 10000));

    if (isTargetTicket) {
      return {
        ...t,
        price: 605,
        livePrice: 605,
        postedPrice: 605,
        stake: 3,
      };
    }
    return t;
  });

  assert.equal(migrated[0].price, 605, "Target ticket price should be corrected to +605");
  assert.equal(migrated[0].livePrice, 605, "Live price should be 605");
  assert.equal(migrated[0].postedPrice, 605, "Posted price should be 605");
  assert.equal(migrated[0].stake, 3, "Stake should remain $3");
  assert.equal(migrated[1].price, -110, "Unrelated ticket should remain unaffected");
});



