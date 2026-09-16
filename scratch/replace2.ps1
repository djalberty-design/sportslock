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
    { sport: "MLB", url: `${ESPN_WEB}/baseball/mlb/scoreboard?dates=${yesterday}&limit=50` },
    { sport: "MLB", url: `${ESPN_WEB}/baseball/mlb/scoreboard?dates=${today}&limit=50` },
    { sport: "MLB", url: `${ESPN_WEB}/baseball/mlb/scoreboard?dates=${plus2}&limit=50` },
    { sport: "NCAAF", url: `${ESPN_WEB}/football/college-football/scoreboard?limit=80&groups=80` },
    { sport: "NCAAF", url: `${ESPN_WEB}/football/college-football/scoreboard?limit=80&week=2&year=${year}&seasontype=2&groups=80` },
    { sport: "NCAAF", url: `${ESPN_WEB}/football/college-football/scoreboard?limit=80&week=3&year=${year}&seasontype=2&groups=80` },
    { sport: "NHL", url: `${ESPN_WEB}/hockey/nhl/scoreboard?limit=40` },
    { sport: "NHL", url: `${ESPN_WEB}/hockey/nhl/scoreboard?dates=${yesterday}&limit=50` },
    { sport: "NHL", url: `${ESPN_WEB}/hockey/nhl/scoreboard?dates=${today}&limit=50` },
    { sport: "NHL", url: `${ESPN_WEB}/hockey/nhl/scoreboard?dates=${plus24}&limit=50` },
    { sport: "NBA", url: `${ESPN_WEB}/basketball/nba/scoreboard?limit=30` },
    { sport: "NBA", url: `${ESPN_WEB}/basketball/nba/scoreboard?dates=${yesterday}&limit=50` },
    { sport: "NBA", url: `${ESPN_WEB}/basketball/nba/scoreboard?dates=${today}&limit=50` },
    { sport: "NBA", url: `${ESPN_WEB}/basketball/nba/scoreboard?dates=${plus40}&limit=50` },
    { sport: "NCAAB", url: `${ESPN_WEB}/basketball/mens-college-basketball/scoreboard?limit=50` },
  ];

  const results = await Promise.all(urls.map(async (u) => ({ ...u, board: await fetchJson<EspnScoreboard>(u.url) })));
  console.log("ESPN PAYLOAD SIZES:", results.map(b => ({ sport: b.sport, url: b.url, count: b.board?.events?.length })));
"@

$content = $content -replace '(?s)export async function fetchLiveQuotes\(\): Promise<\{ quotes: QuoteLine\[\]; notes: string\[\] \}> \{.*?console\.log\("ESPN PAYLOAD SIZES:".*?\);', $newFetchLiveQuotes

Set-Content src/lib/market/live-board.ts $content
