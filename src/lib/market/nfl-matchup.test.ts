// @ts-nocheck
import { test } from "node:test";
import * as assert from "node:assert";
import { applyNflToMeans } from "./nfl-matchup.ts";

test("NFL Iso: Patriots late-season high wind & trench mismatch applies correct decay", () => {
  const result = applyNflToMeans(
    {
      sport: "NFL",
      home: "Patriots",
      away: "Bills",
      // Patriots Offense (home)
      homeQbEpa: 0.12,
      homeQbIsBackup: true,
      homeBackupQbEpa: -0.05, // significant dropoff
      homePassBlockWinRate: 48,
      
      // Bills Defense (away)
      awayPassRushWinRate: 52, // Mismatch: 52 - 48 = +4 (> -5)
      
      // Bills Offense (away)
      awayQbEpa: 0.25,
      awayQbIsBackup: false,
      awayPassBlockWinRate: 65,
      
      // Patriots Defense (home)
      homePassRushWinRate: 40,
      
      // Severe weather
      windSpeed: 22,
    },
    20, // baseMuH
    24  // baseMuA
  );

  assert.equal(result.empty, false);
  
  // Home (Patriots) should have massive penalties: QB EPA drop + Wind Decay + Trench Mismatch
  assert.ok(result.muH < 0.85); // Significant fractional multiplier reduction
  
  // Away (Bills) has no QB drop, no trench mismatch, only Wind Decay
  assert.ok(result.muA < 1.0); 
  assert.ok(result.muA > result.muH); // Patriots hurt worse
  
  // Chaos injection from wind and trench
  assert.ok(result.chaosAdd >= 0.04);
});

test("NFL Iso: Empty Look Law correctly stands down missing metrics", () => {
  const result = applyNflToMeans(
    {
      sport: "NFL",
      homeQbEpa: 0.10, // Missing other required metrics
    },
    24,
    24
  );
  
  assert.equal(result.empty, true);
  assert.equal(result.muH, 1);
  assert.equal(result.muA, 1);
  assert.equal(result.chaosAdd, 0);
});

test("NFL Iso: Ignore non-NFL sports", () => {
  const result = applyNflToMeans(
    {
      sport: "NBA",
      homeQbEpa: 0.10,
      awayQbEpa: 0.10,
      homePassBlockWinRate: 60,
      awayPassBlockWinRate: 60,
      homePassRushWinRate: 40,
      awayPassRushWinRate: 40,
    },
    110,
    110
  );
  
  assert.equal(result.empty, true);
});
