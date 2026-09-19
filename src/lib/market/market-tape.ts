import { getSql } from "@/lib/db";
import { snapshotWithLiveScores } from "./with-live-scores";
import { scoreQuotes, evPct } from "./engine";
import { isMainMarket } from "./universe";
import type { ScanRow } from "./types";

export type TapePhase = "pregame" | "live" | "final";

export type TapeStats = {
  total: number;
  pregame: number;
  live: number;
  final: number;
  events: number;
  lastWrote?: number;
  lastSkipped?: number;
  lastError?: string;
};

const PREGAME_MIN_MS = 6 * 60 * 60 * 1000;
const LIVE_MIN_MS = 5 * 60 * 1000;

async function ensureTapeTable() {
  const sql = await getSql();
  await sql.query(`
    create table if not exists market_tape (
      id uuid primary key default gen_random_uuid(),
      event_id text not null,
      sport text,
      home text,
      away text,
      start timestamptz,
      market_type text not null,
      side text,
      selection text not null,
      line numeric,
      price integer,
      model_probability numeric,
      edge numeric,
      phase text not null,
      in_play boolean not null default false,
      complete boolean not null default false,
      home_score integer,
      away_score integer,
      period text,
      clock text,
      status_text text,
      snapped_at timestamptz not null default now(),
      snapshot jsonb,
      status text,
      recommended boolean not null default false
    )
  `);
  await sql.query(`alter table market_tape add column if not exists status text`);
  await sql.query(`alter table market_tape add column if not exists recommended boolean not null default false`);
  await sql.query(
    `create index if not exists market_tape_event_idx on market_tape (event_id, market_type, side, snapped_at desc)`,
  );
  await sql.query(
    `create index if not exists market_tape_rec_idx on market_tape (recommended, status)`,
  );
}

function clipProb(n: number): number | null {
  if (!Number.isFinite(n)) return null;
  return Math.min(0.99, Math.max(0.01, n));
}

function phaseOf(row: ScanRow, now: number): TapePhase {
  if (row.inPlay) return "live";
  const start = row.start ? new Date(row.start).getTime() : NaN;
  const hasScore = row.homeScore != null && row.awayScore != null;
  if (hasScore && Number.isFinite(start) && start < now - 5 * 60 * 1000) return "final";
  if ((row as { complete?: boolean }).complete) return "final";
  return "pregame";
}

function tapeKey(row: ScanRow): string {
  return `${row.eventId}|${row.marketType}|${row.side}|${row.selection}`;
}

export async function runMarketTape(): Promise<{
  ok: boolean;
  wrote: number;
  skipped: number;
  error?: string;
}> {
  try {
    await ensureTapeTable();
    const sql = await getSql();
    const snap = await snapshotWithLiveScores();
    const rows = scoreQuotes(snap).filter(
      (r) =>
        isMainMarket(r.marketType) &&
        !r.isProp &&
        r.marketType !== "prop" &&
        r.sport !== "SYS" &&
        !r.scheduleOnly &&
        r.eventId,
    );

    const now = Date.now();
    const recent = await sql.query<{
      event_id: string;
      market_type: string;
      side: string;
      selection: string;
      phase: string;
      snapped_at: string | Date;
    }>(
      `select event_id, market_type, side, selection, phase, snapped_at
       from market_tape
       where snapped_at > now() - interval '36 hours'`,
    );

    const lastAt = new Map<string, number>();
    const hasFinal = new Set<string>();
    for (const t of recent) {
      const key = `${t.event_id}|${t.market_type}|${t.side}|${t.selection}|${t.phase}`;
      const at = new Date(t.snapped_at).getTime();
      const prev = lastAt.get(key) ?? 0;
      if (at > prev) lastAt.set(key, at);
      if (t.phase === "final") {
        hasFinal.add(`${t.event_id}|${t.market_type}|${t.side}|${t.selection}`);
      }
    }

    // Determine which side of each market is recommended (best edge)
    const marketKey = (r: ScanRow) => `${r.eventId}|${r.marketType}`;
    const marketGroups = new Map<string, ScanRow[]>();
    for (const row of rows) {
      const k = marketKey(row);
      const arr = marketGroups.get(k) || [];
      arr.push(row);
      marketGroups.set(k, arr);
    }

    // For each market, the row with the highest edge is recommended
    const recommendedSet = new Set<string>();
    for (const [, group] of marketGroups) {
      if (group.length === 0) continue;
      let best = group[0];
      for (const r of group) {
        const rEdge = Number.isFinite(r.fairProb) && Number.isFinite(r.price)
          ? evPct(r.price, r.fairProb)
          : -Infinity;
        const bEdge = Number.isFinite(best.fairProb) && Number.isFinite(best.price)
          ? evPct(best.price, best.fairProb)
          : -Infinity;
        if (rEdge > bEdge) best = r;
      }
      recommendedSet.add(tapeKey(best));
    }

    let wrote = 0;
    let skipped = 0;

    for (const row of rows) {
      const phase = phaseOf(row, now);
      const base = tapeKey(row);
      if (phase === "final" && hasFinal.has(base)) {
        skipped++;
        continue;
      }
      const stampKey = `${base}|${phase}`;
      const last = lastAt.get(stampKey) ?? 0;
      const minGap = phase === "live" ? LIVE_MIN_MS : phase === "pregame" ? PREGAME_MIN_MS : 0;
      if (minGap && last && now - last < minGap) {
        skipped++;
        continue;
      }

      const model = clipProb(row.fairProb);
      const price = Number.isFinite(row.price) ? Math.round(row.price) : null;
      const edge =
        model != null && price != null && Number.isFinite(evPct(price, model))
          ? evPct(price, model)
          : null;

      const isRecommended = recommendedSet.has(base);

      const compact = {
        asOf: snap.asOf,
        phase,
        eventId: row.eventId,
        sport: row.sport,
        home: row.home,
        away: row.away,
        start: row.start,
        marketType: row.marketType,
        side: row.side,
        selection: row.selection,
        price,
        point: row.point ?? null,
        fairProb: model,
        edge,
        inPlay: Boolean(row.inPlay),
        homeScore: row.homeScore ?? null,
        awayScore: row.awayScore ?? null,
        period: row.period ?? null,
        clock: row.clock ?? null,
        statusText: row.statusText ?? null,
        recommended: isRecommended,
      };

      await sql.query(
        `insert into market_tape (
          event_id, sport, home, away, start, market_type, side, selection,
          line, price, model_probability, edge, phase, in_play, complete,
          home_score, away_score, period, clock, status_text, snapshot, recommended
        ) values (
          $1,$2,$3,$4,$5,$6,$7,$8,
          $9,$10,$11,$12,$13,$14,$15,
          $16,$17,$18,$19,$20,$21::jsonb,$22
        )`,
        [
          row.eventId,
          row.sport ?? null,
          row.home ?? null,
          row.away ?? null,
          row.start ? new Date(row.start).toISOString() : null,
          row.marketType,
          row.side ?? null,
          row.selection,
          row.point ?? null,
          price,
          model,
          edge,
          phase,
          Boolean(row.inPlay),
          phase === "final",
          row.homeScore ?? null,
          row.awayScore ?? null,
          row.period != null ? String(row.period) : null,
          row.clock ?? null,
          row.statusText ?? null,
          JSON.stringify(compact),
          isRecommended,
        ],
      );
      wrote++;
      lastAt.set(stampKey, now);
      if (phase === "final") hasFinal.add(base);
    }

    return { ok: true, wrote, skipped };
  } catch (err) {
    console.error("market tape failed:", err);
    return { ok: false, wrote: 0, skipped: 0, error: String(err) };
  }
}

export async function getTapeStats(write = false): Promise<TapeStats> {
  let lastWrote = 0;
  let lastSkipped = 0;
  let lastError: string | undefined;
  if (write) {
    const run = await runMarketTape();
    lastWrote = run.wrote;
    lastSkipped = run.skipped;
    lastError = run.error;
  }
  try {
    await ensureTapeTable();
    // Run backfill if needed (one-time, idempotent)
    await backfillRecommended();
    const sql = await getSql();
    const rows = await sql.query<{ phase: string; n: number }>(
      `select phase, count(*)::int as n from market_tape where recommended = true group by phase`,
    );
    const by = Object.fromEntries(rows.map((r) => [r.phase, r]));
    const total = rows.reduce((s, r) => s + Number(r.n || 0), 0);
    const events = await sql.query<{ n: number }>(`select count(distinct event_id)::int as n from market_tape where recommended = true`);
    return {
      total,
      pregame: Number(by.pregame?.n || 0),
      live: Number(by.live?.n || 0),
      final: Number(by.final?.n || 0),
      events: Number(events[0]?.n || 0),
      lastWrote,
      lastSkipped,
      lastError,
    };
  } catch (err) {
    return {
      total: 0,
      pregame: 0,
      live: 0,
      final: 0,
      events: 0,
      lastWrote,
      lastSkipped,
      lastError: lastError || String(err),
    };
  }
}

/**
 * One-time backfill: mark the best-edge side of each event_id + market_type
 * as recommended = true for all existing rows that have recommended = false.
 * Idempotent — does nothing if rows already have recommended = true.
 */
let backfillRan = false;
async function backfillRecommended() {
  if (backfillRan) return;
  backfillRan = true;
  try {
    const sql = await getSql();
    // Check if any recommended rows exist
    const check = await sql.query<{ n: number }>(`select count(*)::int as n from market_tape where recommended = true limit 1`);
    if (Number(check[0]?.n) > 0) return; // Already backfilled

    // For each event_id + market_type group, mark the side with the highest edge as recommended
    await sql.query(`
      with ranked as (
        select id, 
               row_number() over (partition by event_id, market_type order by edge desc nulls last, model_probability desc nulls last) as rn
        from market_tape
      )
      update market_tape
      set recommended = true
      from ranked
      where market_tape.id = ranked.id and ranked.rn = 1
    `);
    console.log("backfillRecommended: completed");
  } catch (err) {
    console.error("backfillRecommended failed:", err);
    backfillRan = false; // Allow retry
  }
}

export type TapeDeskRow = {
  id: string;
  eventId: string;
  sport: string;
  home: string;
  away: string;
  marketType: string;
  side: string;
  selection: string;
  line: number | null;
  price: number | null;
  modelProb: number | null;
  edge: number | null;
  phase: string;
  status: string;
  snappedAt: string;
};

export async function listTapeDesk(limit = 80): Promise<TapeDeskRow[]> {
  try {
    await ensureTapeTable();
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select id, event_id, sport, home, away, market_type, side, selection, line, price,
              model_probability, edge, phase, coalesce(status, 'OPEN') as status, snapped_at,
              recommended
       from market_tape
       order by recommended desc, snapped_at desc
       limit $1`,
      [Math.max(1, Math.min(200, limit))],
    );
    return rows.map((r) => ({
      id: String(r.id),
      eventId: String(r.event_id || ""),
      sport: String(r.sport || ""),
      home: String(r.home || ""),
      away: String(r.away || ""),
      marketType: String(r.market_type || ""),
      side: String(r.side || ""),
      selection: String(r.selection || ""),
      line: r.line == null ? null : Number(r.line),
      price: r.price == null ? null : Number(r.price),
      modelProb: r.model_probability == null ? null : Number(r.model_probability),
      edge: r.edge == null ? null : Number(r.edge),
      phase: String(r.phase || ""),
      status: String(r.status || "OPEN"),
      snappedAt: String(r.snapped_at || ""),
    }));
  } catch {
    return [];
  }
}
