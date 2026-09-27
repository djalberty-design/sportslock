import type { ParsedTicket } from "./types.ts";
import { combineParlayFair, type JointLeg } from "./joint-grade.ts";

export type GradedTicketResult = {
  success: boolean;
  legs: JointLeg[];
  combinedFair: number;
  correlation: string;
  sameGame: boolean;
  rawText: string;
};

export function slipEventId(away?: string, home?: string, fallback = ""): string {
  const a = (away ?? "").trim();
  const b = (home ?? "").trim();
  if (a && b) return `${a}-at-${b}`.replace(/\s+/g, "-").toLowerCase();
  const fb = fallback.trim().replace(/\s+/g, "-").toLowerCase();
  return fb ? `leg-${fb}` : "unknown-event";
}

export function gradeParsedFields(fields: ParsedTicket[], rawText = ""): GradedTicketResult {
  if (!fields.length) {
    throw new Error("OCR Parse Failed: Incomplete Ticket Data. Could not parse a pick.");
  }
  const avgConfidence = fields.reduce((s, f) => s + f.confidence, 0) / fields.length;
  if (avgConfidence < 0.45) {
    throw new Error("OCR Parse Failed: Low Confidence Ticket Data.");
  }
  const legs: JointLeg[] = fields.map((f) => {
    const eventId = slipEventId(f.away, f.home, f.selection);
    const fairProb = f.price < 0 ? -f.price / (-f.price + 100) : 100 / (f.price + 100);
    return {
      eventId,
      marketType: f.marketType,
      side: f.side,
      price: f.price,
      fairProb,
      isProp: f.marketType === "prop",
      selection: f.selection,
    };
  });
  const evaluation = combineParlayFair(legs);
  return {
    success: true,
    legs,
    combinedFair: evaluation.combinedFair,
    correlation: evaluation.correlation,
    sameGame: evaluation.sameGame,
    rawText,
  };
}
