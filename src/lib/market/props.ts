/**
 * Player-bet (prop) ensemble.
 *
 * Same idea as the game-chance stack: the photographed sportsbook number is the
 * prior, then game total, script, weather, park, rest, and injuries nudge it.
 * Last-10 per-game rate is recency-weighted analysis of the live log, blended
 * 60/40 with season ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â not a hit-rate sticker.
 * Florida: college player bets are illegal. Never a lock.
 */

import { leagueTotal, logit, poissonOver } from "./chance.ts";
import { clip, invLogit, normalCdf } from "./math.ts";
import { analyzeScores, blendRate } from "./form.ts";
import { allowedForStat, processFromLooks, underlyingOffense, type TeamLooks } from "./looks.ts";
import { americanToImplied, twoWayNoVig } from "./engine.ts";
import { isCollegeSport } from "./universe.ts";
import { applyNarrativeToProps } from "./narrative.ts";
import { applyRefereeGrudgeToProps, type OfficialPosting } from "./officials.ts";
import { applyTrenchMismatch, applyPitchArsenalSynergy, applyDefensiveSchemeSplit, applyKickerRedZoneStall, applyHostileFreshmanPenalty } from "./syndicate.ts";

export type PropStat =
  | "pass_yds"
  | "rush_yds"
  | "rec_yds"
  | "receptions"
  | "pass_td"
  | "rush_att"
  | "anytime_td"
  | "two_plus_td"
  | "points"
  | "rebounds"
  | "assists"
  | "threes"
  | "pra"
  | "steals"
  | "blocks"
  | "hits"
  | "total_bases"
  | "rbi"
  | "hr"
  | "ks"
  | "walks"
  | "stolen_bases"
  | "runs"
  | "hrr"
  | "shots"
  | "goals"
  | "hockey_points"
  | "saves"
  | "blocked_shots"
  | "unknown";

export type PropLayer = {
  id: string;
  label: string;
  p: number;
  precision: number;
  family: "market" | "game" | "context";
  note: string;
  thin?: boolean;
  empty?: boolean;
};

export type ParsedProp = {
  player: string;
  stat: PropStat;
  statLabel: string;
  side: "over" | "under" | "yes" | "no";
  line?: number;
  counting: boolean;
};

export type PropInput = {
  sport: string;
  selection: string;
  price: number;
  oppositePrice?: number;
  player?: string;
  side?: string;
  point?: number;
  home: string;
  away: string;
  playerTeam?: string;
  gameTotal?: number;
  homeSpread?: number;
  teamWinChance?: number;
  weatherTemp?: number;
  weatherWind?: number;
  weatherPrecip?: number;
  venue?: string;
  injuries?: Array<{ player: string; team?: string; status: string }>;
  restDays?: number;
  usageRipple?: number;
  narrativeTags?: string[]; // Step 6.1: Revenge Games, Milestones
  officials?: OfficialPosting[]; // Step 6.2: Referee Grudges
  matchupFoulRate?: number; // Step 6.3: Foul Trouble Ripple
    oLineRank?: number;
    dLineRank?: number;
    batterStrength?: string;
    pitcherPrimary?: string;
    playerStyle?: string;
    defenseScheme?: string;
    temp?: number;
    humidity?: number;
    altitudeFeet?: number;
    isKicker?: boolean;
    redZoneDefRank?: number;
    yardsAllowedRank?: number;
    isFreshman?: boolean;
    isAway?: boolean;
    venueHostilityRank?: number;
    seasonRate?: number;
  recentRate?: number;
  recentN?: number;
  usageMin?: number;
  oppAllowed?: number;
  pitcherEra?: number;
  ownUnderlying?: number;
  pitcherHand?: "L" | "R";
  vsHandOps?: number;
  homeLooks?: TeamLooks;
  awayLooks?: TeamLooks;
    ownLooks?: TeamLooks;
};

export type PropReport = {
  player: string;
  stat: PropStat;
  statLabel: string;
  side: ParsedProp["side"];
  line?: number;
  hit: number;
  over: number;
  lean: "over" | "under" | "yes" | "no" | "pass";
  confidence: "high" | "medium" | "low";
  layers: PropLayer[];
  because: string;
  customize: string;
  illegal: boolean;
  standDown: boolean;
  standDownWhy?: string;
};

type StatMeta = {
  label: string;
  counting: boolean;
  patterns: RegExp[];
};

const STATS: Record<Exclude<PropStat, "unknown">, StatMeta> = {
  pass_yds: { label: "passing yards", counting: true, patterns: [/pass(ing)?\s*(yds|yards)/i, /passing/i] },
  rush_yds: { label: "rushing yards", counting: true, patterns: [/rush(ing)?\s*(yds|yards)/i] },
  rec_yds: { label: "receiving yards", counting: true, patterns: [/receiv(ing|ed)?\s*(yds|yards)/i] },
  receptions: { label: "catches", counting: true, patterns: [/receptions|\brecs?\b/i, /catches/i] },
  pass_td: { label: "passing touchdowns", counting: true, patterns: [/pass(ing)?\s*(td|touchdowns?)/i] },
  rush_att: { label: "rushing attempts", counting: true, patterns: [/rush(ing)?\s*(att|attempts|carries)/i] },
  anytime_td: {
    label: "to score a touchdown",
    counting: false,
    patterns: [/anytime\s*(td|touchdown)/i, /to score (a )?(td|touchdown)/i, /touchdown scorer/i],
  },
  two_plus_td: { label: "2+ touchdowns", counting: false, patterns: [/2\+?\s*(td|touchdowns)/i, /two or more (td|touchdowns)/i] },
  points: { label: "points", counting: true, patterns: [/\bpoints\b|\bpts\b/i] },
  rebounds: { label: "rebounds", counting: true, patterns: [/rebounds|\brebs?\b/i] },
  assists: { label: "assists", counting: true, patterns: [/assists|\bast\b/i] },
  threes: { label: "threes made", counting: true, patterns: [/3(-| )pointers?|threes|\b3pm\b/i] },
  pra: { label: "points + rebounds + assists", counting: true, patterns: [/\bpra\b|pts\+reb\+ast|points\s*\+\s*reb/i] },
  steals: { label: "steals", counting: true, patterns: [/steals|\bstl\b/i] },
  blocks: { label: "blocks", counting: true, patterns: [/blocks|\bblk\b/i] },
  hrr: { label: "hits + runs + RBIs", counting: true, patterns: [/hits\s*\+\s*runs\s*\+\s*rbis?|\bhrr\b/i] },
  total_bases: { label: "total bases", counting: true, patterns: [/total bases|\btb\b/i] },
  stolen_bases: { label: "stolen bases", counting: true, patterns: [/stolen bases?|\bsb\b/i] },
  hr: { label: "to hit a home run", counting: false, patterns: [/home runs?|\bhrs?\b|to homer/i] },
  rbi: { label: "RBI", counting: true, patterns: [/\brbis?\b|runs batted in/i] },
  runs: { label: "runs", counting: true, patterns: [/\bbatter runs\b|\bruns scored\b|(?:over|under)\s+\d+(?:\.\d+)?\s+runs\b/i] },
  ks: { label: "strikeouts", counting: true, patterns: [/strikeouts|\bk's\b|\bks\b|pitcher k/i] },
  walks: { label: "walks", counting: true, patterns: [/walks|\bbb\b/i] },
  hits: { label: "hits", counting: true, patterns: [/\bhits\b|\bh\b(?!\w)/i] },
  shots: { label: "shots on goal", counting: true, patterns: [/shots( on goal)?|\bsog\b/i] },
  goals: { label: "to score a goal", counting: false, patterns: [/\bgoals?\b|to score/i] },
  hockey_points: { label: "points", counting: true, patterns: [/\bpoints\b|\bpts\b/i] },
  saves: { label: "saves", counting: true, patterns: [/saves/i] },
  blocked_shots: { label: "blocked shots", counting: true, patterns: [/blocked shots/i] },
};

const PARK_HITS: Record<string, number> = {
  "coors field": 1.18,
  "great american ball park": 1.1,
  "yankee stadium": 1.06,
  "fenway park": 1.05,
  "citizens bank park": 1.05,
  "petco park": 0.9,
  "oracle park": 0.88,
  "t-mobile park": 0.91,
};

function parkHits(venue?: string): number | null {
  if (!venue) return null;
  const key = venue.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  for (const [name, f] of Object.entries(PARK_HITS)) {
    if (key.includes(name)) return f;
  }
  return null;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function namesHit(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const lastA = na.split(" ").pop() ?? na;
  const lastB = nb.split(" ").pop() ?? nb;
  return lastA.length >= 4 && lastA === lastB;
}

export function detectStat(text: string, sport: string): { stat: PropStat; meta: StatMeta } | null {
  const entries = Object.entries(STATS) as Array<[Exclude<PropStat, "unknown">, StatMeta]>;
  const allowed =
    sport === "NBA"
      ? new Set(["points", "rebounds", "assists", "threes", "pra", "steals", "blocks"])
      : sport === "MLB"
        ? new Set(["hits", "total_bases", "rbi", "hr", "ks", "walks", "stolen_bases", "runs", "hrr"])
        : sport === "NHL"
          ? new Set(["shots", "goals", "hockey_points", "saves", "blocked_shots"])
          : new Set(["pass_yds", "rush_yds", "rec_yds", "receptions", "pass_td", "rush_att", "anytime_td", "two_plus_td"]);
  for (const [stat, meta] of entries) {
    if (!allowed.has(stat)) continue;
    if (meta.patterns.some((re) => re.test(text))) return { stat, meta };
  }
  return null;
}

export function parsePropSelection(
  selection: string,
  sport: string,
  fallback?: { player?: string; point?: number; side?: string },
): ParsedProp {
  const raw = selection.trim();
  const hit = detectStat(raw, sport);
  const fb = fallback?.side?.toLowerCase();
  let side: ParsedProp["side"] = "over";
  if (fb === "under" || fb === "over" || fb === "yes" || fb === "no") side = fb;
  if (/\bunder\b/i.test(raw) || /\bu\s+\d/.test(raw)) side = "under";
  if (/\bover\b/i.test(raw) || /\bo\s+\d/.test(raw)) side = "over";
  if (/\b(not to)\b/i.test(raw)) side = "no";
  if (/\b(anytime|to score|to hit|to record)\b/i.test(raw) && !/\bover\b|\bunder\b/i.test(raw)) side = "yes";

  const lineMatch = /(?:over|under|o|u)?\s*(\d+(?:\.\d+)?)\s*(?:\+)?/i.exec(
    raw.replace(/^\s*[+-]?\d+\s*/, ""),
  );
  const plusMatch = /(\d+(?:\.\d+)?)\s*\+/i.exec(raw);
  const line = fallback?.point ?? (plusMatch ? Number(plusMatch[1]) : lineMatch ? Number(lineMatch[1]) : undefined);
  const lineOk = line != null && Number.isFinite(line) && line < 5000 ? line : undefined;

  let player = (fallback?.player ?? "").trim();
  if (!player) {
    const cut = raw.split(/\b(?:over|under|o\/u|anytime|to score|to hit|to record|\d)/i)[0] ?? raw;
    player = cut.replace(/[-ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â]/g, " ").replace(/\s+/g, " ").trim();
  }
  if (!player || player.length < 2) player = fallback?.player?.trim() || "Player";

  if (hit) {
    const counting = hit.meta.counting;
    if (!counting && side === "over") side = "yes";
    if (!counting && side === "under") side = "no";
    return { player, stat: hit.stat, statLabel: hit.meta.label, side, line: lineOk, counting };
  }
  return {
    player,
    stat: "unknown",
    statLabel: "this player bet",
    side: side === "yes" || side === "no" ? side : side,
    line: lineOk,
    counting: true,
  };
}

function marketFair(price: number, oppositePrice?: number): { p: number; hold: number } {
  if (oppositePrice != null && Number.isFinite(oppositePrice)) {
    const nv = twoWayNoVig(price, oppositePrice);
    if (Number.isFinite(nv.fairHome)) return { p: nv.fairHome, hold: nv.hold };
  }
  // When no opposite price exists, fall through to implied probability with vig haircut below
  const implied = americanToImplied(price);
  const p = Number.isFinite(implied) ? Math.min(0.88, Math.max(0.12, implied * 0.97)) : 0.5;
  return { p, hold: Number.isFinite(implied) ? implied - p : 0.05 };
}



function push(layers: PropLayer[], layer: PropLayer): void {
  if (!Number.isFinite(layer.p)) return;
  if (layer.empty || layer.precision <= 0) {
    layers.push({ ...layer, p: 0.5, precision: 0, empty: true, thin: true });
    return;
  }
  layers.push({ ...layer, p: clip(layer.p, 0.08, 0.92) });
}

function pushEmpty(layers: PropLayer[], id: string, label: string, note: string, family: PropLayer["family"] = "context"): void {
  push(layers, {
    id,
    label,
    p: 0.5,
    precision: 0,
    family,
    note: `${note} Status: Looked (Empty). Missing data has zero weight.`,
    thin: true,
    empty: true,
  });
}

function rateOver(stat: PropStat, rate: number, line: number): number {
  // Yards / points / PRA are continuous ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Poisson understates the tails (DMP Learn 2026).
  const sigma: Partial<Record<PropStat, number>> = {
    pass_yds: 68,
    rush_yds: 32,
    rec_yds: 28,
    points: 7.4,
    rebounds: 3.4,
    assists: 2.6,
    pra: 9.2,
    hockey_points: 0.95,
  };
  const s = sigma[stat];
  if (s && s > 0) {
    return invLogit(logit(1 - normalCdf((line - rate) / s)), 0.06, 0.94);
  }
  return poissonOver(rate, line);
}

const STAT_KEYS: Partial<Record<PropStat, string[]>> = {
  pass_yds: ["passYds", "yds"],
  rush_yds: ["rushYds"],
  rec_yds: ["recYds"],
  receptions: ["rec"],
  pass_td: ["passTd"],
  rush_att: ["rushAtt", "att"],
  points: ["pts", "points"],
  rebounds: ["reb", "rebounds"],
  assists: ["ast", "assists"],
  threes: ["threes", "fg3m"],
  pra: ["pra"],
  steals: ["stl", "steals"],
  blocks: ["blk", "blocks"],
  hits: ["hits", "h"],
  total_bases: ["tb"],
  rbi: ["rbi"],
  hr: ["hr"],
  ks: ["k"],
  walks: ["bb", "walks"],
  stolen_bases: ["sb"],
  runs: ["runs", "r"],
  hrr: ["hrr"],
  shots: ["sog", "shots"],
  goals: ["goals", "g"],
  hockey_points: ["pts", "points"],
  saves: ["saves"],
  blocked_shots: ["blocked"],
};

export function rateFromStats(stat: PropStat, stats?: Record<string, number>): number | undefined {
  if (!stats) return undefined;
  for (const k of STAT_KEYS[stat] ?? []) {
    const v = stats[k];
    if (v != null && Number.isFinite(v)) return v;
  }
  return undefined;
}

export function teamWinForPlayer(
  home: string,
  away: string,
  playerTeam?: string,
  homeWin?: number,
): number | undefined {
  if (homeWin == null || !Number.isFinite(homeWin)) return undefined;
  if (!playerTeam) return homeWin;
  if (namesHit(playerTeam, home)) return homeWin;
  if (namesHit(playerTeam, away)) return 1 - homeWin;
  return homeWin;
}

export function propStakeHaircut(unit: number): number {
  if (!(unit > 0)) return 1;
  return Math.max(1, Math.round(unit * 0.5));
}

function poolOver(layers: PropLayer[]): number {
  if (!layers.length) return 0.5;
  let num = 0;
  let den = 0;
  for (const l of layers) {
    num += logit(l.p) * l.precision;
    den += l.precision;
  }
  return invLogit(num / (den || 1), 0.1, 0.9);
}

export function buildPropChance(input: PropInput): PropReport {
  const parsed = parsePropSelection(input.selection, input.sport, {
    player: input.player,
    point: input.point,
    side: input.side,
  });

  if (isCollegeSport(input.sport)) {
    return {
      player: parsed.player,
      stat: parsed.stat,
      statLabel: parsed.statLabel,
      side: parsed.side,
      line: parsed.line,
      hit: 0.5,
      over: 0.5,
      lean: "pass",
      confidence: "low",
      layers: [],
      because: "College player bets are not allowed on Hard Rock Bet in Florida.",
      customize: "Stand down. Florida compact blocks college athlete props.",
      illegal: true,
      standDown: true,
      standDownWhy: "College player bets are not allowed on Hard Rock Bet.",
    };
  }

  const listedOut = (input.injuries ?? []).find((i) => {
    const st = (i.status ?? "").toLowerCase();
    return namesHit(i.player, parsed.player) && /out|il|doubtful|deceased|suspended/.test(st);
  });
  if (listedOut) {
    return {
      player: parsed.player,
      stat: parsed.stat,
      statLabel: parsed.statLabel,
      side: parsed.side,
      line: parsed.line,
      hit: 0.5,
      over: 0.5,
      lean: "pass",
      confidence: "low",
      layers: [],
      because: `${parsed.player} is listed ${listedOut.status}.`,
      customize: "Stand down. If they are ruled out the ticket often voids, and if they sneak in they are not themselves.",
      illegal: false,
      standDown: true,
      standDownWhy: `${parsed.player} is listed out.`,
    };
  }

  const layers: PropLayer[] = [];
  const mkt = marketFair(input.price, input.oppositePrice);
  const photographedIsOver = parsed.side === "over" || parsed.side === "yes";
  const marketOver = photographedIsOver ? mkt.p : 1 - mkt.p;

  push(layers, {
    id: "market",
    label: "Photographed book (no-vig)",
    p: marketOver,
    precision: 14,
    family: "market",
    note: "The live Hard Rock Bet Florida number, with the extra juice player bets usually carry stripped off. This is the prior ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â liquid prop markets are hard to beat.",
  });

  // Step 6.1: Narrative & Psychological Alpha
  if (input.narrativeTags && input.player) {
    const narrativeLayer = applyNarrativeToProps(parsed.stat, input.player, input.narrativeTags);
    if (narrativeLayer) push(layers, narrativeLayer);
  }

  // Step 6.2: Referee Grudges
  if (input.officials && input.player) {
    const grudgeLayer = applyRefereeGrudgeToProps(parsed.stat, input.player, input.officials);
    if (grudgeLayer) push(layers, grudgeLayer);
  }

  // Phase 8: The Syndicate Sandbox
  const trenchLayer = applyTrenchMismatch(parsed.stat, input.oLineRank, input.dLineRank);
  if (trenchLayer) push(layers, trenchLayer);

  const arsenalLayer = applyPitchArsenalSynergy(parsed.stat, input.batterStrength, input.pitcherPrimary);
  if (arsenalLayer) push(layers, arsenalLayer);

  const schemeLayer = applyDefensiveSchemeSplit(parsed.stat, input.playerStyle, input.defenseScheme);
  if (schemeLayer) push(layers, schemeLayer);

  const kickerLayer = applyKickerRedZoneStall(parsed.stat, input.isKicker, input.redZoneDefRank, input.yardsAllowedRank);
  if (kickerLayer) push(layers, kickerLayer);

  const freshmanLayer = applyHostileFreshmanPenalty(parsed.stat, input.sport, input.isFreshman, input.isAway, input.venueHostilityRank);
  if (freshmanLayer) push(layers, freshmanLayer);

  // Step 6.3: In-Game Micro-Correlations (Foul Trouble Ripple)
  if (input.matchupFoulRate != null && Number.isFinite(input.matchupFoulRate)) {
    if (parsed.stat === "points" || parsed.stat === "pra") {
      const z = clip((input.matchupFoulRate - 4.0) / 2.0, -0.4, 0.4); // 4.0 fouls/36 is avg for bigs
      if (Math.abs(z) > 0.05) {
        push(layers, {
          id: "foul_ripple",
          label: "Foul Trouble Ripple",
          p: invLogit(z),
          precision: 2.5,
          family: "alpha",
          note: `[ALPHA] Primary matchup is highly prone to foul trouble (FoulRate: ${input.matchupFoulRate}).`,
        });
      }
    }
  }

  if (parsed.counting && parsed.line != null && Number.isFinite(parsed.line)) {
    const rate = blendRate(input.seasonRate, input.recentRate);
    if (rate != null && rate > 0) {
      const overFromRate = rateOver(parsed.stat, rate, parsed.line);
      const usedRecent = input.recentRate != null && Number.isFinite(input.recentRate);
      push(layers, {
        id: "last10",
        label: usedRecent ? "Last 10 of this stat" : "Season rate vs the line (last-10 pending)",
        p: overFromRate,
        precision: usedRecent ? 6.4 : 4.4,
        family: "game",
        note: usedRecent
          ? `${parsed.player} recency-weighted last ${input.recentN ?? 10}: ${input.recentRate!.toFixed(2)} ${parsed.statLabel} (60%) blended with season ${input.seasonRate != null ? input.seasonRate.toFixed(2) : "n/a"} (40%). Last-10 of THIS stat, not a W-L sticker ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â books already shade hot streaks.`
          : `Looked up the live last-10 of ${parsed.statLabel}. Gamelog not posted yet, so season rate ${rate.toFixed(2)} vs the ${parsed.line} line. Thin, not a skip.`,
        thin: !usedRecent,
      });
    } else {
      pushEmpty(
        layers,
        "last10",
        "Last 10 of this stat",
        `Looked up last-10 ${parsed.statLabel} on the live ESPN gamelog. Not posted yet. Empty look, not a guess.`,
        "game",
      );
    }
  } else {
    pushEmpty(
      layers,
      "last10",
      "Last 10 of this stat",
      `Looked up last-10 of ${parsed.statLabel}. Yes/no tickets do not take a counting line ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â empty counting look, not a skip.`,
      "game",
    );
  }

  const total = input.gameTotal;
  const avg = leagueTotal(input.sport);
  if (parsed.counting && total != null && total > 0 && avg > 0) {
    const ratio = total / avg;
    const z = clip((ratio - 1) * 1.35, -0.18, 0.18);
    const passing = parsed.stat === "pass_yds" || parsed.stat === "rec_yds" || parsed.stat === "points" || parsed.stat === "pra";
    push(layers, {
      id: "total",
      label: "Game total / pace",
      p: invLogit(passing ? z : z * 0.7),
      precision: 4.2,
      family: "game",
      note: `Posted total ${total} vs a typical ${avg.toFixed(1)}. Higher totals mean more volume for counting stats.`,
    });
  }

  const win = input.teamWinChance;
  if (win != null && Number.isFinite(win)) {
    let z = 0;
    if (parsed.stat === "pass_yds" || parsed.stat === "rec_yds") z = (0.5 - win) * 0.22;
    else if (parsed.stat === "rush_yds" || parsed.stat === "rush_att") z = (win - 0.5) * 0.28;
    else if (parsed.stat === "anytime_td" || parsed.stat === "two_plus_td") z = (win - 0.5) * 0.35;
    else if (parsed.stat === "points" || parsed.stat === "pra") z = (win - 0.45) * 0.12;
    if (Math.abs(z) >= 0.02) {
      push(layers, {
        id: "script",
        label: "Game script",
        p: invLogit(z),
        precision: 3.1,
        family: "game",
        note: `Team win chance ${Math.round(win * 100)}%. Favorites run; dogs throw. Script is a nudge, not a rewrite.`,
      });
    }
  }

  const wind = input.weatherWind;
  const precip = input.weatherPrecip;
  const temp = input.weatherTemp;
  const isPassing = parsed.stat === "pass_yds" || parsed.stat === "rec_yds" || parsed.stat === "receptions";
  const isRushing = parsed.stat === "rush_yds" || parsed.stat === "rush_att";
  const isGridiron = isPassing || isRushing;
  const isBaseball = parsed.stat === "ks" || parsed.stat === "hr" || parsed.stat === "hits";

  if (isGridiron || isBaseball) {
    let z = 0;
    const bits: string[] = [];

    // Gridiron Weather Compounding
    if (isGridiron) {
      let runRatio = 0.5;
      const passYds = input.ownLooks?.season?.passYdsG;
      const rushYds = input.ownLooks?.season?.rushYdsG;
      if (passYds && rushYds) {
         runRatio = rushYds / (passYds + rushYds);
      }

      if (wind != null && wind >= 12) {
        const passReliance = Math.max(0, 0.7 - runRatio);
        const windPenalty = clip((wind - 10) * 0.02 * passReliance, 0, 0.25);
        
        if (isPassing) {
          z -= windPenalty;
          bits.push(`wind ${wind} mph (Pass Reliance: ${(passReliance * 100).toFixed(0)}%)`);
        } else if (isRushing) {
          z += (windPenalty * 0.5); 
          bits.push(`wind ${wind} mph forces ground game`);
        }
      }

      if (precip != null && precip >= 40) {
         if (isPassing) {
           z -= 0.05;
           bits.push(`rain ${precip}% cuts air game`);
         } else if (isRushing) {
           z += 0.03;
           bits.push(`rain ${precip}% forces ground game`);
         }
      }
    }

    // Baseball Weather
    if (isBaseball) {
      if (wind != null && wind >= 12) {
        if (parsed.stat === "hr") {
          z += clip((wind - 10) * 0.006, 0, 0.08);
          bits.push(`wind ${wind} mph`);
        }
      }
      if (precip != null && precip >= 40 && parsed.stat === "hits") {
        z -= 0.05;
        bits.push(`rain ${precip}%`);
      }
      if (temp != null && temp >= 85 && (parsed.stat === "hr" || parsed.stat === "hits")) {
        z += 0.04;
        bits.push(`${temp}F`);
      }
    }

    if (bits.length && Math.abs(z) > 0.01) {
      push(layers, {
        id: "weather",
        label: "Weather Compounding",
        p: invLogit(z),
        precision: 4.5,
        family: "alpha",
        note: `[ALPHA] ${bits.join(" | ")}. Dynamically compounds weather against team's offensive identity.`,
      });
    }
  }

  const park = parkHits(input.venue);
  if (park != null && (parsed.stat === "hits" || parsed.stat === "hr" || parsed.stat === "total_bases" || parsed.stat === "hrr" || parsed.stat === "runs" || parsed.stat === "rbi")) {
    const z = clip((park - 1) * 1.1, -0.14, 0.16);
    push(layers, {
      id: "park",
      label: "Ballpark",
      p: invLogit(z),
      precision: 3.6,
      family: "context",
      note: `${input.venue} hitting factor ${park.toFixed(2)}. Coors is not Petco.`,
    });
  }

  if (input.restDays != null && Number.isFinite(input.restDays) && input.restDays <= 1) {
    push(layers, {
      id: "rest",
      label: "Rest / B2B",
      p: invLogit(-0.04),
      precision: 1.6,
      family: "context",
      note: "Back-to-back. Counting stats usually shrink a little.",
    });
  } else {
    pushEmpty(layers, "rest", "Rest / B2B", "Looked up rest from the live log. No B2B posted on this player ticket.");
  }

  const hitting =
    parsed.stat === "hits" ||
    parsed.stat === "hr" ||
    parsed.stat === "rbi" ||
    parsed.stat === "runs" ||
    parsed.stat === "total_bases" ||
    parsed.stat === "hrr" ||
    parsed.stat === "walks";
  const leagueOpp = hitting || parsed.stat === "ks" ? 4.2 : input.sport === "NBA" ? 112 : input.sport === "NFL" ? 22 : 1;
  if (input.oppAllowed != null && Number.isFinite(input.oppAllowed) && input.oppAllowed > 0) {
    const z = clip((input.oppAllowed / leagueOpp - 1) * 0.85, -0.16, 0.16);
    push(layers, {
      id: "defense",
      label: "Opponent-adjusted defense",
      p: invLogit(hitting || parsed.stat === "points" || parsed.stat === "pra" || parsed.stat === "pass_yds" || parsed.stat === "rush_yds" || parsed.stat === "rec_yds" ? z : z * 0.6),
      precision: 3.2,
      family: "game",
      note: hitting
        ? `Opposing staff ERA/OPS allowed ${input.oppAllowed.toFixed(2)} vs a ${leagueOpp} league mark. Live ESPN team stats, last-7 when posted.`
        : `Opponent environment ${input.oppAllowed.toFixed(1)} vs typical ${leagueOpp}. Last-10 allowed / live team stats ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â not a made-up rank.`,
    });
  } else {
    pushEmpty(
      layers,
      "defense",
      "Opponent-adjusted defense",
      "Looked up opponent ERA / OPS allowed / last-10 points allowed. Not posted on this delayed board.",
      "game",
    );
  }

  if (input.usageMin != null && Number.isFinite(input.usageMin) && input.usageMin > 0) {
    let z = 0;
    if (input.sport === "NBA" || input.sport === "NCAAB") {
      if (input.usageMin < 18) z = -0.1;
      else if (input.usageMin < 24) z = -0.04;
      else if (input.usageMin >= 34) z = 0.03;
    }
    push(layers, {
      id: "usage",
      label: "Minutes / usage filter",
      p: invLogit(z),
      precision: Math.abs(z) >= 0.03 ? 2.4 : 1.2,
      family: "game",
      note: `Last-10 gamelog kept games at ~${input.usageMin.toFixed(1)} minutes (dropped DNPs / blowout benched games under half usual). Live ESPN log.`,
      thin: Math.abs(z) < 0.03,
    });
  } else {
    pushEmpty(
      layers,
      "usage",
      "Minutes / usage filter",
      "Looked up minutes on the live ESPN gamelog. This sport/player does not post minutes (or the log is empty). Empty look, not a guess.",
      "game",
    );
  }

  if (input.pitcherEra != null && Number.isFinite(input.pitcherEra) && input.pitcherEra > 0) {
    const z = hitting
      ? clip((input.pitcherEra - 4.2) * 0.045, -0.14, 0.14)
      : parsed.stat === "ks"
        ? clip((4.2 - input.pitcherEra) * 0.04, -0.12, 0.12)
        : 0;
    push(layers, {
      id: "pitcher",
      label: hitting ? "Opposing starter ERA" : "Starting pitcher",
      p: invLogit(z),
      precision: 3.4,
      family: "game",
      note: hitting
        ? `Opposing starter ERA ${input.pitcherEra.toFixed(2)}. Live probable from ESPN ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â the pitcher-vs-batter number we can actually fetch tonight.`
        : `Starter ERA ${input.pitcherEra.toFixed(2)} from the live ESPN probable.`,
      thin: Math.abs(z) < 0.02,
    });
  } else {
    pushEmpty(
      layers,
      "pitcher",
      "Starting pitcher",
      "Looked up tonight's probable ERA. Not posted yet (or this is not a baseball ticket).",
      "game",
    );
  }

  if (input.ownUnderlying != null && Number.isFinite(input.ownUnderlying)) {
    const z = clip((input.ownUnderlying - 0.38) * 0.55, -0.12, 0.12);
    push(layers, {
      id: "underlying",
      label: "Underlying (OBP + ISO / process)",
      p: invLogit(z),
      precision: 2.6,
      family: "game",
      note: `Process look ${input.ownUnderlying.toFixed(3)} (OBP+ISO or last-7). xG-style: how they reached base and hit for extra bases, not just runs that already scored. Live ESPN splits.`,
    });
  } else if (input.seasonRate != null && input.recentRate != null && input.seasonRate > 0) {
    const z = clip((input.seasonRate - input.recentRate) / (input.seasonRate + 0.05) * 0.12, -0.08, 0.08);
    push(layers, {
      id: "underlying",
      label: "Underlying (season vs last-10)",
      p: invLogit(z),
      precision: 1.8,
      family: "game",
      note: `Season ${input.seasonRate.toFixed(2)} vs last-10 ${input.recentRate.toFixed(2)} ${parsed.statLabel}. Process vs a hot/cold streak ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â we do not treat 8/10 as a lock.`,
      thin: true,
    });
  } else {
    pushEmpty(
      layers,
      "underlying",
      "Underlying (OBP + ISO / process)",
      "Looked up live ISO/OBP/ERA. Not posted for this sport/player yet.",
      "game",
    );
  }

  if (input.vsHandOps != null && Number.isFinite(input.vsHandOps) && input.pitcherHand) {
    const z = clip((input.vsHandOps - 0.72) * 0.7, -0.12, 0.12);
    push(layers, {
      id: "platoon",
      label: `Pitcher vs batter (vs ${input.pitcherHand}HP)`,
      p: invLogit(hitting ? z : 0),
      precision: 2.2,
      family: "game",
      note: `Team OPS ${input.vsHandOps.toFixed(3)} vs ${input.pitcherHand}HP tonight. Live ESPN vs-L/R split against the probable's throwing hand.`,
    });
  } else {
    pushEmpty(
      layers,
      "platoon",
      "Pitcher vs batter (vs L/R)",
      "Looked up vs-LHP / vs-RHP and the probable's throwing hand. Hand or split not posted yet.",
      "game",
    );
  }

  const processLook = processFromLooks(input.sport, input.homeLooks, input.awayLooks);
  if (processLook.empty) {
    pushEmpty(layers, "process", processLook.source, processLook.note, "game");
  } else {
    push(layers, {
      id: "process",
      label: processLook.source,
      p: 0.5,
      precision: 0.4,
      family: "game",
      note: processLook.note,
    });
  }

  const over = poolOver(layers);
  const hit = photographedIsOver ? over : 1 - over;
  const yesNo = parsed.side === "yes" || parsed.side === "no";
  let lean: PropReport["lean"] = "pass";
  if (yesNo) lean = hit >= 0.52 ? parsed.side : hit <= 0.46 ? (parsed.side === "yes" ? "no" : "yes") : "pass";
  else if (over >= 0.53) lean = "over";
  else if (over <= 0.47) lean = "under";
  const confidence: PropReport["confidence"] =
    layers.length >= 4 && Math.abs(hit - 0.5) >= 0.06 ? "high" : layers.length >= 2 ? "medium" : "low";

  const because = `${parsed.player} ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ${parsed.statLabel}. ${layers.length} live looks. Last-10 is EWMA of THIS stat (60/40 with season), plus opponent defense, usage, pitcher, and underlying. Not a generated card. Desk chance-to-hit ${Math.round(hit * 100)}%. Not a lock. Photograph Hard Rock to lock the live number.`;
  const customize = photographedIsOver
    ? hit >= 0.52
      ? `The model agrees with the photographed over. Still confirm the live Hard Rock number ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â delayed print is not a fill.`
      : `The photographed over is the side on the slip. The desk is cooler than the juice. Confirm at Hard Rock or sit.`
    : hit >= 0.52
      ? `The model agrees with the photographed under / no. Confirm the live number.`
      : `Photographed side is the slip. Desk is cooler. Confirm at Hard Rock or sit.`;

  return {
    player: parsed.player,
    stat: parsed.stat,
    statLabel: parsed.statLabel,
    side: parsed.side,
    line: parsed.line,
    hit,
    over,
    lean,
    confidence,
    layers,
    because,
    customize,
    illegal: false,
    standDown: false,
  };
}

const HIT_STATS = new Set<PropStat>(["hits", "hr", "rbi", "runs", "total_bases", "hrr", "walks", "stolen_bases"]);

export type PropLiveBrief = {
  homeLooks?: TeamLooks;
  awayLooks?: TeamLooks;
    ownLooks?: TeamLooks;
  homeEra?: number;
  awayEra?: number;
  homePitcherHand?: "L" | "R";
  awayPitcherHand?: "L" | "R";
  form?: Array<{ team: string; games?: Array<{ result: string; pf?: number; pa?: number }> }>;
  players?: Array<{
    name: string;
    team?: string;
    homeAway?: "home" | "away";
    usageMin?: number;
    stats?: Record<string, number>;
    recentStats?: Record<string, number>;
    recentN?: number;
  }>;
};

function playerIsAway(player: { name?: string; team?: string; homeAway?: string } | undefined, home: string, away: string, playerTeam?: string): boolean {
  if (player?.homeAway === "away") return true;
  if (player?.homeAway === "home") return false;
  const team = playerTeam || player?.team;
  if (team && namesHit(team, away) && !namesHit(team, home)) return true;
  return false;
}

/** Live ESPN looks for a player ticket ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â defense, usage, pitcher, underlying, platoon. */
export function propContextFromBrief(
  brief: PropLiveBrief | undefined,
  opts: { home: string; away: string; player?: string; playerTeam?: string; stat?: PropStat },
): Pick<
  PropInput,
  | "usageMin"
  | "oppAllowed"
  | "pitcherEra"
  | "ownUnderlying"
  | "pitcherHand"
  | "vsHandOps"
  | "seasonRate"
  | "recentRate"
  | "recentN"
  | "homeLooks"
  | "awayLooks"
    | "ownLooks"
    | "usageRipple"
> {
  const player = (brief?.players ?? []).find((p) => opts.player && namesHit(p.name, opts.player));
  const awaySide = playerIsAway(player, opts.home, opts.away, opts.playerTeam);
  const ownLooks = awaySide ? brief?.awayLooks : brief?.homeLooks;
  const oppLooks = awaySide ? brief?.homeLooks : brief?.awayLooks;
  const oppHand = awaySide ? brief?.homePitcherHand : brief?.awayPitcherHand;
  const ownEra = awaySide ? brief?.awayEra : brief?.homeEra;
  const oppEra = awaySide ? brief?.homeEra : brief?.awayEra;
  const stat = opts.stat;
  const hitting = stat != null && HIT_STATS.has(stat);
  const pitching = stat === "ks";

  let oppAllowed: number | undefined;
  if (hitting) {
    const era = allowedForStat(oppLooks, "era");
    const ops = allowedForStat(oppLooks, "hits");
    oppAllowed = era ?? ops ?? undefined;
  } else if (pitching) {
    oppAllowed = allowedForStat(oppLooks, "k9") ?? allowedForStat(oppLooks, "era") ?? undefined;
  } else if (stat === "pass_yds") {
    oppAllowed = allowedForStat(oppLooks, "pass") ?? undefined;
  } else if (stat === "rush_yds" || stat === "rush_att") {
    oppAllowed = allowedForStat(oppLooks, "rush") ?? undefined;
  } else if (stat === "rec_yds" || stat === "receptions") {
    oppAllowed = allowedForStat(oppLooks, "rec") ?? undefined;
  }
  if (oppAllowed == null) {
    const oppName = awaySide ? opts.home : opts.away;
    const block = (brief?.form ?? []).find((b) => b.team.toLowerCase() === oppName.toLowerCase());
    const read = analyzeScores(block?.games ?? [], 10);
    if (read && read.avgPa > 0) oppAllowed = read.avgPa;
  }

  const vsHand = oppHand === "L" ? ownLooks?.vsLeft : oppHand === "R" ? ownLooks?.vsRight : undefined;

  let usageRipple = 0;
  if (player && (stat === "rec_yds" || stat === "receptions" || stat === "rush_yds" || stat === "rush_att" || stat === "pass_yds" || stat === "pass_td" || stat === "points" || stat === "assists" || stat === "rebounds")) {
    const isOut = (st: string) => /out|il|doubtful|suspended|pup|ir/i.test(st ?? "");
    const ownInjuries = (brief?.injuries ?? []).filter(i => {
       const p = (brief?.players ?? []).find(p2 => p2.name && i.player && (p2.name === i.player || p2.name.includes(i.player) || i.player.includes(p2.name)));
       if (!p) return false;
       const pAway = p.team ? (p.team.toLowerCase() === opts.away.toLowerCase() || opts.away.toLowerCase().includes(p.team.toLowerCase())) : playerIsAway(p, opts.home, opts.away, p.team);
       return pAway === awaySide && isOut(i.status) && p.name !== player.name;
    });

    for (const inj of ownInjuries) {
       const p = (brief?.players ?? []).find(p2 => p2.name && inj.player && (p2.name === inj.player || p2.name.includes(inj.player)));
       if (!p) continue;
       const pos = (p.position || "").toUpperCase();
       const isGridiron = brief?.sport === "NFL" || brief?.sport === "NCAAF";
       const isHardwood = brief?.sport === "NBA" || brief?.sport === "NCAAB";
       
       if (isGridiron) {
         if (stat === "rec_yds" || stat === "receptions") {
           if (pos === "WR" || pos === "TE") usageRipple += 0.08; 
         } else if (stat === "rush_yds" || stat === "rush_att") {
           if (pos === "RB") usageRipple += 0.12; 
         } else if (stat === "pass_yds" || stat === "pass_td") {
           if (pos === "WR" || pos === "TE") usageRipple -= 0.04;
         }
       }
    }
  }

  return {
    usageMin: player?.usageMin,
    oppAllowed,
    pitcherEra: pitching ? ownEra : hitting ? oppEra : oppEra ?? ownEra,
    ownUnderlying: underlyingOffense(ownLooks?.last7) ?? underlyingOffense(ownLooks?.season) ?? undefined,
    pitcherHand: oppHand,
    vsHandOps: vsHand?.ops,
    seasonRate: stat && player?.stats ? rateFromStats(stat, player.stats) : undefined,
    recentRate: stat && player?.recentStats ? rateFromStats(stat, player.recentStats) : undefined,
    recentN: player?.recentN,
    homeLooks: brief?.homeLooks,
    awayLooks: brief?.awayLooks,
  };
}




