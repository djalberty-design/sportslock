# SPORTSLOCK: THE ALPHA REWRITE ROADMAP

This document outlines the step-by-step architectural rewrite of the SportsLock quantitative engine. We are transitioning from a Bottom-Up Bayesian Blender to a Top-Down Market Deviation (Alpha) Model.

To ensure the highest quality coding and prevent prompt-overload, we will build the universal mathematical foundation first, and then build sport-specific "Alpha Plugins" one by one.

## PHASE 1: The Core Mathematical Foundation (Sport-Agnostic)
*Goal: Re-wire the core engine so it never double-counts public information against the market.*
- [x] **Step 1.1: The Sharp Anchor (`chance.ts`)**
  - Tear down `poolLayers()`.
  - Establish the Sportsbook/Pinnacle line as the absolute, vig-free Prior (Baseline Probability).
- [x] **Step 1.2: The Alpha Hook System**
  - Build a secure injection pipeline where contextual data (weather, injuries) only alters the baseline if it triggers a "Market Inefficiency" flag.
- [x] **Step 1.3: The Steam Filter**
  - Track line velocity (Open vs. Current vs. Live) to differentiate sharp money steam from square public drift.

## PHASE 2: NFL & NCAAF (Gridiron Alpha Plugin)
*Goal: Implement football-specific mismatches and game scripts.*
- [x] **Step 2.1: Usage Ripple Reallocation (Props)**
  - When a WR/RB is out, mathematically reallocate their target/carry share to the backups and adjust the correlated QB passing yards.
- [x] **Step 2.2: Weather & Stadium Compounding**
  - Cross-reference wind-speed and precipitation with a team's run/pass ratio. (e.g., Heavy wind hurts a passing offense, but has zero effect on a heavy run offense).
- [x] **Step 2.3: Rest & Lookahead Spots**
  - Quantify short-week travel disadvantages and "lookahead" narrative spots.

## PHASE 3: NBA & NCAAB (Hardwood Alpha Plugin)
*Goal: Exploit pacing, referee tendencies, and star-player usage vacuums.*
- [x] **Step 3.1: Usage Rate Vacuum (Props)**
  - If a 30% usage rate star is out, distribute their field goal attempts, assists, and rebounds across the starting 5 based on historical floor-sharing data.
- [x] **Step 3.2: Referee Playstyle Compounding**
  - Cross-reference referee foul-rates (e.g., Scott Foster) with the specific foul-drawn/foul-committed rates of the two teams to exploit Game Totals.
- [x] **Step 3.3: NCAAB Late-Game Variance**
  - Refine the intentional fouling algorithms for close college basketball games.

## PHASE 4: MLB (Diamond Alpha Plugin)
*Goal: Exploit park factors, umpires, and bullpen exhaustion.*
- [x] **Step 4.1: Umpire Zone Compounding**
  - Match "Hitter-friendly" or "Pitcher-friendly" umpires against contact-pitchers vs. strikeout-pitchers.
- [x] **Step 4.2: Advanced Park Factors & Wind**
  - Compound wind direction against the specific stadium architecture (e.g., Wind blowing out at Wrigley Field).
- [x] **Step 4.3: Bullpen Exhaustion**
  - If a team's top 3 relievers threw 25+ pitches yesterday, aggressively fade them in the late innings.

## PHASE 5: The Monte Carlo SGP Sandbox
*Goal: Build the ultimate Same Game Parlay engine.*
- [x] **Step 5.1: Game Script Simulation**
  - Simulate 10,000 outcomes of a game (Blowout, Shootout, Defensive Grind).
- [x] **Step 5.2: Correlated SGP Pricing**
  - Use the simulation matrix to price SGPs (e.g., If Team A wins by 14+, Team A's RB goes Over rushing yards 78% of the time). Compare our true odds against the Sportsbook's SGP payout to find massive +EV edges.

---
*Execution Rule:* We will execute exactly ONE step per prompt to ensure pristine code quality, zero regressions, and maximum mathematical accuracy.
## PHASE 6: The Advanced Origination Expansion
*Goal: Inject cutting-edge syndicate-level variables (Narrative, Psychological, and Micro-Correlations) to find alpha the spreadsheets miss.*
- [ ] **Step 6.1: Narrative & Psychological Alpha (
arrative.ts)**
  - Revenge Game Vacuum: Usage spikes for players facing former teams.
  - Desperation Spot / Must-Win Multiplier: Teams on losing streaks avoiding elimination don't rest starters.
- [ ] **Step 6.2: Referee Grudges & Fatigue (officials.ts)**
  - The Grudge Matrix: Fade players facing notoriously antagonistic referees.
  - Umpire Fatigue: Widen strike zones for umpires on grueling back-to-back travel schedules.
- [ ] **Step 6.3: In-Game Micro-Correlations (Foul Trouble & Pace)**
  - Foul Trouble Ripple: Adjust props pre-game based on matchup foul-propensity (e.g., Rim-protector foul risk boosts opponent paint scoring).
- [ ] **Step 6.4: The Possession-Level Markov Chain (markov.ts)**
  - Build transition matrices to simulate possessions rather than just final scores.

## PHASE 7: The AI Parlay Constructor
*Goal: Autonomously generate the highest +EV parlays mathematically possible.*
- [x] **Step 7.1: The +EV Scanner & Correlation Engine**
  - Scan the board for maximum discrepancy between simFair and sportsbooks, then group positively correlated game scripts.
---

## Phase 8 & 9: The Syndicate Sandbox & Final Asymmetries
- [x] **Step 8.1: The Trench Mismatch (NFL):** Added O-Line vs D-Line pressure multipliers to QB props.
- [x] **Step 8.2: Pitch Arsenal Synergy (MLB):** Matched Batter heatmaps to Pitcher primary arsenals.
- [x] **Step 8.3: Goalie & Altitude Traps:** Added NHL Backup Goalie logic and NBA Extreme Altitude exhaustions.
- [x] **Step 9.1: Thermodynamics & Air Density:** Added temperature/humidity/altitude modifiers for totals and kickers.
- [x] **Step 9.2: Red Zone Stall:** Added kicker boosts against bend-but-dont-break defenses.
- [x] **Step 9.3: Referee Pace:** Added NBA/NCAAB whistle-rate adjustments to game totals.
- [x] **Step 9.4: Hostile Freshman Penalty:** Added psychological fade logic for NCAAF/NCAAB true freshmen in severe away environments.

---
**STATUS: THE QUANTITATIVE ENGINE (THE BRAIN) IS 100% COMPLETE.**