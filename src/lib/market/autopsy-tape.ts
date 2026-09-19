import { getSql } from "@/lib/db";

export type AutopsyBucket = "model_miss" | "echoed_book" | "high_variance" | "settled";

export type AutopsyRow = {
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
  bucket: string;
  note: string;
  resultHome: number | null;
  resultAway: number | null;
  snappedAt: string;
};

export type AutopsySummary = {
  ok: boolean;
  wins: number;
  losses: number;
  pushes: number;
  buckets: { bucket: string; wins: number; losses: number; total: number }[];
  bySport: { sport: string; wins: number; losses: number; total: number }[];
  byMarket: { market: string; wins: number; losses: number; total: number }[];
  recent: AutopsyRow[];
  error?: string;
};

function implied(price: number): number {
  if (!Number.isFinite(price) || price === 0) return NaN;
  if (price >= 0) return 100 / (price + 100);
  const a = Math.abs(price);
  return a / (a + 100);
}

export function bucketOf(opts: {
  status: string;
  modelProb?: number | null;
  edge?: number | null;
  price?: number | null;
}): AutopsyBucket {
  const status = String(opts.status || "").toUpperCase();
  const model = Number(opts.modelProb);
  const edge = Number(opts.edge);
  const book = implied(Number(opts.price));

  if (status === "LOSS" && Number.isFinite(model) && model >= 0.62) return "model_miss";
  if (status === "WIN" && Number.isFinite(model) && model <= 0.38) return "model_miss";
  if (Number.isFinite(model) && Number.isFinite(book) && Math.abs(model - book) < 0.025) return "echoed_book";
  if ((Number.isFinite(model) && model >= 0.47 && model <= 0.53) || (Number.isFinite(edge) && Math.abs(edge) < 0.03)) {
    return "high_variance";
  }
  return "settled";
}

export function autopsyNote(opts: {
  status: string;
  bucket: string;
  sport?: string | null;
  marketType?: string | null;
  selection?: string | null;
  line?: number | null;
  modelProb?: number | null;
  resultHome?: number | null;
  resultAway?: number | null;
}): string {
  const pct = Number.isFinite(Number(opts.modelProb)) ? `${Math.round(Number(opts.modelProb) * 100)}%` : "n/a";
  const score =
    opts.resultHome != null && opts.resultAway != null ? `${opts.resultAway}-${opts.resultHome}` : "final";
  const line = opts.line == null ? "" : ` ${opts.line}`;
  const label =
    opts.bucket === "model_miss"
      ? "Model was confident the other way."
      : opts.bucket === "echoed_book"
        ? "Chance matched the book. No extra edge."
        : opts.bucket === "high_variance"
          ? "Coin-flip number. Outcome does not prove the math wrong."
          : "Settled against the posted line.";
  return `${opts.sport || "Game"} ${opts.marketType || "market"}${line} ${opts.status}. ${opts.selection || ""} at ${pct} vs ${score}. ${label}`;
}

async function ensureAutopsyColumns() {
  const sql = await getSql();
  await sql.query(`alter table market_tape add column if not exists bucket text`);
  await sql.query(`alter table market_tape add column if not exists autopsy_note text`);
}

export async function runTapeAutopsy(): Promise<{ ok: boolean; tagged: number; error?: string }> {
  try {
    await ensureAutopsyColumns();
    const sql = await getSql();
    const rows = await sql.query<{
      id: string;
      status: string;
      model_probability: string | number | null;
      edge: string | number | null;
      price: string | number | null;
      sport: string | null;
      market_type: string | null;
      selection: string | null;
      line: string | number | null;
      result_home: number | null;
      result_away: number | null;
    }>(
      `select id, status, model_probability, edge, price, sport, market_type, selection, line, result_home, result_away
       from market_tape
       where status in ('WIN', 'LOSS', 'PUSH') and bucket is null
       limit 4000`,
    );
    let tagged = 0;
    for (const row of rows) {
      const bucket = bucketOf({
        status: row.status,
        modelProb: row.model_probability == null ? null : Number(row.model_probability),
        edge: row.edge == null ? null : Number(row.edge),
        price: row.price == null ? null : Number(row.price),
      });
      const note = autopsyNote({
        status: row.status,
        bucket,
        sport: row.sport,
        marketType: row.market_type,
        selection: row.selection,
        line: row.line == null ? null : Number(row.line),
        modelProb: row.model_probability == null ? null : Number(row.model_probability),
        resultHome: row.result_home,
        resultAway: row.result_away,
      });
      await sql.query(`update market_tape set bucket = $1, autopsy_note = $2 where id = $3`, [bucket, note, row.id]);
      tagged++;
    }
    return { ok: true, tagged };
  } catch (err) {
    console.error("tape autopsy failed:", err);
    return { ok: false, tagged: 0, error: String(err) };
  }
}

export async function getAutopsySummary(): Promise<AutopsySummary> {
  try {
    await ensureAutopsyColumns();
    const sql = await getSql();
    const buckets = await sql.query<{ bucket: string; status: string; n: number }>(
      `select coalesce(bucket, 'unreviewed') as bucket, status, count(*)::int as n
       from market_tape
       where status in ('WIN', 'LOSS', 'PUSH')
       group by 1, 2`,
    );
    const sports = await sql.query<{ sport: string; status: string; n: number }>(
      `select coalesce(sport, 'UNK') as sport, status, count(*)::int as n
       from market_tape
       where status in ('WIN', 'LOSS')
       group by 1, 2`,
    );
    const markets = await sql.query<{ market: string; status: string; n: number }>(
      `select coalesce(market_type, 'unk') as market, status, count(*)::int as n
       from market_tape
       where status in ('WIN', 'LOSS')
       group by 1, 2`,
    );
    const recent = await sql.query<Record<string, unknown>>(
      `select id, event_id, sport, home, away, market_type, side, selection, line, price,
              model_probability, edge, phase, status, bucket, autopsy_note, result_home, result_away, snapped_at
       from market_tape
       where status in ('WIN', 'LOSS', 'PUSH')
       order by graded_at desc nulls last, snapped_at desc
       limit 40`,
    );

    const fold = (rows: { key?: string; sport?: string; market?: string; bucket?: string; status: string; n: number }[], keyName: "bucket" | "sport" | "market") => {
      const map = new Map<string, { wins: number; losses: number; total: number }>();
      for (const r of rows) {
        const key = String((r as any)[keyName] || "unk");
        const cur = map.get(key) || { wins: 0, losses: 0, total: 0 };
        if (r.status === "WIN") cur.wins += r.n;
        if (r.status === "LOSS") cur.losses += r.n;
        cur.total += r.n;
        map.set(key, cur);
      }
      return [...map.entries()].map(([k, v]) => ({ [keyName]: k, ...v })) as any;
    };

    let wins = 0;
    let losses = 0;
    let pushes = 0;
    for (const r of buckets) {
      if (r.status === "WIN") wins += r.n;
      if (r.status === "LOSS") losses += r.n;
      if (r.status === "PUSH") pushes += r.n;
    }

    return {
      ok: true,
      wins,
      losses,
      pushes,
      buckets: fold(buckets as any, "bucket"),
      bySport: fold(sports as any, "sport"),
      byMarket: fold(markets as any, "market"),
      recent: recent.map((r) => ({
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
        status: String(r.status || ""),
        bucket: String(r.bucket || "unreviewed"),
        note: String(r.autopsy_note || ""),
        resultHome: r.result_home == null ? null : Number(r.result_home),
        resultAway: r.result_away == null ? null : Number(r.result_away),
        snappedAt: String(r.snapped_at || ""),
      })),
    };
  } catch (err) {
    return {
      ok: false,
      wins: 0,
      losses: 0,
      pushes: 0,
      buckets: [],
      bySport: [],
      byMarket: [],
      recent: [],
      error: String(err),
    };
  }
}
