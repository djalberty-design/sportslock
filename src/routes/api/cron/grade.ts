import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { parseInternalEventId, ESPN_PATH } from "@/lib/market/research";

export const Route = createFileRoute("/api/cron/grade")({
  server: {
    handlers: {
      GET: async () => handleGrade(),
      POST: async () => handleGrade(),
    }
  }
});

async function handleGrade() {
  const sql = await getSql();

  const pending = await sql`SELECT * FROM prediction_logs WHERE status = 'PENDING'`;

  let gradedCount = 0;
  for (const log of pending) {
    try {
      const parsed = parseInternalEventId(log.event_id as string);
      if (!parsed) continue;

      const path = ESPN_PATH[parsed.sport as keyof typeof ESPN_PATH];
      if (!path) continue;

      const url = `https://site.api.espn.com/apis/site/v2/sports/${path}/summary?event=${parsed.espnId}`;
      const res = await fetch(url);
      if (!res.ok) continue;

      const data = await res.json();
      
      const header = data.header || {};
      const competitions = header.competitions || [];
      const comp = competitions[0];
      if (!comp) continue;

      const statusDesc = comp.status?.type?.name; // e.g., "STATUS_FINAL"
      if (statusDesc !== "STATUS_FINAL") {
        continue; // Game is not finished
      }

      const homeC = comp.competitors.find((c: any) => c.homeAway === "home");
      const awayC = comp.competitors.find((c: any) => c.homeAway === "away");
      const homeScore = parseInt(homeC?.score, 10) || 0;
      const awayScore = parseInt(awayC?.score, 10) || 0;
      const homeTeam = homeC?.team?.displayName || "";
      const awayTeam = awayC?.team?.displayName || "";

      let outcome = 'PENDING';
      const selection = log.selection as string;
      const marketType = log.market_type as string;
      
      if (marketType === 'moneyline') {
        let winner = '';
        if (homeScore > awayScore) winner = homeTeam;
        else if (awayScore > homeScore) winner = awayTeam;

        if (winner === selection) outcome = 'WIN';
        else if (homeScore === awayScore) outcome = 'PUSH';
        else outcome = 'LOSS';
      } else if (marketType === 'spread') {
        const line = Number(log.line) || 0;
        const isHome = selection === homeTeam;
        const diff = isHome ? (homeScore - awayScore) : (awayScore - homeScore);
        const covered = diff + line;
        
        if (covered > 0) outcome = 'WIN';
        else if (covered === 0) outcome = 'PUSH';
        else outcome = 'LOSS';
      } else if (marketType === 'total') {
        const line = Number(log.line) || 0;
        const total = homeScore + awayScore;
        const isOver = selection.toLowerCase().includes('over');
        
        if (isOver) {
          if (total > line) outcome = 'WIN';
          else if (total === line) outcome = 'PUSH';
          else outcome = 'LOSS';
        } else {
          if (total < line) outcome = 'WIN';
          else if (total === line) outcome = 'PUSH';
          else outcome = 'LOSS';
        }
      }

      if (outcome !== 'PENDING') {
        await sql`
          UPDATE prediction_logs
          SET status = ${outcome},
              actual_result = ${JSON.stringify(data)}::jsonb,
              updated_at = now()
          WHERE id = ${log.id}
        `;
        gradedCount++;
      }
    } catch (e) {
      console.error(`Failed to grade log ${log.id}`, e);
    }
  }

  return new Response(JSON.stringify({ success: true, gradedCount }), {
    headers: { 'Content-Type': 'application/json' }
  });
}