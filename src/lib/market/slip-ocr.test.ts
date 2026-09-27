import assert from "node:assert/strict";
import { test } from "node:test";
import { detectSport, gradeParsedFields, parseSlipText, slipEventId } from "./slip-ocr.ts";

test("reads an NFL moneyline from messy OCR", () => {
  const r = parseSlipText("Hard Rock Bet Florida\nNFL\nChiefs vs Ravens\nKansas City to win  -115");
  assert.equal(r.fields.length, 1);
  assert.equal(r.fields[0].sport, "NFL");
  assert.equal(r.fields[0].marketType, "ml");
  assert.equal(r.fields[0].price, -115);
  assert.match(r.fields[0].selection.toLowerCase(), /chiefs|kansas/);
});

test("reads a player prop without a paid key", () => {
  const r = parseSlipText("Patrick Mahomes over 249.5 passing yards  -110  Chiefs at Ravens");
  assert.equal(r.fields[0].marketType, "prop");
  assert.equal(r.fields[0].side, "over");
  assert.equal(r.fields[0].point, 249.5);
  assert.match(r.fields[0].player ?? "", /Mahomes/);
});

test("reads a game total", () => {
  const r = parseSlipText("MLB Phillies vs Braves  Over 8.5  -105");
  assert.equal(r.fields[0].sport, "MLB");
  assert.equal(r.fields[0].marketType, "total");
  assert.equal(r.fields[0].side, "over");
  assert.equal(r.fields[0].point, 8.5);
});

test("detectSport uses stat words when the league label is missing", () => {
  assert.equal(detectSport("bottom 7th strikeout"), "MLB");
  assert.equal(detectSport("NCAAF Saturday"), "NCAAF");
});

test("two different matchups produce two different eventIds", () => {
  const a = slipEventId("Chiefs", "Ravens");
  const b = slipEventId("Eagles", "Cowboys");
  assert.equal(a, "chiefs-at-ravens");
  assert.equal(b, "eagles-at-cowboys");
  assert.notEqual(a, b);
});

test("a single straight bet grades without requiring a second leg", () => {
  const parsed = parseSlipText("Hard Rock Bet Florida\nNFL\nChiefs vs Ravens\nKansas City to win  -115");
  assert.equal(parsed.fields.length, 1);
  const graded = gradeParsedFields(parsed.fields, parsed.raw);
  assert.equal(graded.success, true);
  assert.equal(graded.legs.length, 1);
  assert.match(graded.legs[0].eventId, /at/);
});

test("two-leg parlay eventIds follow the real matchups, not a shared literal", () => {
  const chiefs = parseSlipText("NFL Chiefs at Ravens Kansas City to win -115").fields[0];
  const eagles = parseSlipText("NFL Eagles at Cowboys Philadelphia to win -120").fields[0];
  const graded = gradeParsedFields([chiefs, eagles], "two games");
  assert.equal(graded.legs.length, 2);
  assert.notEqual(graded.legs[0].eventId, graded.legs[1].eventId);
  assert.equal(graded.sameGame, false);
});
