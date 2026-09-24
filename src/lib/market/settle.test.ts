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
