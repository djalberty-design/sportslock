/**
 * Lineup / usage vector U. Scratches move opportunity; count-of-bodies is the light backup.
 */
import type { PlayerBrief } from "./types.ts";
import { isCollegeSport } from "./universe.ts";

export type UsagePlayer = {
  id: string;
  name: string;
  team: string;
  position: string;
  homeAway: "home" | "away";
  opportunity: number;
  standDown: boolean;
  thin: boolean;
  note: string;
};

export type UsageVector = {
  eventId: string;
  sport: string;
  players: UsagePlayer[];
  precision: number;
  ran: boolean;
  thin: boolean;
  empty: boolean;
  note: string;
};

function listedOut(status?: string): boolean {
  return /out|injured reserve|\bil\b|10-day|15-day|60-day|inactive|doubtful|suspended|deceased/i.test(
    status ?? "",
  );
}

function questionable(status?: string): boolean {
  return /questionable|game.time|gtd|probable/i.test(status ?? "");
}

function baseOpp(p: PlayerBrief): number {
  if (p.usageMin != null && p.usageMin > 0) return Math.min(1, p.usageMin / 36);
  if (p.starter) return 0.78;
  return 0.32;
}

export function buildUsage(opts: {
  eventId: string;
  sport: string;
  players?: PlayerBrief[];
  injuries?: Array<{ player: string; status: string; team?: string }>;
  lineupConfirmed?: boolean;
}): UsageVector {
  const players = opts.players ?? [];
  const injuries = opts.injuries ?? [];
  if (!players.length) {
    const listed = injuries.filter((i) => listedOut(i.status));
    if (!listed.length) {
      return {
        eventId: opts.eventId,
        sport: opts.sport,
        players: [],
        precision: 0.9,
        ran: false,
        thin: true,
        empty: true,
        note: "Looked up lineup / usage. No roster posted. Empty look, not a guess.",
      };
    }
    const college = isCollegeSport(opts.sport);
    const out: UsagePlayer[] = listed.map((i) => ({
      id: i.player,
      name: i.player,
      team: i.team ?? "",
      position: "U",
      homeAway: "home" as const,
      opportunity: 0,
      standDown: true,
      thin: true,
      note: college
        ? "College player usage moves the game latent only. No Florida player ticket."
        : `${i.player} listed out. Tickets omitted. Leftover opportunity Looked — no roster to give it to.`,
    }));
    return {
      eventId: opts.eventId,
      sport: opts.sport,
      players: out,
      precision: 1.2,
      ran: true,
      thin: true,
      empty: false,
      note: "Roster not posted. Listed-out names stand down. Leftover opportunity Looked — we do not invent a depth chart.",
    };
  }

  const college = isCollegeSport(opts.sport);
  const out: UsagePlayer[] = [];
  const lostByPos = new Map<string, number>();

  for (const p of players) {
    const lastName = (p.name.split(" ").pop() ?? "___").toLowerCase();
    const hit = injuries.find((i) => {
      const nameMatch = i.player.toLowerCase().includes(lastName);
      if (!nameMatch) return false;
      // If injury has team info, require team match to prevent cross-team bleed
      if (i.team && p.team) return i.team.toLowerCase() === p.team.toLowerCase();
      return true;
    });
    const isOut = hit ? listedOut(hit.status) : false;
    const gtd = hit ? questionable(hit.status) && !isOut : false;
    let opp = baseOpp(p);
    if (isOut) opp = 0;
    else if (gtd) opp *= 0.55;
    const pos = (p.position || "U").toUpperCase();
    if (isOut) lostByPos.set(pos, (lostByPos.get(pos) ?? 0) + baseOpp(p));
    out.push({
      id: p.id,
      name: p.name,
      team: p.team,
      position: pos,
      homeAway: p.homeAway,
      opportunity: opp,
      standDown: isOut,
      thin: gtd,
      note: isOut
        ? `${p.name} listed out. Tickets omitted.`
        : gtd
          ? `${p.name} game-time. Mix 55/45 in/out. Cannot be The Call.`
          : `${p.name} opportunity ${(opp * 100).toFixed(0)}%.`,
    });
  }

  // Depth-chart kernel: leftover opportunity to same-position rotation.
  for (const [pos, lost] of lostByPos) {
    const pool = out.filter((p) => !p.standDown && p.position === pos);
    if (!pool.length || lost <= 0) continue;
    const share = lost / pool.length;
    for (const p of pool) {
      if (opts.sport === "NBA" || opts.sport === "NCAAB") p.opportunity = Math.min(0.95, p.opportunity + Math.min(0.22, share));
      else if (opts.sport === "NFL" || opts.sport === "NCAAF") p.opportunity = Math.min(0.92, p.opportunity + Math.min(0.12, share * 0.7));
      else p.opportunity = Math.min(0.9, p.opportunity + share * 0.4);
    }
  }

  if (college) {
    for (const p of out) {
      p.standDown = true;
      p.note = "College player usage moves the game latent only. No Florida player ticket.";
    }
  }

  const confirmed = Boolean(opts.lineupConfirmed) || out.some((p) => p.opportunity >= 0.7);
  return {
    eventId: opts.eventId,
    sport: opts.sport,
    players: out,
    precision: confirmed ? 5.8 : 2.4,
    ran: true,
    thin: !confirmed,
    empty: false,
    note: confirmed
      ? "Starting lineup / usage from live ESPN roster. Scratches transmit leftover opportunity."
      : "Projected usage. Lineup not confirmed. Thin.",
  };
}

export function usageOf(u: UsageVector | undefined, name?: string): UsagePlayer | undefined {
  if (!u || !name) return undefined;
  const n = name.toLowerCase();
  return u.players.find((p) => p.name.toLowerCase() === n || p.name.toLowerCase().includes(n) || n.includes(p.name.toLowerCase()));
}
