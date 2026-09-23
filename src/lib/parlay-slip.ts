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
  removeLeg: (selection: string, marketType: string) => void;
  clearAll: () => void;
};

export const useParlaySlip = create<ParlaySlipState>()(
  persist(
    (set) => ({
      legs: [],
      addLeg: (leg) =>
        set((state) => {
          // Mutual exclusivity: remove any existing leg from the same event + marketType
          // (e.g. clicking Home ML auto-removes Away ML)
          const filtered = state.legs.filter(
            (p) => !(p.eventId === leg.eventId && p.marketType === leg.marketType),
          );
          return { legs: [...filtered, leg] };
        }),
      removeLeg: (selection, marketType) =>
        set((state) => ({
          legs: state.legs.filter(
            (p) => !(p.selection === selection && p.marketType === marketType),
          ),
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
  marketType: string,
): boolean {
  return legs.some((p) => p.selection === selection && p.marketType === marketType);
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
    isProp: l.marketType === "prop" || l.marketType.startsWith("player_") || l.marketType.startsWith("batter_") || l.marketType.startsWith("pitcher_"),
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
