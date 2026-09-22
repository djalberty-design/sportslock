/** Single ticket hit %. Clip 1–99. Prefer model when it is sane; else the book. */

/** Reject invented monster prices. Real posted Hard Rock Americans stay. */
export const HARD_ROCK_ODDS_CAP = 10000;

export function bookAmerican(raw?: number | null): number | null {
  const p = Number(raw);
  if (!Number.isFinite(p) || p === 0) return null;
  if (p > 1 && p < 100) {
    const am = p >= 2 ? Math.round((p - 1) * 100) : Math.round(-100 / (p - 1));
    if (!Number.isFinite(am) || Math.abs(am) < 100 || Math.abs(am) > HARD_ROCK_ODDS_CAP) return null;
    return am;
  }
  if (Math.abs(p) < 100) return null;
  if (Math.abs(p) > HARD_ROCK_ODDS_CAP) return null;
  return Math.round(p);
}

export function formatAmerican(raw?: number | null): string {
  const am = bookAmerican(raw);
  if (am == null) return "-";
  return am > 0 ? `+${am}` : `${am}`;
}

export function americanImplied(price?: number | null): number | null {
  const am = bookAmerican(price);
  const p = am ?? Number(price);
  if (!Number.isFinite(p) || p === 0) return null;
  if (Math.abs(p) < 100 && p > 1 && p < 50) {
    return p >= 2 ? 1 / p : null;
  }
  if (p > 0) return 100 / (p + 100);
  return Math.abs(p) / (Math.abs(p) + 100);
}

export function clipHitPct(raw?: number | null): number | null {
  if (raw == null || !Number.isFinite(Number(raw))) return null;
  let n = Number(raw);
  if (n > 1.5) n = n / 100;
  if (n <= 0 || n >= 1) return null;
  return Math.round(Math.min(99, Math.max(1, n * 100)));
}

export function ticketHitPct(opts: {
  chance?: number | null;
  fairProb?: number | null;
  price?: number | null;
}): number | null {
  const model = Number(opts.chance ?? opts.fairProb);
  const book = americanImplied(opts.price);
  const modelOk = Number.isFinite(model) && model > 0.03 && model < 0.97;
  if (modelOk) return clipHitPct(model);
  if (book != null) return clipHitPct(book);
  if (Number.isFinite(model)) return clipHitPct(Math.min(0.99, Math.max(0.01, model)));
  return null;
}

export function formatEdgePts(raw?: number | null): string | null {
  if (raw == null || !Number.isFinite(Number(raw))) return null;
  const n = Number(raw);
  const pts = Math.abs(n) <= 1.5 ? n * 100 : n;
  const rounded = Math.round(pts);
  if (rounded === 0) return null;
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}
