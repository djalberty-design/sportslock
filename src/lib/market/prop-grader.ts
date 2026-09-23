import { getSql } from "@/lib/db";
import { teamsMatch } from "./live-scores";

type TapeGrade = 'WIN' | 'LOSS' | 'PUSH' | 'EXPIRED';

const SPORT_PATHS: Record<string, string> = {
  NFL: "football/nfl",
  NCAAF: "football/college-football",
  NBA: "basketball/nba",
  NCAAB: "basketball/mens-college-basketball",
  MLB: "baseball/mlb",
  NHL: "hockey/nhl",
};

const UA = "Mozilla/5.0 (compatible; SportsLock/1.0; +https://x.ai)";

async function fetchJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function toDateStr(d: Date): string {
  const nyDate = d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  return nyDate.replace(/-/g, "");
}

async function resolveEspnEventId(sport: string, date: Date, home: string, away: string): Promise<string | null> {
  const path = SPORT_PATHS[sport.toUpperCase()];
  if (!path) return null;

  const dateStr = toDateStr(date);
  const url = `https://site.web.api.espn.com/apis/site/v2/sports/${path}/scoreboard?dates=${dateStr}`;
  const json = await fetchJson(url);
  
  if (!json?.events) return null;
  
  for (const ev of json.events) {
    const comp = ev.competitions?.[0];
    if (!comp) continue;
    
    const homeC = (comp.competitors ?? []).find((c: any) => c.homeAway === "home");
    const awayC = (comp.competitors ?? []).find((c: any) => c.homeAway === "away");
    
    const espnHome = homeC?.team?.displayName;
    const espnAway = awayC?.team?.displayName;
    const homeAbbr = homeC?.team?.abbreviation;
    const awayAbbr = awayC?.team?.abbreviation;
    
    if (teamsMatch(espnHome, home, homeAbbr) && teamsMatch(espnAway, away, awayAbbr)) {
      return ev.id;
    }
  }
  
  return null;
}

export function extractPlayerStat(boxscore: any, playerName: string, propType: string): number | null {
  if (!boxscore?.players) return null;
  
  const pt = propType.toLowerCase();

  for (const teamStats of boxscore.players) {
    for (const statGroup of teamStats.statistics) {
      if (!statGroup.keys || !statGroup.athletes) continue;
      
      const ath = statGroup.athletes.find((a: any) => 
        teamsMatch(a.athlete?.displayName, playerName) || 
        teamsMatch(a.athlete?.shortName, playerName) ||
        (a.athlete?.displayName && a.athlete.displayName.toLowerCase().includes(playerName.toLowerCase()))
      );
      if (!ath || !ath.stats) continue;

      let key: string | null = null;
      let statType = statGroup.type; // batting, pitching etc.
      let statName = statGroup.name; // passing, rushing etc.

      if (pt.includes('pass_yds')) key = "passingYards";
      else if (pt.includes('rush_yds')) key = "rushingYards";
      else if (pt.includes('rec_yds')) key = "receivingYards";
      else if (pt.includes('receptions')) key = "receptions";
      else if (pt.includes('pass_td')) key = "passingTouchdowns";
      else if (pt.includes('rush_td')) key = "rushingTouchdowns";
      else if (pt.includes('rec_td')) key = "receivingTouchdowns";
      else if (pt.includes('anytime_td')) {
        let tds = 0;
        let foundAny = false;
        const pIdx = statGroup.keys.indexOf("passingTouchdowns"); // ESPN sometimes credits QB rushing vs passing TDs in weird ways but we sum all non-passing TDs typically, wait no anytime TD does NOT include passing TD usually.
        // Actually anytime TD means rushing or receiving TD or return TD. 
        // For safety, sum rushing and receiving.
        const rushIndex = statGroup.keys.indexOf("rushingTouchdowns");
        const recIndex = statGroup.keys.indexOf("receivingTouchdowns");
        if (rushIndex >= 0) { tds += Number(ath.stats[rushIndex] || 0); foundAny = true; }
        if (recIndex >= 0) { tds += Number(ath.stats[recIndex] || 0); foundAny = true; }
        if (foundAny) return tds;
      }
      else if (pt.includes('points') && !pt.includes('points_rebounds_assists') && statGroup.keys.includes('points')) key = "points";
      else if (pt.includes('rebounds')) key = "rebounds";
      else if (pt.includes('assists') && !pt.includes('points_rebounds_assists') && !pt.includes('rebounds_assists')) key = "assists";
      else if (pt.includes('threes') || pt.includes('3pm')) key = "threePointFieldGoalsMade-threePointFieldGoalsAttempted";
      else if (pt.includes('blocks')) key = "blocks";
      else if (pt.includes('steals')) key = "steals";
      else if (pt.includes('turnovers')) key = "turnovers";
      else if (pt.includes('points_rebounds_assists') || pt.includes('pra')) {
        const p = Number(ath.stats[statGroup.keys.indexOf("points")] || 0);
        const r = Number(ath.stats[statGroup.keys.indexOf("rebounds")] || 0);
        const a = Number(ath.stats[statGroup.keys.indexOf("assists")] || 0);
        return p + r + a;
      }
      else if (pt.includes('hits') && !pt.includes('pitching')) {
        if (statType === 'pitching') continue;
        key = "hits";
      }
      else if (pt.includes('home_runs') || pt.includes('hr')) {
        if (statType === 'pitching') continue;
        key = "homeRuns";
      }
      else if (pt.includes('rbi')) key = "RBIs";
      else if (pt.includes('strikeout') || pt.includes('ks')) {
        if (statType === 'batting') continue;
        key = "strikeouts";
      }
      else if (pt.includes('shots') || pt.includes('sog')) key = "shotsTotal";
      else if (pt.includes('goals') && !pt.includes('shots')) key = "goals";
      else if (pt.includes('saves')) key = "saves";

      if (key === "threePointFieldGoalsMade-threePointFieldGoalsAttempted") {
        const idx = statGroup.keys.indexOf(key);
        if (idx >= 0) {
          const val = ath.stats[idx];
          if (val && typeof val === 'string' && val.includes('-')) {
            return Number(val.split('-')[0]);
          }
        }
      }

      if (key) {
        const idx = statGroup.keys.indexOf(key);
        if (idx >= 0) {
          return Number(ath.stats[idx]);
        }
      }
    }
  }
  
  return null;
}

export async function gradeProps() {
  const sql = await getSql();
  
  // Grade pending props that are at least 6 hours old
  const pending = await sql.query<{
    id: string;
    event_id: string;
    sport: string;
    home: string;
    away: string;
    market_type: string;
    side: string;
    selection: string;
    line: string | number;
    player: string;
    start: Date;
    snapped_at: Date;
  }>(`
    select id, event_id, sport, home, away, market_type, side, selection, line, player, start, snapped_at
    from market_tape
    where (status is null or status = 'PENDING')
      and market_type not in ('ml', 'spread', 'total')
      and (market_type = 'prop' or market_type like 'player_%' or player is not null)
      and coalesce(start, snapped_at) < now() - interval '6 hours'
    limit 2000
  `);

  let graded = 0;
  let unmatched = 0;
  let skipped = 0;

  for (const row of pending) {
    if (!row.sport || !row.home || !row.away || (!row.player && !row.selection)) {
      skipped++;
      continue;
    }

    const dateToUse = row.start ? new Date(row.start) : new Date(row.snapped_at);
    const espnId = await resolveEspnEventId(row.sport, dateToUse, row.home, row.away);
    
    if (!espnId) {
      unmatched++;
      continue;
    }

    const path = SPORT_PATHS[row.sport.toUpperCase()];
    if (!path) {
      skipped++;
      continue;
    }

    const summaryUrl = `https://site.web.api.espn.com/apis/site/v2/sports/${path}/summary?event=${espnId}`;
    const summary = await fetchJson(summaryUrl);
    
    if (!summary || !summary.boxscore || summary.header?.competitions?.[0]?.status?.type?.completed === false) {
      unmatched++;
      continue;
    }

    const playerName = row.player || row.selection.split(/(over|under|o\/u|anytime|\d)/i)[0].trim();
    // Default to the selection string if market_type is generic 'prop'
    const propType = (row.market_type === 'prop' || !row.market_type) ? row.selection : row.market_type;
    
    const actualStat = extractPlayerStat(summary.boxscore, playerName, propType);

    if (actualStat === null || !Number.isFinite(actualStat)) {
      unmatched++;
      continue;
    }

    const line = Number(row.line);
    const sel = row.selection.toLowerCase();
    const side = row.side?.toLowerCase();
    
    let outcome: TapeGrade | null = null;

    if (propType.includes('anytime_td') || sel.includes('anytime') || sel.includes('to score a touchdown') || sel.includes('home run') || sel.includes('to homer')) {
      // Yes/No counting props
      const target = line > 0 ? line : 1;
      const yes = side === 'yes' || side === 'over' || !side;
      if (actualStat >= target) {
        outcome = yes ? 'WIN' : 'LOSS';
      } else {
        outcome = yes ? 'LOSS' : 'WIN';
      }
    } else {
      if (!Number.isFinite(line)) {
        skipped++;
        continue;
      }
      
      const isOver = side === 'over' || /\bover\b/i.test(sel) || /\bo\s+\d/.test(sel);
      
      if (actualStat === line) outcome = 'PUSH';
      else if (isOver) outcome = actualStat > line ? 'WIN' : 'LOSS';
      else outcome = actualStat < line ? 'WIN' : 'LOSS';
    }

    if (outcome) {
      await sql.query(
        `update market_tape set status = $1, graded_at = now() where id = $2`,
        [outcome, row.id]
      );
      graded++;
    } else {
      skipped++;
    }
  }

  // Expire old ungraded props
  const expiredResult = await sql.query(`
    update market_tape
    set status = 'EXPIRED', graded_at = now()
    where (status is null or status = 'PENDING')
      and market_type not in ('ml', 'spread', 'total')
      and coalesce(start, snapped_at) < now() - interval '14 days'
    returning id
  `);

  return { graded, unmatched, skipped, expired: expiredResult.length };
}

export const gradePlayerProps = gradeProps;
