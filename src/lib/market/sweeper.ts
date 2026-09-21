import { getSql } from "@/lib/db";
import { fetchLiveScores, teamsMatch } from "@/lib/market/live-scores";
import { gradeMarket } from "@/lib/market/grade-tape";

/**
 * Grade pending tickets in desk_ledger against completed game scores.
 * Also sweeps desk_ledger_bets (signed-in user bets).
 * 
 * Uses live scoreboards (ESPN/MLB/NHL) with fuzzy team matching,
 * not event ID → ESPN lookup which broke when we moved to Odds API events.
 */
export async function sweepLedger() {
  const sql = await getSql();

  // 1. Fetch completed scores
  const scores = await fetchLiveScores().catch(() => []);
  const finals = scores.filter((s) => s.complete);
  if (!finals.length) return { success: true, message: "No completed games in scoreboards", gradedCount: 0, userBetsGraded: 0 };

  // 2. Sweep desk_ledger (multi-leg paper tickets)
  const ledgerResult = await sweepDeskLedger(sql, finals);
  
  // 3. Sweep desk_ledger_bets (signed-in user single bets)
  const userBetsResult = await sweepUserBets(sql, finals);

  return {
    success: true,
    gradedCount: ledgerResult,
    userBetsGraded: userBetsResult,
  };
}

/**
 * Sweep multi-leg tickets in desk_ledger.
 */
async function sweepDeskLedger(sql: any, finals: any[]): Promise<number> {
  const pending = await sql`SELECT * FROM desk_ledger WHERE status = 'pending' LIMIT 50`;
  if (!pending || pending.length === 0) return 0;

  let gradedCount = 0;

  for (const ticket of pending) {
    try {
      const legs = typeof ticket.legs === 'string' ? JSON.parse(ticket.legs) : ticket.legs;
      if (!Array.isArray(legs) || legs.length === 0) continue;
      
      let allSettled = true;
      let hasLoss = false;
      let hasPush = false;

      // Pre-scan: find a game match from ANY leg with a team name
      // so totals legs can always resolve even if they're first
      let ticketGame: typeof finals[number] | null = null;
      for (const leg of legs) {
        const sel = leg.selection || "";
        const sp = leg.sport || null;
        const matched = finals.find(
          (s) =>
            (!sp || !s.sport || s.sport === sp) &&
            (teamsMatch(sel, s.home, s.homeAbbr) || teamsMatch(sel, s.away, s.awayAbbr))
        ) || null;
        if (!matched && (leg.home || leg.away)) {
          const byFields = finals.find(
            (s) =>
              (!sp || !s.sport || s.sport === sp) &&
              ((leg.home && teamsMatch(leg.home, s.home, s.homeAbbr)) ||
               (leg.away && teamsMatch(leg.away, s.away, s.awayAbbr)))
          ) || null;
          if (byFields) { ticketGame = byFields; break; }
        }
        if (matched) { ticketGame = matched; break; }
      }

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
        if (!hit && (leg.home || leg.away)) {
          hit = finals.find(
            (s) =>
              (!sport || !s.sport || s.sport === sport) &&
              ((leg.home && teamsMatch(leg.home, s.home, s.homeAbbr)) ||
               (leg.away && teamsMatch(leg.away, s.away, s.awayAbbr)))
          ) || null;
        }
        
        // Final fallback: inherit game from sibling leg
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
        if (hasLoss) break;
      }

      if (!allSettled) continue;

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

  return gradedCount;
}

/**
 * Sweep single bets in desk_ledger_bets (signed-in user bets).
 * These rows have home, away, sport, market_type, and ticket_name directly.
 */
async function sweepUserBets(sql: any, finals: any[]): Promise<number> {
  let pending: any[];
  try {
    pending = await sql`SELECT * FROM desk_ledger_bets WHERE result = 'PENDING' LIMIT 100`;
  } catch {
    // Table may not exist yet
    return 0;
  }
  if (!pending || pending.length === 0) return 0;

  let gradedCount = 0;

  for (const bet of pending) {
    try {
      const home = bet.home || "";
      const away = bet.away || "";
      const sport = bet.sport || null;
      const marketType = bet.market_type || "ml";
      const selection = bet.ticket_name || "";

      // Match to a completed game via home/away team names
      let hit = finals.find(
        (s) =>
          (!sport || !s.sport || s.sport === sport) &&
          ((home && teamsMatch(home, s.home, s.homeAbbr)) ||
           (away && teamsMatch(away, s.away, s.awayAbbr)))
      ) || null;

      // Fallback: try matching ticket_name (selection) against team names
      if (!hit) {
        hit = finals.find(
          (s) =>
            (!sport || !s.sport || s.sport === sport) &&
            (teamsMatch(selection, s.home, s.homeAbbr) ||
             teamsMatch(selection, s.away, s.awayAbbr))
        ) || null;
      }

      if (!hit) continue;

      const outcome = gradeMarket({
        marketType,
        side: null,
        selection,
        line: null,
        home: hit.home,
        away: hit.away,
        homeScore: hit.homeScore,
        awayScore: hit.awayScore,
      });

      if (!outcome) continue;

      await sql`
        UPDATE desk_ledger_bets
        SET result = ${outcome},
            updated_at = now()
        WHERE id = ${bet.id}
      `;
      gradedCount++;

    } catch (e) {
      console.error(`Failed to grade user bet ${bet.id}:`, e);
    }
  }

  return gradedCount;
}