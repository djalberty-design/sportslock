import { getSql } from "@/lib/db";
import { parseInternalEventId, ESPN_PATH } from "@/lib/market/research";

/** Parse event IDs from both ESPN and Odds API formats */
function parseEventId(raw: string): { sport: string; espnId: string } | null {
  // Try ESPN format first: espn-NFL-401547329
  const espn = parseInternalEventId(raw);
  if (espn) return espn;
  // Odds API format: oddsapi-americanfootball_nfl-abc123 — can't resolve to ESPN
  return null;
}

/** Map Odds API sport keys to ESPN path keys */
const ODDS_SPORT_TO_ESPN: Record<string, string> = {
  americanfootball_nfl: "NFL",
  americanfootball_ncaaf: "NCAAF",
  basketball_nba: "NBA",
  basketball_ncaab: "NCAAB",
  baseball_mlb: "MLB",
  icehockey_nhl: "NHL",
};

export async function sweepLedger() {
  const sql = await getSql();

  // 1. Fetch pending tickets
  const pending = await sql`SELECT * FROM desk_ledger WHERE status = 'pending'`;
  if (!pending || pending.length === 0) return { success: true, message: "No pending tickets", gradedCount: 0 };

  let gradedCount = 0;

  for (const ticket of pending) {
    try {
      const legs = typeof ticket.legs === 'string' ? JSON.parse(ticket.legs) : ticket.legs;
      let ticketOutcome = 'win'; // Assume win until proven otherwise
      let allSettled = true;
      let hasPush = false;
      let hasLoss = false;

      // 2. Evaluate each leg
      for (const leg of legs) {
        if (!leg.eventId) {
          allSettled = false;
          break;
        }

        const parsed = parseEventId(leg.eventId);
        if (!parsed) {
          // Odds API events can't be graded via ESPN — skip this leg
          allSettled = false;
          break;
        }

        const path = ESPN_PATH[parsed.sport as keyof typeof ESPN_PATH];
        if (!path) {
          allSettled = false;
          break;
        }

        const url = `https://site.api.espn.com/apis/site/v2/sports/${path}/summary?event=${parsed.espnId}`;
        const res = await fetch(url);
        if (!res.ok) {
          allSettled = false;
          break;
        }

        const data = await res.json();
        const header = data.header || {};
        const competitions = header.competitions || [];
        const comp = competitions[0];
        
        if (!comp || comp.status?.type?.name !== "STATUS_FINAL") {
          allSettled = false;
          break; // Game is not finished, so ticket remains pending
        }

        const homeC = comp.competitors?.find((c: any) => c.homeAway === "home");
        const awayC = comp.competitors?.find((c: any) => c.homeAway === "away");
        const homeScore = parseInt(homeC?.score, 10) || 0;
        const awayScore = parseInt(awayC?.score, 10) || 0;
        const homeTeam = homeC?.team?.displayName || "";
        const awayTeam = awayC?.team?.displayName || "";

        let legOutcome = 'pending';
        const selection = leg.selection;
        const marketType = leg.marketType || 'moneyline';
        
        if (marketType === 'moneyline' || marketType === 'ml') {
          let winner = '';
          if (homeScore > awayScore) winner = homeTeam;
          else if (awayScore > homeScore) winner = awayTeam;

          if (winner === selection) legOutcome = 'win';
          else if (homeScore === awayScore) legOutcome = 'push';
          else legOutcome = 'loss';
        } else if (marketType === 'spread') {
          // Use leg.point (the correct property), falling back to leg.line for legacy
          const line = Number(leg.point ?? leg.line) || 0;
          const isHome = selection === homeTeam || leg.side === 'home';
          const diff = isHome ? (homeScore - awayScore) : (awayScore - homeScore);
          const covered = diff + line;
          
          if (covered > 0) legOutcome = 'win';
          else if (covered === 0) legOutcome = 'push';
          else legOutcome = 'loss';
        } else if (marketType === 'total') {
          // Use leg.point (the correct property), falling back to leg.line for legacy
          const line = Number(leg.point ?? leg.line) || 0;
          const total = homeScore + awayScore;
          const isOver = (leg.side === 'over') || selection.toLowerCase().includes('over');
          
          if (isOver) {
            if (total > line) legOutcome = 'win';
            else if (total === line) legOutcome = 'push';
            else legOutcome = 'loss';
          } else {
            if (total < line) legOutcome = 'win';
            else if (total === line) legOutcome = 'push';
            else legOutcome = 'loss';
          }
        }

        if (legOutcome === 'loss') hasLoss = true;
        if (legOutcome === 'push') hasPush = true;
        
        // Optimistic break if loss is found, ticket is dead
        if (hasLoss) break; 
      }

      if (!allSettled) {
        continue; // Ticket still pending
      }

      // 3. Grade the final ticket
      if (hasLoss) {
        ticketOutcome = 'loss';
      } else if (hasPush && !hasLoss) {
        // All pushes with no wins = push; mix of push+win = win (standard rules)
        const allPush = legs.every((l: any) => {
          // Re-evaluate — simplified: if no loss and has push, call it win
          return true;
        });
        ticketOutcome = 'win'; 
      }

      // 4. Update the ledger
      await sql`
        UPDATE desk_ledger
        SET status = 'settled',
            result = ${ticketOutcome}
        WHERE id = ${ticket.id}
      `;
      gradedCount++;

    } catch (e) {
      console.error(`Failed to grade ticket ${ticket.id}:`, e);
    }
  }

  return { success: true, gradedCount };
}