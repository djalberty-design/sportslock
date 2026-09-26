import { getSql } from "../db.ts";

export type SuggestionStatus = "pending" | "accepted" | "rejected" | "later" | "auto_applied" | "revoked";

export type BrainSuggestion = {
  id: string;
  fingerprint: string;
  title: string;
  body: string;
  knob: string;
  proposed: Record<string, any> | null;
  evidence: Record<string, any>;
  status: SuggestionStatus;
  createdAt: string;
  decidedAt: string | null;
};

let suggestionsTableEnsured = false;

async function ensureSuggestionsTable() {
  if (suggestionsTableEnsured) return;
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
  suggestionsTableEnsured = true;
}

function mapRow(r: Record<string, unknown>): BrainSuggestion {
  return {
    id: String(r.id),
    fingerprint: String(r.fingerprint),
    title: String(r.title),
    body: String(r.body),
    knob: String(r.knob || "none"),
    proposed: (r.proposed as Record<string, any>) || null,
    evidence: (r.evidence as Record<string, any>) || {},
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
  if (!["accepted", "rejected", "later", "pending", "revoked", "auto_applied"].includes(status)) return { ok: false };
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
         status = 'pending'
         or (status in ('accepted', 'auto_applied') and created_at > now() - interval '5 days')
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
       where status in ('WIN','LOSS','PUSH') and recommended = true
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
    // ─── NEW: Sport-specific bias detection ───
    // Compare win rate per sport. If one sport significantly outperforms or underperforms,
    // suggest adjusting weights.
    const sportTotals = new Map<string, { wins: number; decided: number }>();
    for (const s of slices) {
      const prev = sportTotals.get(s.sport) || { wins: 0, decided: 0 };
      prev.wins += Number(s.wins || 0);
      prev.decided += Number(s.decided || 0);
      sportTotals.set(s.sport, prev);
    }
    const globalWr = totals.decided > 0 ? totals.wins / totals.decided : 0.5;

    for (const [sport, st] of sportTotals) {
      if (st.decided < 10) continue; // need sample size
      const wr = st.wins / st.decided;
      const deviation = wr - globalWr;

      // Hot sport: significantly better than average
      if (deviation > 0.12 && st.decided >= 12) {
        if (await insertSuggestion({
          fingerprint: `hot-sport|${sport}`,
          title: `${sport}: outperforming (+${Math.round(deviation * 100)}%)`,
          body: `${sport} is hitting ${Math.round(wr * 100)}% (${st.wins}/${st.decided}) vs ${Math.round(globalWr * 100)}% overall. Model has an edge on this sport. Consider increasing confidence or bet size on ${sport} picks.`,
          knob: "kelly",
          proposed: { sport, action: "boost-kelly", multiplier: 1.15 },
          evidence: { sport, winRate: Math.round(wr * 100), decided: st.decided, globalWr: Math.round(globalWr * 100) },
        })) created++;
      }

      // Cold sport: significantly worse than average
      if (deviation < -0.12 && st.decided >= 12) {
        const haircut = Math.min(0.08, Math.abs(deviation) * 0.6);
        if (await insertSuggestion({
          fingerprint: `cold-sport|${sport}`,
          title: `${sport}: underperforming (${Math.round(deviation * 100)}%)`,
          body: `${sport} is hitting ${Math.round(wr * 100)}% (${st.wins}/${st.decided}) vs ${Math.round(globalWr * 100)}% overall. Model is miscalibrated on this sport. Recommend ${Math.round(haircut * 100)}% chance haircut.`,
          knob: "chance",
          proposed: { sport, market: "all", chanceHaircut: haircut },
          evidence: { sport, winRate: Math.round(wr * 100), decided: st.decided, globalWr: Math.round(globalWr * 100) },
        })) created++;

        // Auto-apply for high-confidence small adjustments (>30 samples, >15% deviation)
        if (st.decided >= 30 && Math.abs(deviation) >= 0.15 && haircut <= 0.03) {
          const { upsertOverride } = await import("./overrides");
          await upsertOverride({
            fingerprint: `auto|cold-sport|${sport}`,
            sport,
            market: "all",
            chanceHaircut: haircut,
            sit: false,
            note: `Auto-applied: ${sport} ${Math.round(wr * 100)}% vs ${Math.round(globalWr * 100)}% global (n=${st.decided})`,
          });
          // Mark as auto-applied
          await insertSuggestion({
            fingerprint: `auto-applied|cold-sport|${sport}`,
            title: `🤖 Auto-applied: ${sport} haircut ${Math.round(haircut * 100)}%`,
            body: `Automatically applied a ${Math.round(haircut * 100)}% chance haircut on ${sport} (n=${st.decided}, hit ${Math.round(wr * 100)}%). High confidence threshold met. You can revoke this from the suggestions page.`,
            knob: "auto",
            proposed: { sport, market: "all", chanceHaircut: haircut, autoApplied: true },
            evidence: { sport, winRate: Math.round(wr * 100), decided: st.decided },
          });
          created++;
        }
      }
    }

    // ─── NEW: Edge calibration check ───
    // Compare claimed edge vs actual hit rate. If model says +5% edge but actual is 48%, 
    // the model is overestimating its edge.
    const edgeCal = await sql.query<{ avg_edge: number; avg_model: number; actual_wr: number; n: number }>(
      `select 
         avg(edge)::numeric(10,4) as avg_edge,
         avg(model_probability)::numeric(10,4) as avg_model,
         (count(*) filter (where status = 'WIN'))::numeric / nullif(count(*) filter (where status in ('WIN','LOSS')), 0) as actual_wr,
         count(*) filter (where status in ('WIN','LOSS'))::int as n
       from market_tape
       where recommended = true and status in ('WIN','LOSS')`,
    );
    if (edgeCal[0] && edgeCal[0].n >= 20) {
      const { avg_model, actual_wr, n } = edgeCal[0];
      const modelAvg = Number(avg_model) || 0.5;
      const actualWr = Number(actual_wr) || 0.5;
      const calibrationGap = modelAvg - actualWr; // positive = overconfident
      if (calibrationGap > 0.05 && n >= 20) {
        if (await insertSuggestion({
          fingerprint: `edge-cal|global`,
          title: `Model overconfident by ${Math.round(calibrationGap * 100)}%`,
          body: `Average model probability: ${Math.round(modelAvg * 100)}%. Actual win rate: ${Math.round(actualWr * 100)}% (n=${n}). Model is ${Math.round(calibrationGap * 100)}% too optimistic. Consider a global ${Math.round(Math.min(calibrationGap * 0.6, 0.05) * 100)}% haircut.`,
          knob: "chance",
          proposed: { chanceHaircut: Math.min(calibrationGap * 0.6, 0.05) },
          evidence: { avgModel: Math.round(modelAvg * 100), actualWr: Math.round(actualWr * 100), n },
        })) created++;
      }
    }

    // ─── Automated Simulation Temperature Proposals (Brier Score Audit) ───
    try {
      const brierRows = await sql.query<{
        sport: string;
        brier_score: number;
        sample_size: number;
      }>(
        `SELECT
           sport,
           AVG(POWER(model_probability - (CASE WHEN status = 'WIN' THEN 1.0 ELSE 0.0 END), 2))::numeric(10,4) as brier_score,
           COUNT(*)::int as sample_size
         FROM market_tape
         WHERE recommended = true AND status IN ('WIN', 'LOSS')
         GROUP BY sport`
      );

      const { getSimTemperature } = await import("./sim-temperature");
      for (const b of brierRows) {
        const sport = b.sport?.toUpperCase();
        const n = Number(b.sample_size || 0);
        const brier = Number(b.brier_score || 0);
        if (!sport || n < 8) continue;

        const currentTemp = getSimTemperature(sport);

        // Overconfident / High Error (Brier > 0.255): Widen simulation temperature to introduce variance
        if (brier > 0.255 && currentTemp < 1.20) {
          const proposedTemp = Math.min(1.20, Math.round((currentTemp + 0.05) * 100) / 100);
          if (await insertSuggestion({
            fingerprint: `sim-temp-widen|${sport}`,
            title: `${sport}: Widen Simulation Temperature (${currentTemp.toFixed(2)} → ${proposedTemp.toFixed(2)})`,
            body: `${sport} displays elevated Brier Score (${brier.toFixed(3)} across n=${n} graded plays). Expanding simulation variance dampens outlier model overconfidence and aligns distribution tails with actual league volatility.`,
            knob: "sim_temperature",
            proposed: { sport, simTemperature: proposedTemp, priorTemperature: currentTemp },
            evidence: { sport, brierScore: brier, n, currentTemp, proposedTemp },
          })) created++;
        } else if (brier < 0.220 && currentTemp > 0.85) {
          // High Precision (Brier < 0.220): Tighten simulation temperature to capture sharp signal
          const proposedTemp = Math.max(0.85, Math.round((currentTemp - 0.05) * 100) / 100);
          if (await insertSuggestion({
            fingerprint: `sim-temp-tighten|${sport}`,
            title: `${sport}: Tighten Simulation Temperature (${currentTemp.toFixed(2)} → ${proposedTemp.toFixed(2)})`,
            body: `${sport} displays exceptional empirical calibration (Brier Score ${brier.toFixed(3)} across n=${n} graded plays). Compressing simulation variance sharpens model edge and rewards high-confidence possessions.`,
            knob: "sim_temperature",
            proposed: { sport, simTemperature: proposedTemp, priorTemperature: currentTemp },
            evidence: { sport, brierScore: brier, n, currentTemp, proposedTemp },
          })) created++;
        }
      }

      // ─── Kelly Sizing & Edge Floor Proposals ───
      const highVarRows = await sql.query<{
        sport: string;
        variance_count: number;
        total_count: number;
      }>(
        `SELECT
           sport,
           COUNT(*) FILTER (WHERE bucket = 'high_variance')::int as variance_count,
           COUNT(*)::int as total_count
         FROM market_tape
         WHERE status = 'LOSS'
         GROUP BY sport`
      );

      for (const h of highVarRows) {
        const sport = h.sport?.toUpperCase();
        const losses = Number(h.total_count || 0);
        const varLosses = Number(h.variance_count || 0);
        if (!sport || losses < 6) continue;
        const varRate = varLosses / losses;

        if (varRate >= 0.40) {
          if (await insertSuggestion({
            fingerprint: `edge-floor-tighten|${sport}`,
            title: `${sport}: Tighten Minimum Edge Floor (+0.5%)`,
            body: `${Math.round(varRate * 100)}% of graded losses in ${sport} are classified as high-variance coin flips. Tightening the minimum entry edge filters out marginal +EV plays that suffer from high variance drag.`,
            knob: "min_edge",
            proposed: { sport, minEdgeIncrement: 0.5 },
            evidence: { sport, highVarianceRatio: Math.round(varRate * 100), gradedLosses: losses },
          })) created++;
        }
      }

      // ─── Circuit Breaker Active Review Proposals ───
      const trippedBreakers = await sql.query<{ sport: string; notes: string; updated_at: string }>(
        `select sport, notes, updated_at from brain_model_weights where source = 'circuit_breaker'`
      );
      for (const b of trippedBreakers) {
        const sport = b.sport?.toUpperCase();
        if (await insertSuggestion({
          fingerprint: `breaker-review|${sport}`,
          title: `🛡️ Review Circuit Breaker: ${sport} fail-safe active`,
          body: `${sport} is currently running in defensive baseline consensus (0.10/0.10/0.80) due to consecutive model misses. Check recent performance to audit if the model has stabilized to release the breaker.`,
          knob: "none",
          proposed: { sport, action: "review-breaker" },
          evidence: { sport, notes: b.notes, trippedAt: b.updated_at },
        })) created++;
      }
    } catch {
      // Graceful error isolation
    }

    return { ok: true, created };
  } catch (err) {
    console.error("build suggestions failed:", err);
    return { ok: false, created: 0, error: String(err) };
  }
}
