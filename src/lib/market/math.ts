export function clip(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function clip01(n: number): number {
  return clip(n, 0, 1);
}

export function invLogit(z: number, lo = 0.02, hi = 0.98): number {
  return clip(1 / (1 + Math.exp(-z)), lo, hi);
}

export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804 * Math.exp((-z * z) / 2);
  const p = d * t * (0.319381743 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - p : p;
}
