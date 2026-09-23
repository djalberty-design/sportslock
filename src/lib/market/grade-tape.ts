import { getSql } from "@/lib/db";
import { fetchLiveScores, teamsMatch, type LiveScore } from "./live-scores";
import { fetchAllHistoricalForGrading } from "./historical-scores";

export type TapeGrade = "WIN" | "LOSS" | "PUSH";

export type GradeStats = {
  ok: boolean;
  graded: number;
  pending: number;
  wins: number;
  losses: number;
  pushes: number;
  expired: number;
  error?: string;
};

async function ensureGradeColumns() {
  const sql = await getSql();
  await sql.query(`alter table market_tape add column if not exists status text`);
  await sql.query(`alter table market_tape add column if not exists result_home integer`);
  await sql.query(`alter table market_tape add column if not exists result_away integer`);
  await sql.query(`alter table market_tape add column if not exists graded_at timestamptz`);
}

function findScore(row: { sport?: string | null; home?: string | null; away?: string | null }, scores: LiveScore[]): LiveScore | null {
  return (
    scores.find(
      (s) =>
        s.complete &&
        (!s.sport || !row.sport || s.sport === row.sport) &&
        teamsMatch(s.home, row.home, s.homeAbbr) &&
        teamsMatch(s.away, row.away, s.awayAbbr),
    ) || null
  );
}

export function gradeMarket(opts: {
  marketType: string;
  side?: string | null;
  selection: string;
  line?: number | null;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
}): TapeGrade | null {
  const market = String(opts.marketType || "").toLowerCase();
  const side = String(opts.side || "").toLowerCase();
  const sel = String(opts.selection || "");
  const line = opts.line == null ? NaN : Number(opts.line);

  if (market === "ml" || market === "moneyline") {
    if (opts.homeScore === opts.awayScore) return "PUSH";
    if (side === "home") return opts.homeScore > opts.awayScore ? "WIN" : "LOSS";
    if (side === "away") return opts.awayScore > opts.homeScore ? "WIN" : "LOSS";
    if (teamsMatch(sel, opts.home)) return opts.homeScore > opts.awayScore ? "WIN" : "LOSS";
    if (teamsMatch(sel, opts.away)) return opts.awayScore > opts.homeScore ? "WIN" : "LOSS";
    return null;
  }

  if (market === "spread" || market === "spreads") {
    if (!Number.isFinite(line)) return null;
    const homeSide = side === "home" || (!side && teamsMatch(sel, opts.home));
    const margin = homeSide ? opts.homeScore - opts.awayScore : opts.awayScore - opts.homeScore;
    const covered = margin + line;
    if (covered > 0) return "WIN";
    if (covered === 0) return "PUSH";
    return "LOSS";
  }

  if (market === "total" || market === "totals" || market === "over_under") {
    if (!Number.isFinite(line)) return null;
    const total = opts.homeScore + opts.awayScore;
    const isOver = side === "over" || /\bover\b/i.test(sel);
    if (total === line) return "PUSH";
    if (isOver) return total > line ? "WIN" : "LOSS";
    return total < line ? "WIN" : "LOSS";
  }

  return null;
}

/**
 * Grade pending predictions using live ESPN scores (today's games).
 * This is the original function that only handles today.
 */
async function gradeLiveOnly(): Promise<{ graded: number; unmatched: number }> {
  const sql = await getSql();
  const scores = await fetchLiveScores().catch(() => []);
  const finals = scores.filter((s) => s.complete);
  if (!finals.length) return { graded: 0, unmatched: 0 };

  return gradeWithScores(sql, finals, false);
}

/**
 * Grade pending predictions using historical ESPN scores (past dates).
 * This catches everything that live grading missed.
 */
async function gradeHistorical(): Promise<{ graded: number; unmatched: number }> {
  const sql = await getSql();
  const historicalScores = await fetchAllHistoricalForGrading();
  if (!historicalScores.length) return { graded: 0, unmatched: 0 };

  return gradeWithScores(sql, historicalScores, true);
}

/**
 * Core grading logic — shared between live and historical.
 */
async function gradeWithScores(
  sql: any,
  scores: LiveScore[],
  isHistorical: boolean,
): Promise<{ graded: number; unmatched: number }> {
  const minAge = isHistorical ? "interval '6 hours'" : "interval '0 seconds'";
  const pending = await sql.query<{
    id: string;
    sport: string | null;
    home: string | null;
    away: string | null;
    market_type: string;
    side: string | null;
    selection: string;
    line: string | number | null;
  }>(
    `select id, sport, home, away, market_type, side, selection, line
     from market_tape
     where (status is null or status = 'PENDING')
       and coalesce(start, snapped_at) < now() - ${minAge}
     limit 4000`,
  );

  let graded = 0;
  let unmatched = 0;

  for (const row of pending) {
    const hit = findScore(row, scores);
    if (!hit) {
      unmatched++;
      continue;
    }
    const outcome = gradeMarket({
      marketType: row.market_type,
      side: row.side,
      selection: row.selection,
      line: row.line == null ? null : Number(row.line),
      home: row.home || hit.home,
      away: row.away || hit.away,
      homeScore: hit.homeScore,
      awayScore: hit.awayScore,
    });
    if (!outcome) {
      unmatched++;
      continue;
    }
    await sql.query(
      `update market_tape
       set status = $1, result_home = $2, result_away = $3, graded_at = now(), complete = true
       where id = $4`,
      [outcome, hit.homeScore, hit.awayScore, row.id],
    );
    graded++;
  }

  return { graded, unmatched };
}

/**
 * Mark very old ungraded predictions as EXPIRED.
 * Predictions older than 14 days that still can't be matched get cleaned up.
 */
async function markExpired(): Promise<number> {
  const sql = await getSql();
  const result = await sql.query(
    `update market_tape
     set status = 'EXPIRED', graded_at = now()
     where (status is null or status = 'PENDING')
       and coalesce(start, snapped_at) < now() - interval '14 days'
     returning id`,
  );
  return result.length;
}

/**
 * Full grading pipeline: live + historical + expire old.
 * Called by the sweep cron and by the admin batch-grade button.
 */
export async function gradeMarketTape(): Promise<{
  ok: boolean;
  graded: number;
  unmatched: number;
  historical: number;
  expired: number;
  error?: string;
}> {
  try {
    await ensureGradeColumns();

    // Step 1: Grade with today's live scores
    const live = await gradeLiveOnly();

    // Step 2: Grade with historical scores (past dates)
    const hist = await gradeHistorical();

    // Step 3: Mark very old predictions as expired
    const expired = await markExpired();

    return {
      ok: true,
      graded: live.graded + hist.graded,
      unmatched: live.unmatched + hist.unmatched,
      historical: hist.graded,
      expired,
    };
  } catch (err) {
    console.error("grade tape failed:", err);
    return { ok: false, graded: 0, unmatched: 0, historical: 0, expired: 0, error: String(err) };
  }
}

export async function getGradeStats(): Promise<GradeStats> {
  try {
    await ensureGradeColumns();
    const sql = await getSql();
    // Only count recommended picks (our model's actual recommendation per market)
    // This avoids the 50/50 problem where both sides of every market are tracked
    const rows = await sql.query<{ status: string | null; n: number }>(
      `select coalesce(status, 'PENDING') as status, count(*)::int as n
       from market_tape
       where recommended = true
       group by 1`,
    );
    const by = Object.fromEntries(rows.map((r) => [String(r.status).toUpperCase(), Number(r.n)]));
    return {
      ok: true,
      graded: (by.WIN || 0) + (by.LOSS || 0) + (by.PUSH || 0),
      pending: by.PENDING || 0,
      wins: by.WIN || 0,
      losses: by.LOSS || 0,
      pushes: by.PUSH || 0,
      expired: by.EXPIRED || 0,
    };
  } catch (err) {
    return { ok: false, graded: 0, pending: 0, wins: 0, losses: 0, pushes: 0, expired: 0, error: String(err) };
  }
}

/**
 * Grade pending predictions in prediction_logs using live and historical scores.
 */
export async function gradePredictionLogs(scores?: LiveScore[]): Promise<{ graded: number; unmatched: number; historical: number }> {
  try {
    const sql = await getSql();

    let allScores = scores;
    if (!allScores || allScores.length === 0) {
      const live = await fetchLiveScores().catch(() => []);
      const hist = await fetchAllHistoricalForGrading().catch(() => []);
      allScores = [...live.filter((s) => s.complete), ...hist];
    }

    if (!allScores.length) return { graded: 0, unmatched: 0, historical: 0 };

    const pending = await sql<{
      id: string;
      event_id: string;
      selection: string;
      market_type: string;
      line: string | number | null;
      snapshot: any;
    }>`
      SELECT id, event_id, selection, market_type, line, snapshot
      FROM prediction_logs
      WHERE status = 'PENDING'
      ORDER BY created_at DESC
      LIMIT 1000
    `;

    if (!pending.length) return { graded: 0, unmatched: 0, historical: 0 };

    // Pre-load event info from market_tape for events that are pending
    const eventIds = [...new Set(pending.map((p) => p.event_id).filter(Boolean))];
    const tapeInfoMap = new Map<string, { home: string; away: string; sport: string }>();
    if (eventIds.length > 0) {
      try {
        const tapeRows = await sql<{ event_id: string; home: string; away: string; sport: string }>`
          SELECT DISTINCT event_id, home, away, sport
          FROM market_tape
          WHERE event_id = ANY(${eventIds})
        `;
        for (const tr of tapeRows) {
          if (tr.event_id && tr.home && tr.away) {
            tapeInfoMap.set(tr.event_id, { home: tr.home, away: tr.away, sport: tr.sport });
          }
        }
      } catch {}
    }

    let graded = 0;
    let unmatched = 0;
    let historical = 0;

    for (const log of pending) {
      try {
        const selection = String(log.selection || "");
        const marketType = String(log.market_type || "");
        const eventId = String(log.event_id || "");
        const sportMatch = eventId.match(/^(?:oddsapi|espn)-([A-Z]+)-/);
        const inferredSport = sportMatch?.[1] || null;

        const tapeInfo = tapeInfoMap.get(eventId);
        const home = log.snapshot?.home || tapeInfo?.home || null;
        const away = log.snapshot?.away || tapeInfo?.away || null;
        const sport = log.snapshot?.sport || tapeInfo?.sport || inferredSport;

        let hit: LiveScore | null = null;

        if (home && away) {
          hit = allScores.find(
            (s) =>
              s.complete &&
              (!sport || !s.sport || s.sport.toUpperCase() === sport.toUpperCase()) &&
              teamsMatch(s.home, home, s.homeAbbr) &&
              teamsMatch(s.away, away, s.awayAbbr),
          ) || null;
        }

        if (!hit) {
          hit = allScores.find(
            (s) =>
              s.complete &&
              (!sport || !s.sport || s.sport.toUpperCase() === sport.toUpperCase()) &&
              (teamsMatch(selection, s.home, s.homeAbbr) || teamsMatch(selection, s.away, s.awayAbbr)),
          ) || null;
        }

        if (!hit) {
          unmatched++;
          continue;
        }

        const outcome = gradeMarket({
          marketType,
          side: log.snapshot?.side || (home && teamsMatch(selection, home) ? "home" : away && teamsMatch(selection, away) ? "away" : null),
          selection,
          line: log.line != null ? Number(log.line) : null,
          home: hit.home,
          away: hit.away,
          homeScore: hit.homeScore,
          awayScore: hit.awayScore,
        });

        if (!outcome) {
          unmatched++;
          continue;
        }

        await sql`
          UPDATE prediction_logs
          SET status = ${outcome},
              actual_result = ${JSON.stringify({
                home: hit.home,
                away: hit.away,
                homeScore: hit.homeScore,
                awayScore: hit.awayScore,
                source: hit.source,
                gradedBy: "auto-grader"
              })}::jsonb,
              updated_at = now()
          WHERE id = ${log.id}
        `;
        graded++;
        if (hit.source?.includes("historical")) historical++;
      } catch (e) {
        console.error(`Failed to grade prediction_log ${log.id}:`, e);
        unmatched++;
      }
    }

    return { graded, unmatched, historical };
  } catch (err) {
    console.error("gradePredictionLogs failed:", err);
    return { graded: 0, unmatched: 0, historical: 0 };
  }
}
