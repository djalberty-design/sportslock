import { create } from "zustand";
import { persist } from "zustand/middleware";
import { combineParlayFair, type JointLeg } from "./market/joint-grade";

export type ParlayLeg = {
  eventId: string;
  selection: string;
  marketType: string;
  side?: string;
  point?: number;
  price: number; // American odds
  fairProb: number;
  sport?: string;
  home?: string;
  away?: string;
  player?: string;
};

type ParlaySlipState = {
  legs: ParlayLeg[];
  addLeg: (leg: ParlayLeg) => void;
  removeLeg: (selection: string, marketType?: string, eventId?: string, player?: string) => void;
  removeLegByIndex: (index: number) => void;
  clearAll: () => void;
};

export const useParlaySlip = create<ParlaySlipState>()(
  persist(
    (set) => ({
      legs: [],
      addLeg: (leg) =>
        set((state) => {
          // Robust Mutual Exclusivity Logic:
          // 1. If it's a player prop:
          //    - If both legs have player names: only mutually exclusive if SAME event, SAME player, and SAME market
          //      (e.g. Over vs Under points for the same player). Different players in the same game can be combined freely!
          //    - If player name missing: compare selection & market.
          // 2. If one is a prop and one is a game line: SGP allowed! Keep both!
          // 3. If both are game lines: mutually exclusive on SAME event and SAME marketType (e.g. Home ML vs Away ML).
          // 4. Different events: Always independent, keep both!
          const filtered = state.legs.filter((p) => {
            const isPProp = Boolean(p.player || p.marketType === "prop" || p.marketType.startsWith("player_") || p.marketType.startsWith("batter_") || p.marketType.startsWith("pitcher_"));
            const isLegProp = Boolean(leg.player || leg.marketType === "prop" || leg.marketType.startsWith("player_") || leg.marketType.startsWith("batter_") || leg.marketType.startsWith("pitcher_"));

            // Different games are never mutually exclusive
            if (p.eventId && leg.eventId && p.eventId !== leg.eventId) {
              return true;
            }

            // Both are player props from the same game
            if (isPProp && isLegProp) {
              const pName = (p.player || "").trim().toLowerCase();
              const legName = (leg.player || "").trim().toLowerCase();
              if (pName && legName) {
                // If same player and same market (e.g. Over vs Under on same stat), replace old pick
                if (pName === legName && p.marketType === leg.marketType) {
                  return false;
                }
                // Different players, or same player with different stat (points + assists) -> KEEP BOTH
                return true;
              }
              // Fallback if player name not specified
              return !(p.selection === leg.selection && p.marketType === leg.marketType);
            }

            // One is a game line, one is a player prop in the same game -> KEEP BOTH (SGP)
            if (isPProp !== isLegProp) {
              return true;
            }

            // Both are game lines in the same game -> mutually exclusive on same marketType (e.g. ML vs ML, Spread vs Spread)
            return !(p.marketType === leg.marketType);
          });
          return { legs: [...filtered, leg] };
        }),
      removeLeg: (selection, marketType, eventId, player) =>
        set((state) => ({
          legs: state.legs.filter((p) => {
            if (eventId && p.eventId && p.eventId !== eventId) return true;
            if (player && p.player && p.player.trim().toLowerCase() !== player.trim().toLowerCase()) return true;
            const sameMkt = !marketType || marketType === "unknown" || !p.marketType || p.marketType === "unknown" || p.marketType === marketType;
            if (p.selection === selection && sameMkt) return false;
            return true;
          }),
        })),
      removeLegByIndex: (index) =>
        set((state) => ({
          legs: state.legs.filter((_, i) => i !== index),
        })),
      clearAll: () => set({ legs: [] }),
    }),
    {
      name: "sportslock-parlay-slip",
    },
  ),
);

// Helpers
export function isLegSelected(
  legs: ParlayLeg[],
  selection: string,
  marketType?: string,
  eventId?: string,
  player?: string,
): boolean {
  return legs.some((p) => {
    if (eventId && p.eventId && p.eventId !== eventId) return false;
    if (player && p.player && p.player.trim().toLowerCase() !== player.trim().toLowerCase()) return false;
    const sameMkt = !marketType || marketType === "unknown" || !p.marketType || p.marketType === "unknown" || p.marketType === marketType;
    return p.selection === selection && sameMkt;
  });
}

/**
 * Compute combined American odds from an array of legs.
 * Uses Clayton copula for correlated same-game legs.
 */
export function combinedOdds(legs: ParlayLeg[]): {
  american: string;
  decPayout: number;
  combinedProb: number;
  isCorrelated: boolean;
} {
  if (legs.length === 0) return { american: "+0", decPayout: 1, combinedProb: 0, isCorrelated: false };

  // Combined implied probability (from the line)
  const combinedImplied = legs.reduce((acc, leg) => {
    const p = leg.price;
    const prob = p < 0 ? -p / (-p + 100) : 100 / (p + 100);
    return acc * prob;
  }, 1);

  // Convert to JointLeg format for copula calculation
  const jointLegs: JointLeg[] = legs.map((l) => ({
    eventId: l.eventId || "unknown",
    marketType: l.marketType || "unknown",
    side: l.side || (l.selection?.toLowerCase().includes("over") ? "over" : l.selection?.toLowerCase().includes("under") ? "under" : "home"),
    fairProb: l.fairProb,
    price: l.price,
    isProp: l.marketType === "prop" || l.marketType.startsWith("player_") || l.marketType.startsWith("batter_") || l.marketType.startsWith("pitcher_") || Boolean(l.player),
    selection: l.selection,
    sport: l.sport,
  }));

  const { combinedFair, sameGame } = combineParlayFair(jointLegs);

  const decPayout = combinedImplied > 0 ? 1 / combinedImplied : 1;
  const american =
    decPayout >= 2.0
      ? `+${Math.round((decPayout - 1) * 100)}`
      : decPayout > 1
        ? `-${Math.round(100 / (decPayout - 1))}`
        : "+0";

  return { american, decPayout, combinedProb: combinedFair, isCorrelated: sameGame };
}
