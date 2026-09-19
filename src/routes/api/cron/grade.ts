import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { fetchLiveScores, teamsMatch, type LiveScore } from "@/lib/market/live-scores";
import { gradeMarket } from "@/lib/market/grade-tape";

export const Route = createFileRoute("/api/cron/grade")({
  server: {
    handlers: {
      GET: async () => handleGrade(),
      POST: async () => handleGrade(),
    }
  }
});

/**
 * Grade pending predictions against final scores from ESPN/MLB/NHL scoreboards.
 * 
 * We match predictions to completed games by team name (fuzzy matching),
 * not by event ID — because event IDs are in Odds API format (oddsapi-NFL-...)
 * and don't map to ESPN IDs.
 */
async function handleGrade() {
  const sql = await getSql();

  // Fetch all completed scores from live APIs
  const scores = await fetchLiveScores().catch(() => []);
  const finals = scores.filter((s) => s.complete);
  
  if (!finals.length) {
    return new Response(JSON.stringify({ 
      success: true, 
      gradedCount: 0, 
      message: "No completed games found in scoreboards" 
    }), { headers: { "Content-Type": "application/json" } });
  }

  const pending = await sql`
    SELECT * FROM prediction_logs 
    WHERE status = 'PENDING' 
    ORDER BY created_at DESC 
    LIMIT 100
  `;

  let gradedCount = 0;
  let unmatchedCount = 0;

  for (const log of pending) {
    try {
      const selection = (log.selection as string) || "";
      const marketType = (log.market_type as string) || "";
      const eventId = (log.event_id as string) || "";
      
      // Extract sport and team info from the prediction
      // Event IDs look like: oddsapi-NFL-abc123 or espn-NFL-12345
      const sportMatch = eventId.match(/^(?:oddsapi|espn)-([A-Z]+)-/);
      const sport = sportMatch?.[1] || null;
      
      // Try to find the completed game by matching the selection to home/away teams
      const hit = finals.find(
        (s) =>
          (!sport || !s.sport || s.sport === sport) &&
          (teamsMatch(selection, s.home, s.homeAbbr) || 
           teamsMatch(selection, s.away, s.awayAbbr))
      );
      
      if (!hit) {
        unmatchedCount++;
        continue;
      }

      // Use the grade-tape grading logic which handles ml, moneyline, spread, total
      const outcome = gradeMarket({
        marketType,
        side: log.side as string | null,
        selection,
        line: log.line != null ? Number(log.line) : (log.point != null ? Number(log.point) : null),
        home: hit.home,
        away: hit.away,
        homeScore: hit.homeScore,
        awayScore: hit.awayScore,
      });

      if (!outcome) {
        unmatchedCount++;
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
              gradedBy: "cron-v2"
            })}::jsonb,
            updated_at = now()
        WHERE id = ${log.id}
      `;
      gradedCount++;
    } catch (e) {
      console.error(`Failed to grade log ${log.id}`, e);
    }
  }

  return new Response(JSON.stringify({ 
    success: true, 
    gradedCount, 
    unmatched: unmatchedCount,
    totalPending: pending.length,
    finalsAvailable: finals.length
  }), {
    headers: { "Content-Type": "application/json" }
  });
}