import { ticketHitPct, americanImplied } from "./hit-pct";

/* ── Odds conversion ────────────────────────────────────── */

/** American odds → decimal payout (e.g. +150 → 2.50, -110 → 1.909) */
export function americanToDecimal(odds: number): number {
  if (odds >= 100) return odds / 100 + 1;
  if (odds <= -100) return 100 / Math.abs(odds) + 1;
  return 1.91; // fallback for invalid
}

/* ── EV Score ───────────────────────────────────────────── */

/**
 * Expected Value per unit staked.
 *   EV = (hitPct/100) × decimalPayout − 1
 * Returns a decimal: +0.05 = +5% EV
 */
export function computeEV(hitPct: number, americanOdds: number): number {
  const dec = americanToDecimal(americanOdds);
  return (hitPct / 100) * dec - 1;
}

/* ── Star rating ────────────────────────────────────────── */

/** 1-5 star rating derived from EV percentage */
export function evStars(ev: number): 1 | 2 | 3 | 4 | 5 {
  if (ev >= 0.08) return 5;
  if (ev >= 0.04) return 4;
  if (ev >= 0.01) return 3;
  if (ev >= 0) return 2;
  return 1;
}

/** Human-readable star label */
export function starLabel(stars: number): string {
  switch (stars) {
    case 5: return "Strong Value";
    case 4: return "Good Value";
    case 3: return "Slight Edge";
    case 2: return "Break-Even";
    default: return "Negative EV";
  }
}

/* ── Combined lab score ─────────────────────────────────── */

export interface LabScore {
  ev: number;        // raw EV decimal (e.g. 0.05 = +5%)
  evPct: string;     // formatted "+5.0%"
  stars: 1 | 2 | 3 | 4 | 5;
  label: string;     // "Strong Value", etc.
  hitPct: number;    // 1-99
  edgePct: string;   // "+7.2%"
}

export function labScore(opts: {
  chance?: number | null;
  fairProb?: number | null;
  price?: number | null;
}): LabScore {
  const hitPct = ticketHitPct(opts) ?? 50;
  const price = Number(opts.price) || -110;
  const ev = computeEV(hitPct, price);
  const stars = evStars(ev);
  const implied = americanImplied(price) ?? 0.5;
  const edge = (hitPct / 100) - implied;

  return {
    ev,
    evPct: `${ev >= 0 ? "+" : ""}${(ev * 100).toFixed(1)}%`,
    stars,
    label: starLabel(stars),
    hitPct,
    edgePct: `${edge >= 0 ? "+" : ""}${(edge * 100).toFixed(1)}%`,
  };
}
