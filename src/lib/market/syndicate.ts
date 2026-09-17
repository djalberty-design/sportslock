import { clip } from "./math.ts";
import type { PropLayer } from "./types.ts";

/**
 * Phase 8: The Syndicate Sandbox
 * Ultra-specific, high-alpha edge cases that standard models ignore.
 */

// 1. NFL: The Trench Mismatch
export function applyTrenchMismatch(stat: string, oLineRank?: number, dLineRank?: number): PropLayer | null {
  if (oLineRank == null || dLineRank == null) return null;
  
  const pressureDifferential = oLineRank - dLineRank; // e.g. 30 - 3 = +27 (Massive defensive advantage)
  
  if (pressureDifferential >= 15) { // Defense has a massive trench advantage
    if (stat === "pass_yds" || stat === "pass_td" || stat === "rush_yds") {
      return {
        id: "trench_advantage_defense",
        label: "Trench Mismatch (Under Pressure)",
        p: 0.35, // Skew under
        precision: 4.0,
        family: "alpha",
        note: `[ALPHA] Severe Trench Mismatch: O-Line (${oLineRank}) vs D-Line (${dLineRank}). Expect high pressure & low output.`,
      };
    }
  } else if (pressureDifferential <= -15) { // Offense has massive trench advantage
    if (stat === "rush_yds" || stat === "pass_yds") {
       return {
        id: "trench_advantage_offense",
        label: "Trench Mismatch (Clean Pocket)",
        p: 0.65, // Skew over
        precision: 4.0,
        family: "alpha",
        note: `[ALPHA] Elite Trench Mismatch: O-Line (${oLineRank}) will dominate D-Line (${dLineRank}).`,
      };
    }
  }
  return null;
}

// 2. MLB: Pitch Arsenal vs Batter Heatmap
export function applyPitchArsenalSynergy(stat: string, batterStrength?: string, pitcherPrimary?: string): PropLayer | null {
  if (!batterStrength || !pitcherPrimary) return null;
  const isHitProp = stat === "hits" || stat === "total_bases" || stat === "hr" || stat === "rbi";
  
  if (batterStrength === pitcherPrimary) {
    if (isHitProp) {
      return {
        id: "arsenal_synergy_positive",
        label: "Pitch Arsenal Synergy",
        p: 0.62,
        precision: 3.5,
        family: "alpha",
        note: `[ALPHA] Synergy: Batter crushes the pitcher's primary pitch (${pitcherPrimary}).`,
      };
    }
  } else if (batterStrength !== pitcherPrimary) {
    // If pitcher relies heavily on something the batter struggles with
    if (isHitProp) {
      return {
        id: "arsenal_synergy_negative",
        label: "Pitch Arsenal Mismatch",
        p: 0.38,
        precision: 3.5,
        family: "alpha",
        note: `[ALPHA] Mismatch: Batter struggles heavily against pitcher's primary pitch (${pitcherPrimary}).`,
      };
    }
  }
  return null;
}

// 4. NBA: Defensive Scheme Splits
export function applyDefensiveSchemeSplit(stat: string, playerStyle?: string, defenseScheme?: string): PropLayer | null {
  if (!playerStyle || !defenseScheme) return null;
  
  if (playerStyle === "Shooter" && defenseScheme === "Drop_Coverage") {
    if (stat === "points" || stat === "threes" || stat === "pra") {
      return {
        id: "scheme_mismatch",
        label: "Scheme Mismatch",
        p: 0.62,
        precision: 3.5,
        family: "alpha",
        note: `[ALPHA] Scheme Edge: Elite perimeter shooter facing drop-coverage scheme (Open 3s).`,
      };
    }
  }
  return null;
}
/**
 * Phase 9: The Final Asymmetries
 * Thermodynamics, College Psychology, Red Zone Math, and Pace.
 */

// 1. Air Density & Thermodynamics
export function applyAirDensityMultiplier(sport: string, temp?: number, humidity?: number, altitudeFeet?: number): number {
  if (temp == null) return 1.0;
  if (sport !== "MLB" && sport !== "NFL") return 1.0;

  // Baseline: 70F, 50% humidity, Sea Level
  let multiplier = 1.0;
  
  // Temperature factor (Hotter = less dense = ball flies further)
  if (temp > 85) multiplier += 0.03;
  if (temp < 40) multiplier -= 0.04;
  
  // Humidity factor (Humid air is lighter than dry air, surprisingly)
  if (humidity != null) {
    if (humidity > 75 && temp > 75) multiplier += 0.02;
  }
  
  // Altitude factor (e.g. Coors Field, Mile High)
  if (altitudeFeet != null && altitudeFeet > 4000) {
    multiplier += 0.05;
  }
  
  return multiplier;
}

// 2. The "Bend But Don't Break" Kicker Prop
export function applyKickerRedZoneStall(stat: string, isKicker?: boolean, redZoneDefRank?: number, yardsAllowedRank?: number): PropLayer | null {
  if (!isKicker || redZoneDefRank == null || yardsAllowedRank == null) return null;
  
  // If the defense allows a lot of yards (Rank > 20) but locks down the red zone (Rank < 10)
  if (yardsAllowedRank >= 20 && redZoneDefRank <= 10) {
    if (stat === "points" || stat === "field_goals") {
      return {
        id: "red_zone_stall",
        label: "Red Zone Stall (Kicker Boost)",
        p: 0.65,
        precision: 4.5,
        family: "alpha",
        note: `[ALPHA] Defense gives up yards (Rank ${yardsAllowedRank}) but stops TDs (Rank ${redZoneDefRank}). Expect high FG attempts.`,
      };
    }
  }
  return null;
}

// 3. The "Hostile Environment" Penalty (NCAAF / NCAAB)
export function applyHostileFreshmanPenalty(stat: string, sport: string, isFreshman?: boolean, isAway?: boolean, venueHostilityRank?: number): PropLayer | null {
  if (!isFreshman || !isAway || venueHostilityRank == null) return null;
  if (sport !== "NCAAF" && sport !== "NCAAB") return null;
  
  // If playing in a top 15 most hostile venue as a true freshman
  if (venueHostilityRank <= 15) {
    if (stat === "points" || stat === "pra" || stat === "pass_yds") {
      return {
        id: "hostile_freshman",
        label: "Hostile Environment Penalty",
        p: 0.38,
        precision: 4.0,
        family: "alpha",
        note: `[ALPHA] True Freshman playing in hostile away environment (Venue Rank: ${venueHostilityRank}). Extreme volatility expected.`,
      };
    }
  }
  return null;
}

// 4. Referee Pace & Whistle Rate
export function applyRefereePaceMultiplier(sport: string, refereeWhistleRate?: number): number {
  if (refereeWhistleRate == null) return 1.0;
  if (sport !== "NBA" && sport !== "NCAAB") return 1.0;
  
  // refereeWhistleRate is fouls called per 48 mins (average is around ~38 in NBA)
  if (refereeWhistleRate > 44) {
    return 1.04; // High whistle rate = clock stops, more free throws = OVER
  } else if (refereeWhistleRate < 34) {
    return 0.96; // Swallows whistle = clock runs, fewer free throws = UNDER
  }
  
  return 1.0;
}