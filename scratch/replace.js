const fs = require('fs');
let content = fs.readFileSync('src/lib/market/live-board.ts', 'utf8');

const newFetchLiveQuotes = \export async function fetchLiveQuotes(): Promise<{ quotes: QuoteLine[]; notes: string[] }> {
  const yesterday = yyyymmddEt(-1);
  const today = yyyymmddEt(0);
  const plus2 = yyyymmddEt(2);
  const plus7 = yyyymmddEt(7);
  const plus24 = yyyymmddEt(24);
  const plus40 = yyyymmddEt(40);
  const year = etParts().year;
  const urls: Array<{ sport: string; url: string }> = [
    { sport: "NFL", url: \\\\/football/nfl/scoreboard?dates=\-\&limit=50\\\ },
    { sport: "NFL", url: \\\\/football/nfl/scoreboard?limit=50&seasontype=2&week=2\\\ },
    { sport: "NFL", url: \\\\/football/nfl/scoreboard?limit=50&seasontype=2&week=3\\\ },
    { sport: "MLB", url: \\\\/baseball/mlb/scoreboard?dates=\-\&limit=50\\\ },
    { sport: "NCAAF", url: \\\\/football/college-football/scoreboard?limit=80&groups=80\\\ },
    { sport: "NCAAF", url: \\\\/football/college-football/scoreboard?limit=80&week=2&year=\&seasontype=2&groups=80\\\ },
    { sport: "NCAAF", url: \\\\/football/college-football/scoreboard?limit=80&week=3&year=\&seasontype=2&groups=80\\\ },
    { sport: "NHL", url: \\\\/hockey/nhl/scoreboard?limit=40\\\ },
    { sport: "NHL", url: \\\\/hockey/nhl/scoreboard?dates=\-\&limit=50\\\ },
    { sport: "NBA", url: \\\\/basketball/nba/scoreboard?limit=30\\\ },
    { sport: "NBA", url: \\\\/basketball/nba/scoreboard?dates=\-\&limit=50\\\ },
    { sport: "NCAAB", url: \\\\/basketball/mens-college-basketball/scoreboard?limit=50\\\ },
  ];

  const results = await Promise.all(urls.map(async (u) => ({ ...u, board: await fetchJson<EspnScoreboard>(u.url) })));
  console.log("ESPN PAYLOAD SIZES:", results.map(b => ({ sport: b.sport, url: b.url, count: b.board?.events?.length })));\;

content = content.replace(/export async function fetchLiveQuotes\(\): Promise<\{ quotes: QuoteLine\[\]; notes: string\[\] \}> \{[\s\S]*?const results = await Promise\.all\(urls\.map\(async \(u\) => \(\{ \.\.\.u, board: await fetchJson\(u\.url\) \}\)\)\);/, newFetchLiveQuotes);

const oldBlock = \  const uniqueQuotes: QuoteLine[] = [];
  const seen = new Set<string>();
  const nowMs = Date.now();
  for (const q of quotes) {
    if (seen.has(q.eventId)) continue;

    const isNFL = q.sport === "NFL";
    const msUntil = new Date(q.start).getTime() - nowMs;
    
    if (isNFL) {
      if (msUntil > 7 * 86400_000) continue; 
    } else {
      // Allow games starting within 24 hours, or games that are currently in-play, or recently finished (negative msUntil)
      if (!q.inPlay && msUntil > 24 * 3600_000) continue;
      if (!q.inPlay && msUntil < -36 * 3600_000) continue;
    }

    seen.add(q.eventId);
    uniqueQuotes.push(q);
  }\;

const newBlock = \  const uniqueQuotes: QuoteLine[] = [];
  const seen = new Set<string>();
  const nowMs = Date.now();
  for (const q of quotes) {
    if (seen.has(q.eventId)) continue;

    const isNFL = q.sport === "NFL";
    const isMLB = q.sport === "MLB";
    const msUntil = new Date(q.start).getTime() - nowMs;
    
    if (isNFL) {
      if (msUntil > 7 * 86400_000) continue; 
    } else if (isMLB && q.inPlay) {
      // Unconditionally allow any live MLB game
    } else {
      // Allow games starting within 24 hours, or games that are currently in-play, or recently finished (negative msUntil)
      if (!q.inPlay && msUntil > 24 * 3600_000) continue;
      if (!q.inPlay && msUntil < -36 * 3600_000) continue;
    }

    seen.add(q.eventId);
    uniqueQuotes.push(q);
  }\;

content = content.replace(oldBlock, newBlock);
fs.writeFileSync('src/lib/market/live-board.ts', content);
