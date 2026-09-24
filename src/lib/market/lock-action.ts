import { DEFAULT_WAGER, parseAmericanInput } from "./book-price";
import { lockPredictionFn } from "./server";
import type { PlacePaperInput, PlacePaperResult } from "@/lib/desk-store";

export function researchStake(raw: string | number | null | undefined): number {
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return Math.round(n * 100) / 100;
  return DEFAULT_WAGER;
}

export function researchAmerican(raw: string | number | null | undefined, fallback = -110): number {
  if (typeof raw === "number" && Number.isFinite(raw) && raw !== 0) return Math.round(raw);
  return parseAmericanInput(String(raw ?? "")) ?? fallback;
}

export async function writePredictionLegs(
  legs: Array<{ eventId: string; selection: string; marketType: string; point?: number; price: number; fairProb: number }>,
): Promise<{ ok: boolean; count: number }> {
  if (!legs.length) return { ok: true, count: 0 };
  return lockPredictionFn({ data: { legs } });
}

export function paperFromLock(input: {
  description: string;
  stake: number;
  price: number;
  chance?: number;
  gameIds: string[];
  home?: string;
  away?: string;
  kind?: PlacePaperInput["kind"];
  legs?: any[];
}): PlacePaperInput {
  return {
    kind: input.kind ?? (input.gameIds.length > 1 ? "parlay" : "main"),
    description: input.description,
    stake: input.stake,
    price: input.price,
    livePrice: input.price,
    postedPrice: input.price,
    chance: input.chance,
    gameIds: input.gameIds.filter(Boolean),
    home: input.home,
    away: input.away,
    fastLog: true,
    status: "open",
    legs: input.legs,
  };
}

export type { PlacePaperResult };
