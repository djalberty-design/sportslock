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