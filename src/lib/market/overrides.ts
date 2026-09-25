import { getSql } from "../db.ts";
import { evPct } from "./engine.ts";
import type { ScanRow } from "./types.ts";

export type BrainOverride = {
  fingerprint: string;
  sport: string;
  market: string;
  chanceHaircut: number;
  sit: boolean;
  note: string;
};

let overridesTableEnsured = false;

async function ensureOverridesTable() {
  if (overridesTableEnsured) return;
  const sql = await getSql();
  await sql.query(`
    create table if not exists brain_overrides (
      fingerprint text primary key,
      sport text not null,
      market text not null,
      chance_haircut numeric not null default 0,
      sit boolean not null default false,
      note text,
      updated_at timestamptz not null default now()
    )
  `);
  overridesTableEnsured = true;
}

export async function upsertOverride(row: BrainOverride): Promise<void> {
  await ensureOverridesTable();
  const sql = await getSql();
  await sql.query(
    `insert into brain_overrides (fingerprint, sport, market, chance_haircut, sit, note, updated_at)
     values ($1,$2,$3,$4,$5,$6,now())
     on conflict (fingerprint) do update set
       sport = excluded.sport,
       market = excluded.market,
       chance_haircut = excluded.chance_haircut,
       sit = excluded.sit,
       note = excluded.note,
       updated_at = now()`,
    [row.fingerprint, row.sport, row.market, row.chanceHaircut, row.sit, row.note],
  );
}

export async function clearOverride(fingerprint: string): Promise<void> {
  await ensureOverridesTable();
  const sql = await getSql();
  await sql.query(`delete from brain_overrides where fingerprint = $1`, [fingerprint]);
}

export async function listOverrides(): Promise<BrainOverride[]> {
  try {
    await ensureOverridesTable();
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(`select * from brain_overrides`);
    return rows.map((r) => ({
      fingerprint: String(r.fingerprint),
      sport: String(r.sport || ""),
      market: String(r.market || ""),
      chanceHaircut: Number(r.chance_haircut || 0),
      sit: Boolean(r.sit),
      note: String(r.note || ""),
    }));
  } catch {
    return [];
  }
}

export function applyAcceptedOverrides(rows: ScanRow[], overrides: BrainOverride[]): ScanRow[] {
  if (!overrides.length) return rows;
  return rows.map((row) => {
    const hits = overrides.filter(
      (o) =>
        o.sport &&
        o.market &&
        o.sport === row.sport &&
        o.market === row.marketType,
    );
    if (!hits.length) return row;
    let next = { ...row };
    const photo = row.tapeStamp === "photographed" || row.tapeStamp === "hr-fl";
    for (const o of hits) {
      if (o.chanceHaircut > 0 && Number.isFinite(next.fairProb)) {
        next.fairProb = Math.min(0.99, Math.max(0.01, next.fairProb - o.chanceHaircut));
        next.evPct = evPct(next.price, next.fairProb);
        next.reason = `${next.reason} Accepted haircut ${Math.round(o.chanceHaircut * 100)} pts on ${o.sport} ${o.market}.`;
      }
      if (o.sit && !photo) {
        next.action = "stand_down";
        next.tag = next.tag === "illegal_fl" ? next.tag : "juiced";
        next.reason = `Accepted sit on ${o.sport} ${o.market}. Photograph Hard Rock if you still want the number.`;
      }
    }
    return next;
  });
}
