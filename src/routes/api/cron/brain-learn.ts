import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { upsertOverride } from "@/lib/market/overrides";
import { logActivity } from "@/lib/market/activity";

export const Route = createFileRoute("/api/cron/brain-learn")({
  server: {
    handlers: {
      GET: async () => handleBrainLearn(),
      POST: async () => handleBrainLearn(),
    }
  }
});

/**
 * Brain Learning Cron — Autonomous self-improvement system.
 * 
 * Runs nightly after grading. Analyzes prediction history to:
 * 1. Calculate Brier scores by sport/market (calibration quality)
 * 2. Identify systematic biases (overconfidence, sport-specific)
 * 3. Track rolling performance trends
 * 4. Auto-tune small adjustments when confidence is high
 * 5. Write insights to desk_brain_insights for dashboard display
 */
async function handleBrainLearn() {
  const sql = await getSql();

  try {
    // Ensure insights table exists
    await sql.query(`
      create table if not exists desk_brain_insights (
        id uuid primary key default gen_random_uuid(),
        insight_type text not null,
        scope text not null default 'global',
        sport text,
        market_type text,
        metric_name text not null,
        metric_value numeric not null,
        details jsonb,
        period text not null default 'all_time',
        computed_at timestamptz not null default now()
      )
    `);
    await sql.query(`create index if not exists brain_insights_type_idx on desk_brain_insights (insight_type, scope, computed_at desc)`);

    // Clear stale insights (keep last 30 days)
    await sql.query(`delete from desk_brain_insights where computed_at < now() - interval '30 days'`);

    let insightsCreated = 0;
    let autoTuned = 0;

    // ─── 1. Brier Scores (calibration quality) ───
    // Brier = avg((predicted_prob - actual_outcome)^2)
    // Lower = better calibrated. Perfect = 0, random = 0.25
    const brierGlobal = await sql.query<{ brier: number; n: number }>(
      `select
         avg(power(model_probability::numeric - case when status = 'WIN' then 1 else 0 end, 2))::numeric(10,6) as brier,
         count(*)::int as n
       from market_tape
       where recommended = true and status in ('WIN','LOSS')`,
    );
    if (brierGlobal[0]?.n > 0) {
      await sql.query(
        `insert into desk_brain_insights (insight_type, scope, metric_name, metric_value, details, period)
         values ('brier', 'global', 'brier_score', $1, $2::jsonb, 'all_time')`,
        [brierGlobal[0].brier, JSON.stringify({ n: brierGlobal[0].n })],
      );
      insightsCreated++;
    }

    // Brier by sport
    const brierBySport = await sql.query<{ sport: string; brier: number; n: number }>(
      `select coalesce(sport, 'UNK') as sport,
         avg(power(model_probability::numeric - case when status = 'WIN' then 1 else 0 end, 2))::numeric(10,6) as brier,
         count(*)::int as n
       from market_tape
       where recommended = true and status in ('WIN','LOSS')
       group by 1 having count(*) >= 5`,
    );
    for (const row of brierBySport) {
      await sql.query(
        `insert into desk_brain_insights (insight_type, scope, sport, metric_name, metric_value, details, period)
         values ('brier', 'sport', $1, 'brier_score', $2, $3::jsonb, 'all_time')`,
        [row.sport, row.brier, JSON.stringify({ sport: row.sport, n: row.n })],
      );
      insightsCreated++;
    }

    // Brier by market type
    const brierByMarket = await sql.query<{ market: string; brier: number; n: number }>(
      `select coalesce(market_type, 'unk') as market,
         avg(power(model_probability::numeric - case when status = 'WIN' then 1 else 0 end, 2))::numeric(10,6) as brier,
         count(*)::int as n
       from market_tape
       where recommended = true and status in ('WIN','LOSS')
       group by 1 having count(*) >= 5`,
    );
    for (const row of brierByMarket) {
      await sql.query(
        `insert into desk_brain_insights (insight_type, scope, market_type, metric_name, metric_value, details, period)
         values ('brier', 'market', $1, 'brier_score', $2, $3::jsonb, 'all_time')`,
        [row.market, row.brier, JSON.stringify({ market: row.market, n: row.n })],
      );
      insightsCreated++;
    }

    // ─── 2. Rolling 7-day performance ───
    const rolling7d = await sql.query<{ wins: number; losses: number; brier: number }>(
      `select
         count(*) filter (where status = 'WIN')::int as wins,
         count(*) filter (where status = 'LOSS')::int as losses,
         avg(power(model_probability::numeric - case when status = 'WIN' then 1 else 0 end, 2))::numeric(10,6) as brier
       from market_tape
       where recommended = true and status in ('WIN','LOSS') and snapped_at > now() - interval '7 days'`,
    );
    if (rolling7d[0]) {
      const r = rolling7d[0];
      const decided7 = r.wins + r.losses;
      const wr7 = decided7 > 0 ? r.wins / decided7 : 0;
      await sql.query(
        `insert into desk_brain_insights (insight_type, scope, metric_name, metric_value, details, period)
         values ('performance', 'global', 'win_rate_7d', $1, $2::jsonb, '7d')`,
        [wr7, JSON.stringify({ wins: r.wins, losses: r.losses, decided: decided7, brier: r.brier })],
      );
      insightsCreated++;
    }

    // ─── 3. Sharpness analysis ───
    // Does higher confidence actually predict better?
    // Compare win rate in high-confidence (>60%) vs low-confidence (<50%) picks
    const sharpness = await sql.query<{ tier: string; wr: number; n: number }>(
      `select
         case 
           when model_probability >= 0.60 then 'high'
           when model_probability >= 0.50 then 'mid'
           else 'low'
         end as tier,
         (count(*) filter (where status = 'WIN'))::numeric / nullif(count(*), 0) as wr,
         count(*)::int as n
       from market_tape
       where recommended = true and status in ('WIN','LOSS')
       group by 1`,
    );
    for (const row of sharpness) {
      await sql.query(
        `insert into desk_brain_insights (insight_type, scope, metric_name, metric_value, details, period)
         values ('sharpness', $1, 'win_rate_by_confidence', $2, $3::jsonb, 'all_time')`,
        [row.tier, row.wr || 0, JSON.stringify({ tier: row.tier, n: row.n, winRate: Math.round((row.wr || 0) * 100) })],
      );
      insightsCreated++;
    }

    // ─── 4. Auto-tune: calibration correction by sport ───
    // If a sport has 30+ decided picks and its model probability is off by >5%, auto-correct
    for (const row of brierBySport) {
      if (row.n < 30) continue;
      // Get calibration gap for this sport
      const cal = await sql.query<{ avg_model: number; actual_wr: number }>(
        `select
           avg(model_probability)::numeric(10,4) as avg_model,
           (count(*) filter (where status = 'WIN'))::numeric / nullif(count(*) filter (where status in ('WIN','LOSS')), 0) as actual_wr
         from market_tape
         where recommended = true and status in ('WIN','LOSS') and sport = $1`,
        [row.sport],
      );
      if (!cal[0]) continue;
      const gap = Number(cal[0].avg_model) - Number(cal[0].actual_wr);
      // Only auto-tune small corrections (<= 3% haircut) with high confidence
      if (gap > 0.05 && gap <= 0.08 && row.n >= 30) {
        const haircut = Math.round(gap * 0.5 * 100) / 100; // half the gap
        await upsertOverride({
          fingerprint: `brain-learn|${row.sport}`,
          sport: row.sport,
          market: "all",
          chanceHaircut: haircut,
          sit: false,
          note: `Brain auto-tune: ${row.sport} overconfident by ${Math.round(gap * 100)}% (n=${row.n}). Haircut ${Math.round(haircut * 100)}%.`,
        });
        await sql.query(
          `insert into desk_brain_insights (insight_type, scope, sport, metric_name, metric_value, details, period)
           values ('auto_tune', 'sport', $1, 'haircut_applied', $2, $3::jsonb, 'all_time')`,
          [row.sport, haircut, JSON.stringify({ sport: row.sport, gap: Math.round(gap * 100), n: row.n, haircut: Math.round(haircut * 100) })],
        );
        autoTuned++;
        insightsCreated++;
      }
    }

    void logActivity("brain", "Brain learning completed", `${insightsCreated} insights, ${autoTuned} auto-tuned`, "brain-learn-cron");

    return new Response(JSON.stringify({
      success: true,
      insightsCreated,
      autoTuned,
      message: `Brain learned: ${insightsCreated} insights, ${autoTuned} auto-tuned`,
    }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    console.error("Brain learn failed:", err);
    void logActivity("error", "Brain learning failed", String(err), "brain-learn-cron");
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
