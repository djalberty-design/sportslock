# SPORTSLOCK: THE ALPHA REWRITE ROADMAP

This document outlines the step-by-step architectural rewrite of the SportsLock quantitative engine. We are transitioning from a Bottom-Up Bayesian Blender to a Top-Down Market Deviation (Alpha) Model.

To ensure the highest quality coding and prevent prompt-overload, we will build the universal mathematical foundation first, and then build sport-specific "Alpha Plugins" one by one.

## PHASE 1: The Core Mathematical Foundation (Sport-Agnostic)
*Goal: Re-wire the core engine so it never double-counts public information against the market.*
- [ ] **Step 1.1: The Sharp Anchor (`chance.ts`)**
  - Tear down `poolLayers()`.
  - Establish the Sportsbook/Pinnacle line as the absolute, vig-free Prior (Baseline Probability).
- [ ] **Step 1.2: The Alpha Hook System**
  - Build a secure injection pipeline where contextual data (weather, injuries) only alters the baseline if it triggers a "Market Inefficiency" flag.
- [ ] **Step 1.3: The Steam Filter**
  - Track line velocity (Open vs. Current vs. Live) to differentiate sharp money steam from square public drift.

## PHASE 2: NFL & NCAAF (Gridiron Alpha Plugin)
*Goal: Implement football-specific mismatches and game scripts.*
- [ ] **Step 2.1: Usage Ripple Reallocation (Props)**
  - When a WR/RB is out, mathematically reallocate their target/carry share to the backups and adjust the correlated QB passing yards.
- [ ] **Step 2.2: Weather & Stadium Compounding**
  - Cross-reference wind-speed and precipitation with a team's run/pass ratio. (e.g., Heavy wind hurts a passing offense, but has zero effect on a heavy run offense).
- [ ] **Step 2.3: Rest & Lookahead Spots**
  - Quantify short-week travel disadvantages and "lookahead" narrative spots.

## PHASE 3: NBA & NCAAB (Hardwood Alpha Plugin)
*Goal: Exploit pacing, referee tendencies, and star-player usage vacuums.*
- [ ] **Step 3.1: Usage Rate Vacuum (Props)**
  - If a 30% usage rate star is out, distribute their field goal attempts, assists, and rebounds across the starting 5 based on historical floor-sharing data.
- [ ] **Step 3.2: Referee Playstyle Compounding**
  - Cross-reference referee foul-rates (e.g., Scott Foster) with the specific foul-drawn/foul-committed rates of the two teams to exploit Game Totals.
- [ ] **Step 3.3: NCAAB Late-Game Variance**
  - Refine the intentional fouling algorithms for close college basketball games.

## PHASE 4: MLB (Diamond Alpha Plugin)
*Goal: Exploit park factors, umpires, and bullpen exhaustion.*
- [ ] **Step 4.1: Umpire Zone Compounding**
  - Match "Hitter-friendly" or "Pitcher-friendly" umpires against contact-pitchers vs. strikeout-pitchers.
- [ ] **Step 4.2: Advanced Park Factors & Wind**
  - Compound wind direction against the specific stadium architecture (e.g., Wind blowing out at Wrigley Field).
- [ ] **Step 4.3: Bullpen Exhaustion**
  - If a team's top 3 relievers threw 25+ pitches yesterday, aggressively fade them in the late innings.

## PHASE 5: The Monte Carlo SGP Sandbox
*Goal: Build the ultimate Same Game Parlay engine.*
- [ ] **Step 5.1: Game Script Simulation**
  - Simulate 10,000 outcomes of a game (Blowout, Shootout, Defensive Grind).
- [ ] **Step 5.2: Correlated SGP Pricing**
  - Use the simulation matrix to price SGPs (e.g., If Team A wins by 14+, Team A's RB goes Over rushing yards 78% of the time). Compare our true odds against the Sportsbook's SGP payout to find massive +EV edges.

---
*Execution Rule:* We will execute exactly ONE step per prompt to ensure pristine code quality, zero regressions, and maximum mathematical accuracy.