const fs = require('fs');
let code = fs.readFileSync('src/lib/market/live-board.ts', 'utf8');

code = code.replace(
  'import { polyFromEventResearch, type PolyContract, guessPolySlug, polymarketHomeWin } from "./polymarket";',
  'import { polyFromEventResearch, type PolyContract, guessPolySlug, polymarketHomeWin } from "./polymarket";\nimport { fetchOddsApiMains } from "./odds-api";'
);

code = code.replace(
  'const [{ quotes, notes }, kalshiContracts, polyContracts, rawTape] = await Promise.all([',
  'const [{ quotes, notes }, kalshiContracts, polyContracts, rawTape, oddsApiMains] = await Promise.all([\n      fetchLiveQuotes(),\n      fetchKalshiContracts().catch(() => []),      \n      fetchPolymarketContracts().catch(() => [] as PolyContract[]),\n      fetchActionNetworkTape().catch(() => [] as RawBookTape[]),\n      fetchOddsApiMains().catch(() => [])\n    ]);\n    // Remove duplicate fetchLiveQuotes call that was originally in the array\n'
);

code = code.replace(
  '      fetchLiveQuotes(),\n      fetchKalshiContracts().catch(() => []),',
  '// replaced'
);

const overlayFunc = `
function overlayOddsApiMains(quotes: QuoteLine[], oddsApiData: any[]): QuoteLine[] {
  if (!oddsApiData || !oddsApiData.length) return quotes;
  const apiGames: any[] = [];
  for (const group of oddsApiData) {
    if (!group || !group.data) continue;
    apiGames.push(...group.data);
  }
  for (const q of quotes) {
    const matchingGame = apiGames.find(g => 
      (g.home_team.includes(q.homeNick) || q.homeNick.includes(g.home_team)) &&
      (g.away_team.includes(q.awayNick) || q.awayNick.includes(g.away_team))
    );
    if (matchingGame) {
      let bookmaker = matchingGame.bookmakers.find((b: any) => b.key === 'hardrock') || 
                      matchingGame.bookmakers.find((b: any) => b.key === 'draftkings') ||
                      matchingGame.bookmakers.find((b: any) => b.key === 'fanduel');
      if (!bookmaker) continue;
      const ml = bookmaker.markets.find((m: any) => m.key === 'h2h');
      const sp = bookmaker.markets.find((m: any) => m.key === 'spreads');
      const tot = bookmaker.markets.find((m: any) => m.key === 'totals');
      if (q.marketType === 'ml' && ml) {
        const o = ml.outcomes.find((o: any) => q.side === 'home' ? o.name === matchingGame.home_team : o.name === matchingGame.away_team);
        if (o) { q.price = o.price > 0 ? o.price : (o.price < 0 ? o.price : q.price); q.source = "odds-api"; q.scheduleOnly = false; }
      }
      if (q.marketType === 'spread' && sp) {
        const o = sp.outcomes.find((o: any) => q.side === 'home' ? o.name === matchingGame.home_team : o.name === matchingGame.away_team);
        if (o) { q.price = o.price; q.point = o.point; q.source = "odds-api"; q.scheduleOnly = false; }
      }
      if (q.marketType === 'total' && tot) {
        const o = tot.outcomes.find((o: any) => q.side === 'home' ? o.name === 'Over' : o.name === 'Under');
        if (o) { q.price = o.price; q.point = o.point; q.source = "odds-api"; q.scheduleOnly = false; }
      }
    }
  }
  return quotes;
}
`;

code = code.replace(
  '    quotes = capEventIds(quotes, "NHL", 16);',
  '    quotes = capEventIds(quotes, "NHL", 16);\n    quotes = overlayOddsApiMains(quotes, oddsApiMains);'
);

code = code + overlayFunc;

fs.writeFileSync('src/lib/market/live-board.ts', code, 'utf8');
console.log("Patched live-board.ts");