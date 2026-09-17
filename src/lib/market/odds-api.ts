export const ODDS_API_KEY = process.env.ODDS_API_KEY || "c5fa171c7620da6c912ff69d843db37d";

// Store in global object to survive Next.js / TanStack hot reloads and Vercel warm starts
const globalCache = (globalThis as any).__oddsApiCache || {
  mains: null as any,
  mainsLastFetch: 0,
  props: {} as Record<string, any>,
  quotaRemaining: null as number | null,
};
(globalThis as any).__oddsApiCache = globalCache;

function getActiveSports(): string[] {
  const month = new Date().getMonth() + 1; // 1-12
  const active = [];
  
  // NFL: Sep(9) to Feb(2)
  if (month >= 9 || month <= 2) active.push("americanfootball_nfl");
  // NCAAF: Aug(8) to Jan(1)
  if (month >= 8 || month <= 1) active.push("americanfootball_ncaaf");
  // MLB: Mar(3) to Nov(11)
  if (month >= 3 && month <= 11) active.push("baseball_mlb");
  
  // NBA: Oct(10) to Jun(6)
  if (month >= 10 || month <= 6) active.push("basketball_nba");
  // NHL: Oct(10) to Jun(6)
  if (month >= 10 || month <= 6) active.push("icehockey_nhl");
  // NCAAB: Nov(11) to Apr(4)
  if (month >= 11 || month <= 4) active.push("basketball_ncaab");
  
  return active;
}

export function getOddsQuota() {
  return globalCache.quotaRemaining;
}

export async function fetchOddsApiMains(force = false) {
  const CACHE_TTL = 1000 * 60 * 60 * 12; // 12 hours
  if (!force && globalCache.mains && Date.now() - globalCache.mainsLastFetch < CACHE_TTL) {
    return globalCache.mains;
  }

  const sports = getActiveSports();
  const results = [];

  for (const sport of sports) {
    try {
      const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h,spreads,totals&bookmakers=hardrock,draftkings,fanduel`;
      const res = await fetch(url);
      
      const remaining = res.headers.get("x-requests-remaining");
      if (remaining) globalCache.quotaRemaining = parseInt(remaining, 10);

      if (!res.ok) {
        console.error(`Odds API Error for ${sport}:`, res.status);
        continue;
      }
      
      const data = await res.json();
      results.push({ sport, data });
    } catch (e) {
      console.error(`Odds API Fetch Error for ${sport}:`, e);
    }
  }

  globalCache.mains = results;
  globalCache.mainsLastFetch = Date.now();
  return results;
}

export async function fetchOddsApiProps(sportKey: string, eventId: string) {
  // Check if we already pulled props for this game today
  if (globalCache.props[eventId]) {
    return globalCache.props[eventId];
  }

  try {
    const markets = "player_pass_tds,player_pass_yds,player_rush_yds,player_reception_yds,player_home_runs,player_strikeouts,player_hits,player_points,player_rebounds,player_assists";
    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/events/${eventId}/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=${markets}&bookmakers=hardrock,draftkings,fanduel`;
    
    const res = await fetch(url);
    
    const remaining = res.headers.get("x-requests-remaining");
    if (remaining) globalCache.quotaRemaining = parseInt(remaining, 10);

    if (!res.ok) {
      console.error(`Odds API Props Error for ${eventId}:`, res.status);
      return null;
    }
    
    const data = await res.json();
    globalCache.props[eventId] = data;
    return data;
  } catch (e) {
    console.error(`Odds API Fetch Props Error:`, e);
    return null;
  }
}
export function getOddsPropsCache() {
  return globalCache.props;
}