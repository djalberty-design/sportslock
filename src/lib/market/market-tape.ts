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
};

const PREGAME_MIN_MS = 6 * 60 * 60 * 1000;
const LIVE_MIN_MS = 20 * 60 * 1000;

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
      snapshot jsonb
    )
  `);
  await sql.query(
    `create index if not exists market_tape_event_idx on market_tape (event_id, market_type, side, snapped_at desc)`,
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
      };

      await sql.query(
        `insert into market_tape (
          event_id, sport, home, away, start, market_type, side, selection,
          line, price, model_probability, edge, phase, in_play, complete,
          home_score, away_score, period, clock, status_text, snapshot
        ) values (
          $1,$2,$3,$4,$5,$6,$7,$8,
          $9,$10,$11,$12,$13,$14,$15,
          $16,$17,$18,$19,$20,$21::jsonb
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

export async function getTapeStats(): Promise<TapeStats> {
  try {
    await ensureTapeTable();
    const sql = await getSql();
    const rows = await sql.query<{ phase: string; n: number; events: number }>(
      `select phase, count(*)::int as n, count(distinct event_id)::int as events
       from market_tape group by phase`,
    );
    const by = Object.fromEntries(rows.map((r) => [r.phase, r]));
    const total = rows.reduce((s, r) => s + Number(r.n || 0), 0);
    const events = await sql.query<{ n: number }>(`select count(distinct event_id)::int as n from market_tape`);
    return {
      total,
      pregame: Number(by.pregame?.n || 0),
      live: Number(by.live?.n || 0),
      final: Number(by.final?.n || 0),
      events: Number(events[0]?.n || 0),
    };
  } catch {
    return { total: 0, pregame: 0, live: 0, final: 0, events: 0 };
  }
}
