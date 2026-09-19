import { getSql } from "@/lib/db";

export type SuggestionStatus = "pending" | "accepted" | "rejected" | "later";

export type BrainSuggestion = {
  id: string;
  fingerprint: string;
  title: string;
  body: string;
  knob: string;
  proposed: Record<string, unknown> | null;
  evidence: Record<string, unknown>;
  status: SuggestionStatus;
  createdAt: string;
  decidedAt: string | null;
};

async function ensureSuggestionsTable() {
  const sql = await getSql();
  await sql.query(`
    create table if not exists brain_suggestions (
      id uuid primary key default gen_random_uuid(),
      fingerprint text not null,
      title text not null,
      body text not null,
      knob text not null default 'none',
      proposed jsonb,
      evidence jsonb,
      status text not null default 'pending',
      created_at timestamptz not null default now(),
      decided_at timestamptz
    )
  `);
  await sql.query(`create index if not exists brain_suggestions_fp_idx on brain_suggestions (fingerprint, status, created_at desc)`);
}

function mapRow(r: Record<string, unknown>): BrainSuggestion {
  return {
    id: String(r.id),
    fingerprint: String(r.fingerprint),
    title: String(r.title),
    body: String(r.body),
    knob: String(r.knob || "none"),
    proposed: (r.proposed as Record<string, unknown>) || null,
    evidence: (r.evidence as Record<string, unknown>) || {},
    status: String(r.status) as SuggestionStatus,
    createdAt: String(r.created_at || ""),
    decidedAt: r.decided_at ? String(r.decided_at) : null,
  };
}

export async function listSuggestions(): Promise<BrainSuggestion[]> {
  await ensureSuggestionsTable();
  const sql = await getSql();
  const rows = await sql.query<Record<string, unknown>>(
    `select * from brain_suggestions order by created_at desc limit 80`,
  );
  return rows.map(mapRow);
}

export async function decideSuggestion(id: string, status: SuggestionStatus): Promise<{ ok: boolean }> {
  if (!["accepted", "rejected", "later", "pending"].includes(status)) return { ok: false };
  await ensureSuggestionsTable();
  const sql = await getSql();
  await sql.query(
    `update brain_suggestions set status = $1, decided_at = now() where id = $2`,
    [status, id],
  );
  return { ok: true };
}

async function alreadyOpen(fingerprint: string): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql.query<{ n: number }>(
    `select count(*)::int as n from brain_suggestions
     where fingerprint = $1
       and (
         status in ('pending', 'accepted')
         or (status = 'rejected' and created_at > now() - interval '14 days')
         or (status = 'later' and created_at > now() - interval '2 days')
       )`,
    [fingerprint],
  );
  return Number(rows[0]?.n || 0) > 0;
}

async function insertSuggestion(row: {
  fingerprint: string;
  title: string;
  body: string;
  knob: string;
  proposed: Record<string, unknown> | null;
  evidence: Record<string, unknown>;
}) {
  if (await alreadyOpen(row.fingerprint)) return false;
  const sql = await getSql();
  await sql.query(
    `insert into brain_suggestions (fingerprint, title, body, knob, proposed, evidence, status)
     values ($1,$2,$3,$4,$5::jsonb,$6::jsonb,'pending')`,
    [row.fingerprint, row.title, row.body, row.knob, JSON.stringify(row.proposed), JSON.stringify(row.evidence)],
  );
  return true;
}

export async function buildSuggestions(): Promise<{ ok: boolean; created: number; error?: string }> {
  try {
    await ensureSuggestionsTable();
    const sql = await getSql();
    const slices = await sql.query<{ sport: string; market: string; wins: number; losses: number; decided: number; miss: number; echoed: number; variance: number }>(
      `select coalesce(sport,'UNK') as sport,
              coalesce(market_type,'unk') as market,
              count(*) filter (where status = 'WIN')::int as wins,
              count(*) filter (where status = 'LOSS')::int as losses,
              count(*) filter (where status in ('WIN','LOSS'))::int as decided,
              count(*) filter (where bucket = 'model_miss')::int as miss,
              count(*) filter (where bucket = 'echoed_book')::int as echoed,
              count(*) filter (where bucket = 'high_variance')::int as variance
       from market_tape
       where status in ('WIN','LOSS','PUSH')
       group by 1, 2`,
    );
    const totals = slices.reduce(
      (acc, s) => {
        acc.decided += Number(s.decided || 0);
        acc.wins += Number(s.wins || 0);
        acc.losses += Number(s.losses || 0);
        acc.miss += Number(s.miss || 0);
        acc.echoed += Number(s.echoed || 0);
        acc.variance += Number(s.variance || 0);
        return acc;
      },
      { decided: 0, wins: 0, losses: 0, miss: 0, echoed: 0, variance: 0 },
    );

    let created = 0;

    if (totals.decided < 8) {
      if (await insertSuggestion({
        fingerprint: "sample-too-small",
        title: "Not enough graded finals to move knobs",
        body: `Tape has ${totals.decided} decided game markets. Keep Kelly 0.25x and the current EV floor. Suggestions that change the brain wait until a slice has at least 8 graded wins+losses.`,
        knob: "none",
        proposed: null,
        evidence: totals,
      })) created++;
      return { ok: true, created };
    }

    for (const s of slices) {
      const decided = Number(s.decided || 0);
      if (decided < 8) continue;
      const wr = decided ? Number(s.wins) / decided : 0;
      const sport = s.sport;
      const market = s.market;
      const ev = { ...s, winRate: Math.round(wr * 100) };

      if (Number(s.miss) >= 4 && Number(s.miss) / Math.max(decided, 1) >= 0.3) {
        if (await insertSuggestion({
          fingerprint: `miss|${sport}|${market}`,
          title: `${sport} ${market}: model too confident`,
          body: `${s.miss} of ${decided} graded ${sport} ${market} snaps are model-miss (${Math.round(wr * 100)}% hit). Do not raise chance on this slice. Next step if you accept later: haircut displayed chance 5 points on ${sport} ${market} only.`,
          knob: "none",
          proposed: { sport, market, chanceHaircut: 0.05 },
          evidence: ev,
        })) created++;
      }

      if (Number(s.echoed) / Math.max(decided, 1) >= 0.5) {
        if (await insertSuggestion({
          fingerprint: `echo|${sport}|${market}`,
          title: `${sport} ${market}: mostly echoing the book`,
          body: `${s.echoed} of ${decided} graded snaps match the book price. There is no extra edge to print. Sit unless you photograph Hard Rock.`,
          knob: "none",
          proposed: { sport, market, action: "sit" },
          evidence: ev,
        })) created++;
      }

      if (Number(s.variance) / Math.max(decided, 1) >= 0.5) {
        if (await insertSuggestion({
          fingerprint: `var|${sport}|${market}`,
          title: `${sport} ${market}: coin-flip tape`,
          body: `${s.variance} of ${decided} snaps are high-variance. A 50/50 hit rate here is not a brain bug. Do not cut Kelly off this slice alone.`,
          knob: "none",
          proposed: { sport, market, action: "hold-kelly" },
          evidence: ev,
        })) created++;
      }
    }

    if (totals.echoed / Math.max(totals.decided, 1) >= 0.6) {
      if (await insertSuggestion({
        fingerprint: "global-echo",
        title: "Desk is mostly the market",
        body: `${totals.echoed} of ${totals.decided} graded snaps echoed the book. Keep min EV where it is. Do not add narrative alpha on top of the same number.`,
        knob: "none",
        proposed: null,
        evidence: totals,
      })) created++;
    }

    return { ok: true, created };
  } catch (err) {
    console.error("build suggestions failed:", err);
    return { ok: false, created: 0, error: String(err) };
  }
}
