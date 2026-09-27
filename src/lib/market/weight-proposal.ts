import { shouldSteerWeights, WEIGHT_STEERING_FROZEN } from "./weight-freeze.ts";
import type { PublicScorecard } from "./scorecard.ts";

export type WeightProposal = {
  apply: boolean;
  reason: string;
  marketDelta: number;
};

/**
 * Model worse than the book (positive brierDelta) or CLV beat rate under 50%
 * → lean market. Inverse → allow a tiny sim bump. Never writes weights itself.
 */
export function proposeWeightShift(card: PublicScorecard): WeightProposal {
  if (WEIGHT_STEERING_FROZEN || !shouldSteerWeights(card.n, false)) {
    return { apply: false, reason: "frozen — propose only, live weights unchanged", marketDelta: 0 };
  }
  if (card.brierDelta != null && card.brierDelta > 0) {
    return { apply: true, reason: "model Brier worse than book", marketDelta: 0.02 };
  }
  if (card.clvBeatRate != null && card.clvBeatRate < 50) {
    return { apply: true, reason: "CLV beat rate under 50%", marketDelta: 0.02 };
  }
  if (card.brierDelta != null && card.brierDelta < 0 && card.clvBeatRate != null && card.clvBeatRate >= 55) {
    return { apply: true, reason: "model beats book on Brier and CLV", marketDelta: -0.02 };
  }
  return { apply: false, reason: "no signal", marketDelta: 0 };
}
