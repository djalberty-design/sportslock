import { clip } from "./math.ts";
import type { ChanceInput } from "./chance.ts";
import type { PropLayer } from "./types.ts";

export type NarrativeMeans = {
  muH: number;
  muA: number;
  chaosAdd: number;
  notes: string[];
};

/**
 * Step 6.1: Narrative & Psychological Alpha (Game Level)
 * Identifies Desperation Spots, Must-Win scenarios, and Coach Hot-Seats based on recent form.
 */
export function applyNarrativeToMeans(input: ChanceInput, muH: number, muA: number): NarrativeMeans {
  const notes: string[] = [];
  let nextH = muH;
  let nextA = muA;
  let chaosAdd = 0;

  if (!input.lastFive) return { muH, muA, chaosAdd, notes };

  const lastFiveH = input.lastFive[0];
  const lastFiveA = input.lastFive[1];

  // Desperation Spot: A team that is normally a favorite (implied by high mu) but has lost 4 or 5 straight
  // is in an absolute "Must-Win" desperation spot. They will not rest starters and play hyper-aggressively.
  if (lastFiveH != null && Number.isFinite(lastFiveH) && lastFiveH <= 0.20 && muH > muA) {
    nextH *= 1.04;
    chaosAdd -= 0.05; // Lower variance (they are focused, no silly mistakes)
    notes.push("[ALPHA] Home team is in a Desperation Spot (0-5 or 1-4). High motivation.");
  }

  if (lastFiveA != null && Number.isFinite(lastFiveA) && lastFiveA <= 0.20 && muA > muH) {
    nextA *= 1.04;
    chaosAdd -= 0.05;
    notes.push("[ALPHA] Away team is in a Desperation Spot (0-5 or 1-4). High motivation.");
  }
  
  // Complacency Spot: A massive favorite on a 5-0 streak often overlooks weaker opponents
  if (lastFiveH != null && Number.isFinite(lastFiveH) && lastFiveH === 1.0 && (muH / muA) > 1.5) {
    nextH *= 0.97;
    chaosAdd += 0.05; // High variance (trap game territory)
    notes.push("[ALPHA] Home team on 5-0 streak vs weak opponent. Complacency risk.");
  }

  if (lastFiveA != null && Number.isFinite(lastFiveA) && lastFiveA === 1.0 && (muA / muH) > 1.5) {
    nextA *= 0.97;
    chaosAdd += 0.05;
    notes.push("[ALPHA] Away team on 5-0 streak vs weak opponent. Complacency risk.");
  }

  return { muH: nextH, muA: nextA, chaosAdd, notes };
}

/**
 * Step 6.1: Narrative Alpha (Prop Level)
 * Identifies Revenge Games and psychological milestones for individual players.
 */
export function applyNarrativeToProps(
  statCategory: string,
  playerName: string,
  narrativeTags?: string[]
): PropLayer | null {
  if (!narrativeTags || narrativeTags.length === 0) return null;

  // If upstream feed tags this as a "Revenge Game" (playing former team)
  if (narrativeTags.includes("REVENGE_GAME")) {
    if (statCategory === "points" || statCategory === "shots" || statCategory === "pass_yds") {
      // Massive usage spike for stars playing former teams (they want to put on a show)
      return {
        id: "narrative_revenge",
        label: "Revenge Game",
        p: 0.65, // Skews heavily towards OVER
        precision: 4.0,
        family: "alpha",
        note: `[ALPHA] Revenge Game Narrative: High usage spike projected for ${playerName}.`,
      };
    }
  }

  // Contract Year / Milestone hunting
  if (narrativeTags.includes("MILESTONE")) {
    return {
      id: "narrative_milestone",
      label: "Stat Padding",
      p: 0.58, 
      precision: 3.0,
      family: "alpha",
      note: `[ALPHA] Player is hunting a statistical milestone/contract incentive.`,
    };
  }

  return null;
}