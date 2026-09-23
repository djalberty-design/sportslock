import { totalSigma } from "./chance.ts";
import { normalCdf } from "./math.ts";

export type LiveState = {
  eventId: string;
  sport: string;
  inPlay: boolean;
  complete: boolean;
  scoreHome?: number;
  scoreAway?: number;
  period?: string;
  clock?: string;
  down?: number;
  distance?: number;
  yardLine?: string;
  possession?: string;
  outs?: number;
  bases?: string;
  inningHalf?: string;
  strength?: string;
  goalie?: string;
  emptyNet?: boolean;
  already?: Record<string, number>;
  note: string;
  empty: boolean;
  thin: boolean;
};

export function emptyLive(eventId: string, sport: string, inPlay: boolean): LiveState {
  return {
    eventId,
    sport,
    inPlay,
    complete: false,
    note: inPlay
      ? "Looked up live state. Clock started but down/outs/strength not posted."
      : "Pre-tip. Live state empty.",
    empty: true,
    thin: true,
  };
}

export function parseLiveState(opts: {
  eventId: string;
  sport: string;
  inPlay: boolean;
  situation?: string;
  period?: number | string;
  clock?: string;
  homeScore?: number;
  awayScore?: number;
  detail?: Record<string, unknown>;
}): LiveState {
  if (!opts.inPlay) return emptyLive(opts.eventId, opts.sport, false);
  const sit = (opts.situation ?? "").toLowerCase();
  const d = opts.detail ?? {};
  const down = num(d.down) ?? (/(\d)(?:st|nd|rd|th)\s*&/.exec(sit) ? Number(RegExp.$1) : undefined);
  const outs = num(d.outs) ?? (/(\d)\s*out/.exec(sit) ? Number(RegExp.$1) : undefined);
  const strength = typeof d.strength === "string" ? d.strength : /power play|pp|pk|empty/i.test(sit) ? sit : undefined;
  const football = opts.sport === "NFL" || opts.sport === "NCAAF";
  const baseball = opts.sport === "MLB";
  const hockey = opts.sport === "NHL";
  const criticalMissing =
    (football && down == null) || (baseball && outs == null) || (hockey && !strength && !sit);
  const complete = !criticalMissing && (opts.homeScore != null || opts.awayScore != null);
  return {
    eventId: opts.eventId,
    sport: opts.sport,
    inPlay: true,
    complete,
    scoreHome: opts.homeScore,
    scoreAway: opts.awayScore,
    period: opts.period != null ? String(opts.period) : undefined,
    clock: opts.clock,
    down,
    distance: num(d.distance),
    yardLine: typeof d.yardLine === "string" ? d.yardLine : undefined,
    possession: typeof d.possession === "string" ? d.possession : undefined,
    outs,
    bases: typeof d.bases === "string" ? d.bases : undefined,
    inningHalf: typeof d.inningHalf === "string" ? d.inningHalf : undefined,
    strength,
    note: complete
      ? `Live ${opts.sport}: ${opts.awayScore ?? "—"}–${opts.homeScore ?? "—"} ${opts.period ?? ""} ${opts.clock ?? ""}`.trim()
      : "Live clock is on. Critical field missing.",
    empty: false,
    thin: !complete,
  };
}

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export function remainingMean(finalMean: number, already: number, clockFractionLeft: number): number {
  const left = Math.max(0.02, Math.min(1, clockFractionLeft));
  const rem = Math.max(0, finalMean - already);
  return rem * left + rem * (1 - left) * 0.15;
}

function parseClockMinutes(clock?: string): number {
  if (!clock) return 0;
  const m = /(\d+)\s*:\s*(\d+)/.exec(clock);
  if (m) return Number(m[1]) + Number(m[2]) / 60;
  const n = Number(clock);
  return Number.isFinite(n) ? n : 0;
}

export function clockFractionLeft(sport: string, period?: string | number, clock?: string): number {
  const mins = parseClockMinutes(clock);
  const p = Number(period);
  const periodN = Number.isFinite(p) && p > 0 ? p : undefined;
  if (sport === "MLB") {
    const inn = periodN ?? 5;
    return Math.max(0.05, Math.min(1, (9 - inn + 1) / 9));
  }
  if (sport === "NFL" || sport === "NCAAF") {
    const q = periodN ?? 3;
    const leftQ = Math.max(0, 4 - q);
    return Math.max(0.05, Math.min(1, (leftQ * 15 + mins) / 60));
  }
  if (sport === "NBA" || sport === "NCAAB") {
    const q = periodN ?? 3;
    const qLen = sport === "NCAAB" ? 10 : 12;
    const leftQ = Math.max(0, 4 - q);
    const total = sport === "NCAAB" ? 40 : 48;
    return Math.max(0.05, Math.min(1, (leftQ * qLen + mins) / total));
  }
  if (sport === "NHL") {
    const per = periodN ?? 2;
    const leftP = Math.max(0, 3 - per);
    return Math.max(0.05, Math.min(1, (leftP * 20 + mins) / 60));
  }
  return 0.5;
}

// Phase 2: Decoupled Variance Curves
function sportVarianceScale(sport: string, frac: number): number {
  const safeFrac = Math.max(0.05, Math.min(1, frac));
  if (sport === "NBA" || sport === "NCAAB") {
    // Basketball foul games keep variance extremely high late
    return Math.pow(safeFrac, 0.60);
  }
  if (sport === "NHL") {
    // Empty net scenarios create an artificial variance floor
    return safeFrac < 0.12 ? Math.max(0.18, safeFrac * 1.5) : Math.pow(safeFrac, 0.85);
  }
  if (sport === "MLB") {
    // Discrete outs yield perfectly linear decay
    return safeFrac;
  }
  // NFL / Default: Standard sub-linear decay
  return Math.pow(safeFrac, 0.85);
}

export function leftoverOverProb(opts: {
  sport: string;
  postedTotal: number;
  already: number;
  period?: string;
  clock?: string;
}): number {
  const frac = clockFractionLeft(opts.sport, opts.period, opts.clock);
  const rem = remainingMean(opts.postedTotal, opts.already, frac);
  const need = opts.postedTotal - opts.already;
  
  if (need <= 0) return 0.99;
  
  const timeScale = sportVarianceScale(opts.sport, frac);
  const sigma = Math.max(0.25, totalSigma(opts.sport) * Math.sqrt(timeScale));
  
  const z = (need - rem) / sigma;
  const pOver = 1 - normalCdf(z);
  return Math.min(0.99, Math.max(0.01, pOver));
}

export function liveFromRow(row: {
  eventId: string;
  sport: string;
  inPlay?: boolean;
  homeScore?: number;
  awayScore?: number;
  period?: string;
  clock?: string;
  situation?: string;
}): LiveState {
  return parseLiveState({
    eventId: row.eventId,
    sport: row.sport,
    inPlay: Boolean(row.inPlay),
    situation: row.situation,
    period: row.period,
    clock: row.clock,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
  });
}

export function liveQuality(base: number, s: LiveState | undefined, completeness = 0): number {
  if (!s?.inPlay) return base;
  const floor = 0.52;
  if (s.complete && completeness > 0) {
    return Math.max(0.28, Math.min(1, base * Math.max(floor, floor + 0.2 * Math.min(1, completeness))));
  }
  return Math.max(0.28, base * floor);
}
import type { GameLatent } from "./sim.ts";

export function applyLiveRemaining(
  g: GameLatent,
  live: { inPlay?: boolean; homeScore?: number; awayScore?: number; period?: string; clock?: string; start?: string }
): GameLatent {
  const isStarted = Boolean(live.inPlay || (live.start && new Date(live.start).getTime() <= Date.now()));
  if (!isStarted) return g;
  
  if (live.homeScore == null || live.awayScore == null) {
    return {
      ...g,
      thin: true,
      note: `${g.note} · Score missing · thin.`.trim(),
    };
  }
  
  const frac = clockFractionLeft(g.sport, live.period, live.clock);
  
  const newMuH = live.homeScore + remainingMean(g.muH, live.homeScore, frac);
  const newMuA = live.awayScore + remainingMean(g.muA, live.awayScore, frac);
  
  const timeScale = sportVarianceScale(g.sport, frac);
  const newSigM = Math.max(0.25, g.sigM * Math.sqrt(timeScale));
  const newSigT = Math.max(0.25, g.sigT * Math.sqrt(timeScale));
  
  const z = (newMuH - newMuA) / newSigM;
  const pWinH = normalCdf(z); 

  return {
    ...g,
    muH: newMuH,
    muA: newMuA,
    sigM: newSigM,
    sigT: newSigT,
    pWinH,
    note: `${g.note} · Live remaining G applied.`.trim(),
  };
}

