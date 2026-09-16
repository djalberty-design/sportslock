import { clip, clip01 } from "./math.ts";
import type { MarketType, PublicSplit, ScanRow, TapeLean } from "./types.ts";

export type TapeRead = {
  lean: TapeLean;
  divergence: number;
  note: string;
};

export type RawBookTape = {
  sport: string;
  home: string;
  away: string;
  homeAbbr?: string;
  awayAbbr?: string;
  marketType: MarketType;
  ticketHome: number;
  handleHome: number;
  steam?: boolean;
  source: string;
};



export function analyzeTape(ticketPct: number, handlePct: number, steam = false): TapeRead {
  const t = clip(ticketPct, 0.03, 0.97);
  const h = clip(handlePct, 0.03, 0.97);
  const divergence = h - t;
  const abs = Math.abs(divergence);
  if (abs < 0.07 && !steam) {
    return {
      lean: "neutral",
      divergence,
      note: `Bets ${Math.round(t * 100)}% · money ${Math.round(h * 100)}%. Tickets and dollars agree.`,
    };
  }
  if (divergence >= 0.07) {
    return {
      lean: "sharp",
      divergence,
      note: `Bets ${Math.round(t * 100)}% · money ${Math.round(h * 100)}%. More dollars than tickets on this side — sharp action${steam ? " (steaming)" : ""}.`,
    };
  }
  if (divergence <= -0.07) {
    return {
      lean: "public",
      divergence,
      note: `Bets ${Math.round(t * 100)}% · money ${Math.round(h * 100)}%. Public heavy.`,
    };
  }
  return {
    lean: steam ? "sharp" : "neutral",
    divergence,
    note: steam ? "Line is steaming." : `Bets ${Math.round(t * 100)}% · money ${Math.round(h * 100)}%.`,
  };
}

export function reconstructHandle(ticketHome: number, openHome?: number, closeHome?: number): number {
  const t = clip01(ticketHome);
  if (openHome == null || closeHome == null || !Number.isFinite(openHome) || !Number.isFinite(closeHome)) {
    return t;
  }
  const move = closeHome - openHome;
  if (t >= 0.62 && move < -0.012) return clip01(0.5 - (t - 0.5) * 0.55);
  if (t <= 0.38 && move > 0.012) return clip01(0.5 + (0.5 - t) * 0.55);
  if (Math.abs(move) >= 0.015) return clip01(t + move * 2.4);
  return t;
}

// Upgraded: Integrates Kelly Criterion to evaluate single-leg edges
export function deskScore(chance: number, price: number, lean?: TapeLean | null): number {
  if (!Number.isFinite(chance) || chance <= 0 || !Number.isFinite(price)) return -99;
  const pay = price >= 0 ? price / 100 : 100 / Math.abs(price);
  if (!(pay > 0)) return -99;
  
  const ev = chance * (1 + pay) - 1;
  const kelly = Math.max(0, (chance * pay - (1 - chance)) / pay);
  
  let s = (Math.pow(chance, 1.5) * Math.sqrt(pay) * 0.45) + (Math.max(ev, -0.05) * 0.35) + (kelly * 0.20);
  
  if (lean === "sharp") s += 0.06;
  else if (lean === "public") s -= 0.035;
  
  return s;
}

export function parlayScore(combinedFair: number, decimalPayout: number): number {
  if (!(combinedFair > 0) || !(decimalPayout > 1)) return -99;
  const profit = decimalPayout - 1;
  return Math.pow(combinedFair, 1.6) * Math.log(1 + profit) * 8 + combinedFair * 2.4;
}

export function stampRows(rows: ScanRow[], splits: PublicSplit[]): ScanRow[] {
  if (!splits.length) return rows;
  return rows.map((r) => {
    const hit =
      splits.find(
        (s) =>
          s.eventId === r.eventId &&
          (!s.marketType || s.marketType === r.marketType) &&
          (s.side === r.side ||
            s.side.toLowerCase().includes(r.side) ||
            namesOverlap(s.side, r.selection) ||
            (r.side === "home" && /home/i.test(s.side))),
      ) ?? splits.find((s) => s.eventId === r.eventId && (!s.marketType || s.marketType === "ml"));
    if (!hit) return r;
    const ticketsOnRow = pctOnSide(hit, r);
    const handleOnRow = handleOnSide(hit, r);
    const read = analyzeTape(ticketsOnRow, handleOnRow, Boolean(hit.steam));
    return {
      ...r,
      ticketPct: ticketsOnRow,
      handlePct: handleOnRow,
      tapeLean: hit.lean ?? read.lean,
      tapeNote: hit.note ?? read.note,
    };
  });
}

function pctOnSide(split: PublicSplit, row: ScanRow): number {
  const homeish =
    row.side === "home" ||
    namesOverlap(split.side, row.home) ||
    namesOverlap(split.side, row.selection);
  const t = (split.ticketPct || split.publicPct) / (split.ticketPct > 1 || split.publicPct > 1 ? 100 : 1);
  const unit = t > 1 ? t / 100 : t;
  if (row.side === "over") return unit;
  if (row.side === "under") return 1 - unit;
  return homeish && row.side !== "away" ? unit : 1 - unit;
}

function handleOnSide(split: PublicSplit, row: ScanRow): number {
  const h = split.handlePct / (split.handlePct > 1 ? 100 : 1);
  const unit = h > 1 ? h / 100 : h;
  if (row.side === "over") return unit;
  if (row.side === "under") return 1 - unit;
  const homeish = row.side === "home" || namesOverlap(split.side, row.home);
  return homeish && row.side !== "away" ? unit : 1 - unit;
}

function namesOverlap(a: string, b?: string): boolean {
  if (!b) return false;
  const na = a.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const nb = b.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

function asPct(n: unknown): number | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const p = n > 1 ? n / 100 : n;
  if (p <= 0 || p >= 1) return null;
  return p;
}

function walkPercents(node: unknown, depth = 0): { tickets?: number; money?: number } {
  if (!node || typeof node !== "object" || depth > 6) return {};
  const o = node as Record<string, unknown>;
  const tickets =
    asPct(o.tickets) ??
    asPct(o.ticket_percent) ??
    asPct(o.bets) ??
    asPct(o.bet_percent) ??
    asPct(o.public) ??
    asPct(o.public_percentage);
  const money =
    asPct(o.money) ??
    asPct(o.handle) ??
    asPct(o.money_percent) ??
    asPct(o.handle_percent) ??
    asPct(o.dollars);
  if (tickets != null || money != null) return { tickets: tickets ?? undefined, money: money ?? undefined };
  for (const v of Object.values(o)) {
    if (v && typeof v === "object") {
      const inner = walkPercents(v, depth + 1);
      if (inner.tickets != null || inner.money != null) return inner;
    }
  }
  return {};
}

export function parseActionNetworkScoreboard(json: unknown, sport: string): RawBookTape[] {
  if (!json || typeof json !== "object") return [];
  const root = json as Record<string, unknown>;
  const games = (Array.isArray(root.games) ? root.games : Array.isArray(json) ? json : []) as unknown[];
  const out: RawBookTape[] = [];
  for (const g of games) {
    if (!g || typeof g !== "object") continue;
    const game = g as Record<string, unknown>;
    const teams = Array.isArray(game.teams) ? (game.teams as Record<string, unknown>[]) : [];
    const homeId = game.home_team_id;
    const awayId = game.away_team_id;
    const homeT =
      teams.find((t) => homeId != null && t.id === homeId) ??
      teams.find((t) => t.is_home === true || t.home === true) ??
      teams.find((t) => String(t.is_away) === "false");
    const awayT =
      teams.find((t) => awayId != null && t.id === awayId) ??
      teams.find((t) => t !== homeT);
    const home = String(homeT?.full_name ?? homeT?.display_name ?? homeT?.name ?? "");
    const away = String(awayT?.full_name ?? awayT?.display_name ?? awayT?.name ?? "");
    if (!home || !away) continue;
    const odds = Array.isArray(game.odds) ? game.odds : [game.odds, game.markets, game.public_betting];
    let ticketHome: number | null = null;
    let handleHome: number | null = null;
    for (const block of odds) {
      if (!block || typeof block !== "object") continue;
      const o = block as Record<string, unknown>;
      const t =
        asPct(o.ml_home_public) ??
        asPct(o.spread_home_public) ??
        asPct(o.tickets) ??
        asPct(o.ticket_percent) ??
        asPct(o.public);
      const h =
        asPct(o.ml_home_money) ??
        asPct(o.spread_home_money) ??
        asPct(o.money) ??
        asPct(o.handle) ??
        asPct(o.money_percent);
      if (t != null) ticketHome = t;
      if (h != null) handleHome = h;
      if (t == null && h == null) {
        const p = walkPercents(block);
        if (p.tickets != null) ticketHome = p.tickets;
        if (p.money != null) handleHome = p.money;
      }
    }
    const ml = game.ml_public ?? game.public_ml;
    if (ticketHome == null && typeof ml === "number") ticketHome = asPct(ml);
    if (ticketHome == null) continue;
    const handle = handleHome ?? ticketHome;
    const steam = Boolean(game.steam || game.steam_move);
    out.push({
      sport,
      home,
      away,
      homeAbbr: homeT?.abbr ? String(homeT.abbr) : homeT?.abbreviation ? String(homeT.abbreviation) : undefined,
      awayAbbr: awayT?.abbr ? String(awayT.abbr) : awayT?.abbreviation ? String(awayT.abbreviation) : undefined,
      marketType: "ml",
      ticketHome,
      handleHome: handle,
      steam,
      source: "action-network",
    });
  }
  return out;
}

export function splitsFromEspnWinPct(opts: {
  eventId: string;
  home: string;
  away: string;
  homeWinPct?: number | null;
  awayWinPct?: number | null;
}): PublicSplit | null {
  const h = opts.homeWinPct != null ? asPct(opts.homeWinPct) : null;
  if (h == null) return null;
  const read = analyzeTape(h, h, false);
  return {
    eventId: opts.eventId,
    side: "home",
    marketType: "ml",
    publicPct: Math.round(h * 100),
    ticketPct: Math.round(h * 100),
    handlePct: Math.round(h * 100),
    lean: "neutral",
    source: "espn-winpct",
    note: `ESPN pick-center ${Math.round(h * 100)}% on ${opts.home}.`,
  };
}

export function rawToSplit(
  raw: RawBookTape,
  eventId: string,
  openHome?: number,
  closeHome?: number,
): PublicSplit {
  const handle = reconstructHandle(raw.ticketHome, openHome, closeHome);
  const handleUse = raw.handleHome !== raw.ticketHome ? raw.handleHome : handle;
  const read = analyzeTape(raw.ticketHome, handleUse, Boolean(raw.steam));
  return {
    eventId,
    side: "home",
    marketType: raw.marketType,
    publicPct: Math.round(raw.ticketHome * 100),
    ticketPct: Math.round(raw.ticketHome * 100),
    handlePct: Math.round(handleUse * 100),
    steam: raw.steam,
    lean: read.lean,
    source: raw.source,
    note: read.note,
  };
}

export function matchRawTape(
  raw: RawBookTape[],
  game: { eventId: string; sport: string; home: string; away: string; homeAbbr?: string; awayAbbr?: string },
): RawBookTape | undefined {
  const nh = game.home.toLowerCase();
  const na = game.away.toLowerCase();
  return raw.find((r) => {
    if (r.sport && r.sport !== game.sport) return false;
    const rh = r.home.toLowerCase();
    const ra = r.away.toLowerCase();
    const homeHit = rh.includes(nh) || nh.includes(rh) || (game.homeAbbr && r.homeAbbr === game.homeAbbr);
    const awayHit = ra.includes(na) || na.includes(ra) || (game.awayAbbr && r.awayAbbr === game.awayAbbr);
    return Boolean(homeHit && awayHit);
  });
}

export const AN_SPORT: Record<string, string> = {
  NFL: "nfl",
  NBA: "nba",
  MLB: "mlb",
  NHL: "nhl",
  NCAAF: "ncaaf",
  NCAAB: "ncaab",
};



