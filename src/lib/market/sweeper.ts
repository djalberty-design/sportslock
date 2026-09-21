import { getSql } from "@/lib/db";
import { fetchLiveScores, teamsMatch } from "@/lib/market/live-scores";
import { gradeMarket } from "@/lib/market/grade-tape";

/**
 * Grade pending tickets in desk_ledger against completed game scores.
 * 
 * Uses live scoreboards (ESPN/MLB/NHL) with fuzzy team matching,
 * not event ID → ESPN lookup which broke when we moved to Odds API events.
 */
export async function sweepLedger() {
  const sql = await getSql();

  // 1. Fetch completed scores
  const scores = await fetchLiveScores().catch(() => []);
  const finals = scores.filter((s) => s.complete);
  if (!finals.length) return { success: true, message: "No completed games in scoreboards", gradedCount: 0 };

  // 2. Fetch pending tickets
  const pending = await sql`SELECT * FROM desk_ledger WHERE status = 'pending' LIMIT 50`;
  if (!pending || pending.length === 0) return { success: true, message: "No pending tickets", gradedCount: 0 };

  let gradedCount = 0;

  for (const ticket of pending) {
    try {
      const legs = typeof ticket.legs === 'string' ? JSON.parse(ticket.legs) : ticket.legs;
      if (!Array.isArray(legs) || legs.length === 0) continue;
      
      let allSettled = true;
      let hasLoss = false;
      let hasPush = false;

      // Track which game other legs on this ticket matched to (for totals fallback)
      let ticketGame: typeof finals[number] | null = null;

      for (const leg of legs) {
        const selection = leg.selection || "";
        const marketType = leg.marketType || leg.market_type || "ml";
        const sport = leg.sport || null;
        
        // Find completed game by team matching
        let hit = finals.find(
          (s) =>
            (!sport || !s.sport || s.sport === sport) &&
            (teamsMatch(selection, s.home, s.homeAbbr) || 
             teamsMatch(selection, s.away, s.awayAbbr))
        ) || null;
        
        // Fallback for totals/props: selection is "Over 224.5" etc, no team name
        // Try matching via home/away fields stored on the leg itself
        if (!hit && (leg.home || leg.away)) {
          hit = finals.find(
            (s) =>
              (!sport || !s.sport || s.sport === sport) &&
              ((leg.home && teamsMatch(leg.home, s.home, s.homeAbbr)) ||
               (leg.away && teamsMatch(leg.away, s.away, s.awayAbbr)))
          ) || null;
        }
        
        // Final fallback: if another leg on this ticket already matched a game,
        // and this is a total/prop for the same sport, use that game
        if (!hit && ticketGame) {
          const isTotalOrProp = /total|over|under/i.test(marketType) || /\b(over|under)\b/i.test(selection);
          if (isTotalOrProp && (!sport || !ticketGame.sport || ticketGame.sport === sport)) {
            hit = ticketGame;
          }
        }
        
        if (!hit) {
          allSettled = false;
          break;
        }
        
        // Remember the matched game for sibling legs
        if (!ticketGame) ticketGame = hit;

        const outcome = gradeMarket({
          marketType,
          side: leg.side || null,
          selection,
          line: leg.point != null ? Number(leg.point) : (leg.line != null ? Number(leg.line) : null),
          home: hit.home,
          away: hit.away,
          homeScore: hit.homeScore,
          awayScore: hit.awayScore,
        });

        if (!outcome) {
          allSettled = false;
          break;
        }

        if (outcome === "LOSS") hasLoss = true;
        if (outcome === "PUSH") hasPush = true;
        
        // Short-circuit: any loss kills the ticket
        if (hasLoss) break;
      }

      if (!allSettled) continue;

      // 3. Grade the final ticket
      const ticketOutcome = hasLoss ? "loss" : "win";

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