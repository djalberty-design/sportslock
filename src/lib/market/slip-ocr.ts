/** Free on-device slip reader. No xAI key. OCR text in, ticket fields out. */
import type { MarketType, ParsedTicket } from "./types.ts";
import { combineParlayFair, type JointLeg } from "./joint-grade.ts";

const SPORTS = ["NFL", "NBA", "MLB", "NHL", "NCAAF", "NCAAB", "CFB", "CBB"] as const;

const SPORT_HINT: Record<string, string> = {
  football: "NFL",
  nfl: "NFL",
  ncaaf: "NCAAF",
  cfb: "NCAAF",
  basketball: "NBA",
  nba: "NBA",
  ncaab: "NCAAB",
  cbb: "NCAAB",
  baseball: "MLB",
  mlb: "MLB",
  hockey: "NHL",
  nhl: "NHL",
};

const PROP_STATS = [
  "passing yards",
  "rushing yards",
  "receiving yards",
  "receptions",
  "anytime touchdown",
  "touchdowns",
  "points",
  "rebounds",
  "assists",
  "threes",
  "3-pointers",
  "hits",
  "strikeouts",
  "home run",
  "home runs",
  "total bases",
  "rbis",
  "rbi",
  "walks",
  "stolen bases",
  "shots on goal",
  "saves",
  "goals",
  "batter runs",
];

export type SlipOcrResult = {
  fields: ParsedTicket[];
  raw: string;
  note: string;
};

export function parseSlipText(raw: string): SlipOcrResult {
  const text = cleanOcr(raw);
  if (!text.trim()) {
    return { fields: [], raw: text, note: "No text in the photo. Type the slip by hand." };
  }
  const sport = detectSport(text);
  const priceHits = [...text.matchAll(/(?:^|[^\d])([+-]\d{3,4})(?:[^\d]|$)/g)].map((m) => Number(m[1]));
  const blocks = splitLegs(text);
  const fields = blocks
    .map((block) => legFromBlock(block, sport, priceHits))
    .filter((f): f is ParsedTicket => Boolean(f));
  if (!fields.length) {
    const one = legFromBlock(text, sport, priceHits);
    if (one) fields.push(one);
  }
  return {
    fields,
    raw: text,
    note: fields.length
      ? `Read ${fields.length} pick${fields.length === 1 ? "" : "s"} from the photo on this phone. Check every field, then lock. No paid key used.`
      : "Read the photo on this phone but could not name a pick. Type the teams, side, and odds, then lock.",
  };
}

export function cleanOcr(raw: string): string {
  return raw
    .replace(/\u00a0/g, " ")
    .replace(/[|]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

export function detectSport(text: string): string {
  const upper = text.toUpperCase();
  for (const s of SPORTS) {
    if (new RegExp(`\\b${s}\\b`).test(upper)) return s === "CFB" ? "NCAAF" : s === "CBB" ? "NCAAB" : s;
  }
  const lower = text.toLowerCase();
  for (const [hint, sport] of Object.entries(SPORT_HINT)) {
    if (lower.includes(hint)) return sport;
  }
  if (/\b(qb|touchdown|spread|1st half)\b/i.test(text)) return "NFL";
  if (/\b(inning|era|rbi|strikeout)\b/i.test(text)) return "MLB";
  if (/\b(period|puck|goalie)\b/i.test(text)) return "NHL";
  if (/\b(quarter|rebound|three)\b/i.test(text)) return "NBA";
  return "NFL";
}

function splitLegs(text: string): string[] {
  const byBreak = text
    .split(/\n+|(?:\bleg\s*\d+\b)|(?:\bparlay\b)/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
  if (byBreak.length >= 2) return byBreak;
  const odds = [...text.matchAll(/[+-]\d{3,4}/g)];
  if (odds.length >= 2) {
    const parts: string[] = [];
    let last = 0;
    for (const m of odds) {
      const at = m.index ?? 0;
      const end = at + m[0].length;
      parts.push(text.slice(last, end).trim());
      last = end;
    }
    const rest = text.slice(last).trim();
    if (rest) parts[parts.length - 1] = `${parts[parts.length - 1]} ${rest}`.trim();
    return parts.filter((p) => p.length > 6);
  }
  return [text];
}

function legFromBlock(block: string, sport: string, prices: number[]): ParsedTicket | null {
  const price = priceFrom(block) ?? prices[0] ?? -110;
  const prop = propFrom(block, sport, price);
  if (prop) return prop;
  const total = totalFrom(block, sport, price);
  if (total) return total;
  const spread = spreadFrom(block, sport, price);
  if (spread) return spread;
  const ml = mlFrom(block, sport, price);
  return ml;
}

function priceFrom(block: string): number | undefined {
  const m = /(?:^|[^\d])([+-]\d{3,4})(?:[^\d]|$)/.exec(block);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

function propFrom(block: string, sport: string, price: number): ParsedTicket | null {
  const lower = block.toLowerCase();
  const stat = PROP_STATS.find((s) => lower.includes(s));
  const pointM = /(?:over|under|o\/u|o|u)\s*([0-9]+(?:\.[0-9]+)?)/i.exec(block) ?? /([0-9]+\.[05])/.exec(block);
  const nameM =
    /([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2})\s+(?:over|under|o\/u)/i.exec(block) ??
    /([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)/.exec(block);
  if (!stat) return null;
  if (!pointM && !stat) return null;
  const side = /\bunder\b|\bu\s*\d/i.test(block) ? "under" : "over";
  const point = pointM ? Number(pointM[1]) : undefined;
  const player = nameM ? nameM[1].trim() : undefined;
  const statLabel = stat ?? "prop";
  const selection = [player, side, point != null ? String(point) : null, statLabel].filter(Boolean).join(" ");
  const { home, away } = teamsFrom(block);
  return ticket({
    sport,
    home,
    away,
    marketType: "prop",
    side,
    selection,
    price,
    point,
    player,
    confidence: player && point != null ? 0.62 : 0.45,
  });
}

function totalFrom(block: string, sport: string, price: number): ParsedTicket | null {
  if (!/\b(over|under|o\/u|total)\b/i.test(block)) return null;
  if (PROP_STATS.some((s) => block.toLowerCase().includes(s))) return null;
  const pointM = /(?:over|under|o\/u|o|u|total)\s*([0-9]+(?:\.[0-9]+)?)/i.exec(block) ?? /([0-9]+\.[05])/.exec(block);
  if (!pointM) return null;
  const point = Number(pointM[1]);
  if (!Number.isFinite(point)) return null;
  const side = /\bunder\b|\bu\s*\d/i.test(block) ? "under" : "over";
  const { home, away } = teamsFrom(block);
  const who = home && away ? `${away} vs ${home}` : home || away || "game";
  return ticket({
    sport,
    home,
    away,
    marketType: "total",
    side,
    selection: `${who} ${side} ${point}`,
    price,
    point,
    confidence: home || away ? 0.58 : 0.42,
  });
}

function spreadFrom(block: string, sport: string, price: number): ParsedTicket | null {
  const m = /([A-Za-z0-9 .']{2,24}?)\s+([+-]\d+(?:\.\d)?)\b/.exec(block);
  if (!m) return null;
  const point = Number(m[2]);
  if (!Number.isFinite(point) || Math.abs(point) < 0.5 || Math.abs(point) > 70) return null;
  if (Math.abs(point) >= 100) return null;
  const team = m[1].replace(/\b(spread|vs|at|@)\b/gi, "").trim();
  if (team.length < 2) return null;
  const { home, away } = teamsFrom(block);
  const side = home && fuzzy(team, home) ? "home" : away && fuzzy(team, away) ? "away" : "home";
  return ticket({
    sport,
    home: home || (side === "home" ? team : ""),
    away: away || (side === "away" ? team : ""),
    marketType: "spread",
    side,
    selection: `${team} ${point > 0 ? "+" : ""}${point}`,
    price,
    point,
    confidence: home && away ? 0.6 : 0.48,
  });
}

function mlFrom(block: string, sport: string, price: number): ParsedTicket | null {
  const { home, away } = teamsFrom(block);
  const named =
    /([A-Za-z0-9 .']{2,28})\s+(?:to win|moneyline|\bml\b|win)/i.exec(block) ??
    /(?:to win|moneyline|\bml\b)\s+([A-Za-z0-9 .']{2,28})/i.exec(block);
  const pick = named?.[1]?.replace(/\b(the|at|vs)\b/gi, "").trim();
  if (!home && !away && !pick) return null;
  const side = pick && home && fuzzy(pick, home) ? "home" : pick && away && fuzzy(pick, away) ? "away" : price < 0 ? "home" : "away";
  const who = pick || (side === "home" ? home : away) || "home";
  return ticket({
    sport,
    home,
    away,
    marketType: "ml",
    side,
    selection: `${who} to win`,
    price,
    confidence: home && away ? 0.55 : 0.4,
  });
}

function teamsFrom(block: string): { home: string; away: string } {
  const vs = /([A-Za-z0-9 .']{2,28}?)\s+(?:vs\.?|@|at)\s+([A-Za-z0-9 .']{2,28})/i.exec(block);
  if (vs) {
    const a = tidyTeam(vs[1]);
    const b = tidyTeam(vs[2]);
    if (/@|\bat\b/i.test(vs[0])) return { away: a, home: b };
    return { away: a, home: b };
  }
  return { home: "", away: "" };
}

function tidyTeam(s: string): string {
  return s.replace(/\b(spread|total|over|under|ml|moneyline|to win)\b/gi, "").replace(/\s+/g, " ").trim();
}

function fuzzy(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x.includes(y) || y.includes(x) || x.split(" ").some((w) => w.length > 3 && y.includes(w));
}

function ticket(p: Omit<ParsedTicket, "confirmed">): ParsedTicket {
  return { ...p, confirmed: false };
}

export type GradedTicketResult = {
  success: boolean;
  legs: JointLeg[];
  combinedFair: number;
  correlation: string;
  sameGame: boolean;
  rawText: string;
};

/**
 * Text Extraction & Math Routing:
 * Scans an uploaded image using Tesseract to extract standard market indicators and odds.
 * Routes the parsed legs into the parlay calculation engine (Copula/Joint-Grade).
 * Enforces the Empty Look Law: Strictly fails if confidence is low or ticket is incomplete.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function processAndGradeTicket(imageUrl: any): Promise<GradedTicketResult> {
  let rawText = "";
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (Tesseract as any).recognize(imageUrl, "eng");
    rawText = result.data.text;
  } catch (err) {
    throw new Error("OCR Parse Failed: Image Recognition Error");
  }

  const parsed = parseSlipText(rawText);
  const { fields } = parsed;

  // The Empty Look Law (Strict Guardrail)
  if (fields.length < 2) {
    throw new Error("OCR Parse Failed: Incomplete Ticket Data. Could not definitively parse at least two legs.");
  }

  const avgConfidence = fields.reduce((s, f) => s + f.confidence, 0) / fields.length;
  if (avgConfidence < 0.45) {
    throw new Error("OCR Parse Failed: Low Confidence Ticket Data.");
  }

  // Leg Parsing, Normalization, & Routing
  const legs: JointLeg[] = fields.map((f) => {
    // Determine event ID for SGP Copula explicitly
    const eventId = f.home && f.away ? "${f.away}-at-".replace(/\s+/g, "-").toLowerCase() : "sgp_event";
    
    // Do not synthesize 50/50 odds to force the math to run; use exact implied probabilities from extracted prices.
    let fairProb = 0.5;
    if (f.price < 0) {
      fairProb = -f.price / (-f.price + 100);
    } else {
      fairProb = 100 / (f.price + 100);
    }

    return {
      eventId,
      marketType: f.marketType,
      side: f.side,
      price: f.price,
      fairProb,
      isProp: f.marketType === "prop"
    };
  });

  // Mathematical Integration
  const evaluation = combineParlayFair(legs);

  return {
    success: true,
    legs,
    combinedFair: evaluation.combinedFair,
    correlation: evaluation.correlation,
    sameGame: evaluation.sameGame,
    rawText
  };
}
