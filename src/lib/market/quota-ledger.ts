/** Phase 3 quota law. Odds API free tier is 500/month. We stop at 400. */
export const ODDS_MONTHLY_LIMIT = 500;
export const ODDS_SAFETY_CEILING = 400;
export const ODDS_WEEKLY_CAP = 100;

export type QuotaDecision = {
  action: "fetch" | "serve_stale";
  used: number;
  remainingToCeiling: number;
  weeklyUsed: number;
  reason: string;
};

export function remainingToCeiling(used: number): number {
  return Math.max(0, ODDS_SAFETY_CEILING - Math.max(0, used));
}

export function decideOddsFetch(input: {
  monthlyUsed: number;
  weeklyUsed: number;
  requestedCalls?: number;
}): QuotaDecision {
  const used = Math.max(0, input.monthlyUsed);
  const weeklyUsed = Math.max(0, input.weeklyUsed);
  const requested = Math.max(1, input.requestedCalls ?? 1);
  const left = remainingToCeiling(used);
  const weeklyLeft = Math.max(0, ODDS_WEEKLY_CAP - weeklyUsed);

  if (left < requested) {
    return {
      action: "serve_stale",
      used,
      remainingToCeiling: left,
      weeklyUsed,
      reason: `Monthly safety ceiling ${ODDS_SAFETY_CEILING}/${ODDS_MONTHLY_LIMIT} would be breached`,
    };
  }
  if (weeklyLeft < requested) {
    return {
      action: "serve_stale",
      used,
      remainingToCeiling: left,
      weeklyUsed,
      reason: `Weekly sub-budget ${ODDS_WEEKLY_CAP} would be breached`,
    };
  }
  return {
    action: "fetch",
    used,
    remainingToCeiling: left,
    weeklyUsed,
    reason: "Under ceiling and weekly cap",
  };
}
