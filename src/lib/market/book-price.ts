/** Book American prices and implied chance. Display only — no invented 98% / +100. */

export const DEFAULT_WAGER = 10;
export const MAX_ABS_AMERICAN = 10_000;

export function bookAmerican(q: any): number | null {
  if (!q || typeof q !== "object") return null;
  const row = q.row && typeof q.row === "object" ? q.row : null;
  const candidates = [
    q.hardRockPrice,
    q.consensusPrice,
    q.price,
    row?.hardRockPrice,
    row?.consensusPrice,
    row?.price,
  ];
  for (const raw of candidates) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n === 0) continue;
    if (n <= -100 || n >= 100) return Math.round(n);
    if (n > 1 && n < 100) {
      if (n >= 2) return Math.round((n - 1) * 100);
      const am = Math.round(-100 / (n - 1));
      if (Number.isFinite(am) && Math.abs(am) <= MAX_ABS_AMERICAN) return am;
    }
  }
  return null;
}

export function formatAmerican(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n === 0) return "\u2014";
  const r = Math.round(n);
  if (Math.abs(r) > MAX_ABS_AMERICAN) return "\u2014";
  return r > 0 ? `+${r}` : `${r}`;
}

export function impliedFromAmerican(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n) || n === 0) return null;
  if (n < 0) return -n / (-n + 100);
  return 100 / (n + 100);
}

export function americanToDecimal(n: number): number {
  if (!Number.isFinite(n) || n === 0) return NaN;
  if (n > 0) return n / 100 + 1;
  return 100 / Math.abs(n) + 1;
}

export function decimalToAmerican(dec: number): number | null {
  if (!Number.isFinite(dec) || dec <= 1) return null;
  const am = dec >= 2 ? Math.round((dec - 1) * 100) : Math.round(-100 / (dec - 1));
  if (!Number.isFinite(am) || Math.abs(am) > MAX_ABS_AMERICAN) return null;
  return am;
}

export function slipAmerican(legs: any[]): number | null {
  if (!legs.length) return null;
  if (legs.length === 1) return bookAmerican(legs[0]);
  let dec = 1;
  for (const leg of legs) {
    const am = bookAmerican(leg);
    if (am == null) return null;
    const d = americanToDecimal(am);
    if (!Number.isFinite(d) || d <= 1) return null;
    dec *= d;
  }
  return decimalToAmerican(dec);
}

export function parseAmericanInput(raw: string): number | null {
  const n = parseInt(String(raw).replace(/[^0-9+-]/g, ""), 10);
  if (!Number.isFinite(n) || n === 0) return null;
  if (Math.abs(n) > MAX_ABS_AMERICAN) return null;
  if (n > -100 && n < 100 && n !== 100 && n !== -100) return null;
  return n;
}

/** Model chance if it is in a sane band; otherwise book implied. Never 98% on both sides of a two-way. */
export function displayChance(q: any): number | null {
  const book = impliedFromAmerican(bookAmerican(q));
  const model = Number(q?.fairProb ?? q?.chance ?? q?.row?.fairProb ?? q?.row?.chance);
  const modelOk = Number.isFinite(model) && model > 0.08 && model < 0.9;
  if (modelOk) return model;
  if (Number.isFinite(model) && model >= 0.9 && book != null) return book;
  if (book != null) return book;
  return null;
}

export function profitFromAmerican(stake: number, american: number | null): number {
  if (!Number.isFinite(stake) || stake <= 0 || american == null) return 0;
  if (american > 0) return stake * (american / 100);
  return stake * (100 / Math.abs(american));
}
