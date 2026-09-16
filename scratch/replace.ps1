$content = Get-Content src/lib/market/live-board.ts -Raw

$newFetchLiveQuotes = @"
export async function fetchLiveQuotes(): Promise<{ quotes: QuoteLine[]; notes: string[] }> {
  const yesterday = yyyymmddEt(-1);
  const today = yyyymmddEt(0);
  const plus2 = yyyymmddEt(2);
  const plus7 = yyyymmddEt(7);
  const plus24 = yyyymmddEt(24);
  const plus40 = yyyymmddEt(40);
  const year = etParts().year;
  const urls: Array<{ sport: string; url: string }> = [
    { sport: "NFL", url: `${ESPN_WEB}/football/nfl/scoreboard?dates=${yesterday}-${plus7}&limit=50` },
    { sport: "NFL", url: `${ESPN_WEB}/football/nfl/scoreboard?limit=50&seasontype=2&week=2` },
    { sport: "NFL", url: `${ESPN_WEB}/football/nfl/scoreboard?limit=50&seasontype=2&week=3` },
    { sport: "MLB", url: `${ESPN_WEB}/baseball/mlb/scoreboard?dates=${yesterday}-${plus2}&limit=50` },
    { sport: "NCAAF", url: `${ESPN_WEB}/football/college-football/scoreboard?limit=80&groups=80` },
    { sport: "NCAAF", url: `${ESPN_WEB}/football/college-football/scoreboard?limit=80&week=2&year=${year}&seasontype=2&groups=80` },
    { sport: "NCAAF", url: `${ESPN_WEB}/football/college-football/scoreboard?limit=80&week=3&year=${year}&seasontype=2&groups=80` },
    { sport: "NHL", url: `${ESPN_WEB}/hockey/nhl/scoreboard?limit=40` },
    { sport: "NHL", url: `${ESPN_WEB}/hockey/nhl/scoreboard?dates=${yesterday}-${plus24}&limit=50` },
    { sport: "NBA", url: `${ESPN_WEB}/basketball/nba/scoreboard?limit=30` },
    { sport: "NBA", url: `${ESPN_WEB}/basketball/nba/scoreboard?dates=${yesterday}-${plus40}&limit=50` },
    { sport: "NCAAB", url: `${ESPN_WEB}/basketball/mens-college-basketball/scoreboard?limit=50` },
  ];

  const results = await Promise.all(urls.map(async (u) => ({ ...u, board: await fetchJson<EspnScoreboard>(u.url) })));
  console.log("ESPN PAYLOAD SIZES:", results.map(b => ({ sport: b.sport, url: b.url, count: b?.board?.events?.length })));
"@

$content = $content -replace '(?s)export async function fetchLiveQuotes\(\): Promise<\{ quotes: QuoteLine\[\]; notes: string\[\] \}> \{.*?const results = await Promise\.all\(urls\.map\(async \(u\) => \(\{ \.\.\.u, board: await fetchJson\(u\.url\) \}\)\)\);', $newFetchLiveQuotes

$oldBlock = @"
  const uniqueQuotes: QuoteLine[] = [];
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
  }
"@

$newBlock = @"
  const uniqueQuotes: QuoteLine[] = [];
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
  }
"@

$content = $content.Replace($oldBlock, $newBlock)
Set-Content src/lib/market/live-board.ts $content
