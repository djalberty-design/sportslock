function sportLabel(sport: string): string {
  if (sport === "NCAAF") return "College Football";
  if (sport === "NCAAB") return "College Basketball";
  return sport || "Sport";
}

function americanToDecimal(american: number): number {
  if (american > 0) return 1 + american / 100;
  return 1 + 100 / Math.abs(american);
}

function kellyStakeFromOdds(bankroll: number, unit: number, fairProb: number, bookOdds: number): number {
  const dec = americanToDecimal(bookOdds);
  const b = dec - 1;
  const fStar = Math.max(0, (fairProb * b - (1 - fairProb)) / b);
  const raw = bankroll * fStar * 0.25;
  const minClamp = unit * 0.25;
  const maxClamp = unit * 4;
  return Math.round(Math.max(minClamp, Math.min(maxClamp, raw)) * 100) / 100;
}

type CardPick = {
  selection: string;
  sport: string;
  chance: number;
  price?: number;
  home?: string;
  away?: string;
  start?: string;
  edge?: number;
  implied?: number;
  confidence?: string;
  parlay?: { sameGame?: boolean };
};

export type ConfidenceGrade = "A" | "B" | "C" | "U";

export type PickCardView = {
  sport: string;
  matchup: string;
  pick: string;
  book: string;
  price: number | null;
  edgePct: number | null;
  kellyStake: number | null;
  lineAgeSeconds: number | null;
  confidenceGrade: ConfidenceGrade;
  sameGame: boolean;
  copyText: string;
};

const DEFAULT_BOOK = "Hard Rock";

/** Phase 4 owns calibrated buckets. Until then every printed grade is U. */
export function confidenceGrade(_pick?: { confidence?: string }): ConfidenceGrade {
  return "U";
}

export function formatAmerican(price: number | null | undefined): string {
  if (price == null || !Number.isFinite(price)) return "—";
  return price > 0 ? `+${Math.round(price)}` : `${Math.round(price)}`;
}

export function edgePct(pick: Pick<CardPick, "edge" | "chance" | "implied">): number | null {
  if (typeof pick.edge === "number" && Number.isFinite(pick.edge)) {
    return Math.round(pick.edge * 1000) / 10;
  }
  if (typeof pick.chance === "number" && typeof pick.implied === "number") {
    return Math.round((pick.chance - pick.implied) * 1000) / 10;
  }
  return null;
}

export function lineAgeSeconds(fromIso?: string | null, now = Date.now()): number | null {
  if (!fromIso) return null;
  const t = new Date(fromIso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round((now - t) / 1000));
}

export function formatLineAge(seconds: number | null): string {
  if (seconds == null) return "age unknown";
  if (seconds < 60) return `${seconds}s old`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m old`;
  const hours = Math.round(minutes / 60);
  return `${hours}h old`;
}

export function kellyStakeDollars(input: {
  bankroll: number;
  unit: number;
  fairProb?: number;
  bookOdds?: number;
}): number | null {
  if (!Number.isFinite(input.bankroll) || input.bankroll <= 0) return null;
  if (input.fairProb == null || input.bookOdds == null) return null;
  return kellyStakeFromOdds(
    input.bankroll,
    Math.max(1, input.unit || 10),
    input.fairProb,
    input.bookOdds,
  );
}

export function matchupLine(pick: Pick<CardPick, "away" | "home" | "sport">): string {
  if (pick.away && pick.home) return `${pick.away} vs ${pick.home}`;
  return sportLabel(pick.sport);
}

export function ticketCopyText(view: {
  pick: string;
  book: string;
  price: number | null;
  matchup: string;
}): string {
  const price = formatAmerican(view.price);
  return `${view.matchup} · ${view.pick} · ${view.book} ${price}`;
}

export function toPickCardView(
  pick: CardPick,
  opts: { bankroll: number; unit: number; book?: string; now?: number } = { bankroll: 1000, unit: 10 },
): PickCardView {
  const price = pick.price ?? null;
  const edge = edgePct(pick);
  const age = lineAgeSeconds(pick.start, opts.now);
  const stake = kellyStakeDollars({
    bankroll: opts.bankroll,
    unit: opts.unit,
    fairProb: pick.chance,
    bookOdds: pick.price,
  });
  const view: PickCardView = {
    sport: sportLabel(pick.sport),
    matchup: matchupLine(pick),
    pick: pick.selection,
    book: opts.book ?? DEFAULT_BOOK,
    price,
    edgePct: edge,
    kellyStake: stake,
    lineAgeSeconds: age,
    confidenceGrade: confidenceGrade(pick),
    sameGame: Boolean(pick.parlay?.sameGame),
    copyText: "",
  };
  view.copyText = ticketCopyText(view);
  return view;
}
