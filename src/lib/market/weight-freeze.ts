/** Win-rate steering stays off until Phase 4 publishes an honest scorecard. */
export const WEIGHT_STEERING_FROZEN = true;
export const WEIGHT_STEERING_MIN_N = 50;

export function shouldSteerWeights(sampleSize: number, phase4Live = false): boolean {
  return phase4Live && Number.isFinite(sampleSize) && sampleSize >= WEIGHT_STEERING_MIN_N;
}
