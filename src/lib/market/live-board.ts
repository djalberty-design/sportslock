import { BRAND } from "../brand.ts";
import { etParts, isTodayEt } from "../utils.ts";
import type { DeskSnapshot, EventBrief, PredictQuote, PublicSplit, QuoteLine } from "./types.ts";
import { ESPN_PATH, fetchPlayerRecent, fetchTeamLastTen, parseEspnSummary, parseInternalEventId, type EventResearch } from "./research.ts";
import { fetchTeamLooks } from "./looks.ts";
import { mergeForm } from "./form.ts";
import { fetchKalshiContracts, kalshiHomeWin } from "./kalshi.ts";
import { fetchPolymarketContracts, fetchPolymarketBySlug, guessPolySlug, polymarketHomeWin, type PolyContract } from "./polymarket.ts";
import { buildChance, parseEra } from "./chance.ts";
import { twoWayNoVig } from "./engine.ts";
import { ALL_SPORTS } from "./universe.ts";
import {
  AN_SPORT,
  analyzeTape,
  matchRawTape,
  parseActionNetworkScoreboard,
  rawToSplit,
  reconstructHandle,
  type RawBookTape,
} from "./tape.ts";

const ESPN_WEB = "https://site.web.api.espn.com/apis/site/v2/sports";
const UA = "Mozilla/5.0 (compatible; SportsLock/1.0; +https://x.ai)";

type EspnCompetitor = {
  homeAway?: string;
  score?: string | number;
  team?: { displayName?: string; name?: string; abbreviation?: string; id?: string; logo?: string };
  records?: Array<{ type?: string; name?: string; summary?: string }>;
  probables?: Array<{
    athlete?: { displayName?: string };
    statistics?: Array<{ abbreviation?: string; displayValue?: string }>;
  }>;
};

type EspnOdds = {
  provider?: { name?: string };
  details?: string;
  overUnder?: number;
  spread?: number;
  moneyline?: { home?: { close?: { odds?: string }; open?: { odds?: string } }; away?: { close?: { odds?: string }; open?: { odds?: string } } };
  pointSpread?: {
    home?: { close?: { line?: string; odds?: string } };
    away?: { close?: { line?: string; odds?: string } };
  };
  total?: {
    over?: { close?: { line?: string; odds?: string } };
    under?: { close?: { line?: string; odds?: string } };
  };
};

export type EspnEvent = {
  id?: string;
  date?: string;
  name?: string;
  competitions?: Array<{
    date?: string;
    status?: {
      displayClock?: string;
      period?: number;
      type?: { state?: string; completed?: boolean; description?: string; detail?: string; shortDetail?: string };
    };
    situation?: { down?: number; distance?: number; possession?: string; yardLine?: string };
    competitors?: EspnCompetitor[];
    odds?: EspnOdds[];
  }>;
};

export type EspnScoreboard = { events?: EspnEvent[]; season?: { year?: number; type?: number } };

function yyyymmddEt(offsetDays = 0): string {
  const ms = Date.now() + offsetDays * 86400_000;
  const p = etParts(new Date(ms));
  return `${p.year}${p.month}${p.day}`;
}

function parseAmerican(raw: string | number | undefined | null): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[^0-9.+-]/g, ""));
  return Number.isFinite(n) && n !== 0 ? n : null;
}

function parseLine(raw: string | number | undefined | null): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[ouOU]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

async function fetchJson<T = EspnScoreboard>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function sitLine(s?: { down?: number; distance?: number; possession?: string; yardLine?: string }): string | undefined {
  if (!s) return undefined;
  const bits = [
    s.down != null ? `${s.down}` : null,
    s.distance != null ? `& ${s.distance}` : null,
    s.yardLine,
    s.possession,
  ].filter(Boolean);
  return bits.length ? bits.join(" ") : undefined;
}

function recordOf(c: EspnCompetitor | undefined, type = "total"): string | undefined {
  return c?.records?.find((r) => r.type === type || r.name?.toLowerCase() === type)?.summary;
}

function pitcherOf(c: EspnCompetitor | undefined): string | undefined {
  const p = c?.probables?.[0];
  const name = p?.athlete?.displayName;
  if (!name) return undefined;
  const era = p?.statistics?.find((s) => s.abbreviation === "ERA")?.displayValue;
  return era ? `${name} (ERA ${era})` : name;
}

function numScore(raw: string | number | undefined): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(raw.replace(/[^0-9.+-]/g, ""));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export function quotesFromEspnEvent(event: EspnEvent, sport: QuoteLine["sport"] | string, phase?: QuoteLine["phase"]): QuoteLine[] {
  const comp = event.competitions?.[0];
  if (!comp) return [];
  const state = comp.status?.type?.state ?? "";
  if (comp.status?.type?.completed || state === "post") return [];
  const competitors = comp.competitors ?? [];
  const homeC = competitors.find((c) => c.homeAway === "home");
  const awayC = competitors.find((c) => c.homeAway === "away");
  const home = homeC?.team?.displayName;
  const away = awayC?.team?.displayName;
  const homeShort = homeC?.team?.name || home;
  const awayShort = awayC?.team?.name || away;
  if (!home || !away || !homeShort || !awayShort) return [];
  const start = comp.date || event.date;
  if (!start) return [];
  const inPlay = state === "in";
  const startMs = new Date(start).getTime();
  if (!Number.isFinite(startMs)) return [];
  const odds = comp.odds?.[0];
  const scheduleOnly = !odds;

    const eventId = `espn-${sport}-${event.id ?? `${awayShort}-${homeShort}-${start}`}`;
  const homeAbbr = homeC?.team?.abbreviation;
  const awayAbbr = awayC?.team?.abbreviation;
  const sportPath = ESPN_PATH[sport];
  const homeRecord = recordOf(homeC, "total");
  const awayRecord = recordOf(awayC, "total");
  const homePitcher = pitcherOf(homeC);
  const awayPitcher = pitcherOf(awayC);
  const homeScore = homeC?.score != null ? Number(homeC.score) : undefined;
  const awayScore = awayC?.score != null ? Number(awayC.score) : undefined;
  const clock = comp.status?.displayClock;
  const period = comp.status?.period;

  const base = {
    eventId,
    sport,
    start,
    home,
    away,
    homeAbbr,
    awayAbbr,
    inPlay,
    homeRecord,
    awayRecord,
    homePitcher,
    awayPitcher,
    homeScore,
    awayScore,
    clock,
    period,
    source: "espn" as const,
    delayed: true as const,
    inPlay,
    venueNote: "other" as const,
    confirmed: true,
    espnId: event.id,
    sportPath,
    homeRecord,
    awayRecord,
    homePitcher,
    awayPitcher,
    homeAbbr: homeC?.team?.abbreviation,
    awayAbbr: awayC?.team?.abbreviation,
    homeLogo: homeC?.team?.logo,
    awayLogo: awayC?.team?.logo,
    scheduleOnly,
    phase,
    homeScore: numScore(homeC?.score),
    awayScore: numScore(awayC?.score),
    clock: comp.status?.displayClock || (inPlay ? comp.status?.type?.shortDetail : undefined),
    period: comp.status?.period != null ? String(comp.status.period) : undefined,
    situation: inPlay
      ? [comp.status?.type?.detail, comp.status?.type?.shortDetail, sitLine(comp.situation)].filter(Boolean).join(" · ")
      : undefined,
  };

  const out: QuoteLine[] = [];
  if (scheduleOnly) {
    out.push({
      ...base,
      marketType: "ml",
      side: "home",
      selection: homeShort,
      price: -110,
    });
    out.push({
      ...base,
      marketType: "ml",
      side: "away",
      selection: awayShort,
      price: -110,
    });
    return out;
  }

  const mlHome = parseAmerican(odds.moneyline?.home?.close?.odds);
  const mlAway = parseAmerican(odds.moneyline?.away?.close?.odds);
  const mlHomeOpen = parseAmerican(odds.moneyline?.home?.open?.odds);
  const mlAwayOpen = parseAmerican(odds.moneyline?.away?.open?.odds);
  const spHome = parseAmerican(odds.pointSpread?.home?.close?.odds);
  const spAway = parseAmerican(odds.pointSpread?.away?.close?.odds);
  const spHomeLine = parseLine(odds.pointSpread?.home?.close?.line) ?? (odds.spread != null ? odds.spread : undefined);
  const spAwayLine = parseLine(odds.pointSpread?.away?.close?.line);
  const totOver = parseAmerican(odds.total?.over?.close?.odds);
  const totUnder = parseAmerican(odds.total?.under?.close?.odds);
  const totalPts = parseLine(odds.total?.over?.close?.line) ?? odds.overUnder;

  const priced = {
    ...base,
    homeSpread: spHomeLine,
    total: totalPts,
  };

  if (mlHome != null && mlAway != null) {
    out.push({
      ...priced,
      marketType: "ml",
      side: "home",
      selection: homeShort,
      price: mlHome,
      consensusPrice: mlHome,
      hardRockPrice: mlHome,
      openPrice: mlHomeOpen ?? undefined,
    });
    out.push({
      ...priced,
      marketType: "ml",
      side: "away",
      selection: awayShort,
      price: mlAway,
      consensusPrice: mlAway,
      hardRockPrice: mlAway,
      openPrice: mlAwayOpen ?? undefined,
    });
  } else {
    out.push({
      ...priced,
      marketType: "ml",
      side: "home",
      selection: homeShort,
      price: -110,
      scheduleOnly: true,
    });
    out.push({
      ...priced,
      marketType: "ml",
      side: "away",
      selection: awayShort,
      price: -110,
      scheduleOnly: true,
    });
  }
  if (spHome != null && spAway != null && spHomeLine != null && spAwayLine != null) {
    const hSign = spHomeLine > 0 ? `+${spHomeLine}` : `${spHomeLine}`;
    const aSign = spAwayLine > 0 ? `+${spAwayLine}` : `${spAwayLine}`;
    out.push({
      ...priced,
      marketType: "spread",
      side: "home",
      selection: `${homeShort} ${hSign}`,
      price: spHome,
      consensusPrice: spHome,
      hardRockPrice: spHome,
      point: spHomeLine,
    });
    out.push({
      ...priced,
      marketType: "spread",
      side: "away",
      selection: `${awayShort} ${aSign}`,
      price: spAway,
      consensusPrice: spAway,
      hardRockPrice: spAway,
      point: spAwayLine,
    });
  }
  if (totOver != null && totUnder != null && totalPts != null) {
    out.push({
      ...priced,
      marketType: "total",
      side: "over",
      selection: `${awayShort}/${homeShort} O ${totalPts}`,
      price: totOver,
      consensusPrice: totOver,
      hardRockPrice: totOver,
      point: totalPts,
    });
    out.push({
      ...priced,
      marketType: "total",
      side: "under",
      selection: `${awayShort}/${homeShort} U ${totalPts}`,
      price: totUnder,
      consensusPrice: totUnder,
      hardRockPrice: totUnder,
      point: totalPts,
    });
  }
  return out;
}

export function quotesFromScoreboard(board: EspnScoreboard | null, sport: string): QuoteLine[] {
  if (!board?.events?.length) return [];
  const type = board.season?.type;
  const phase: QuoteLine["phase"] = type === 1 ? "preseason" : type === 3 ? "playoff" : "regular";
  return board.events.flatMap((e) => quotesFromEspnEvent(e, sport, phase));
}

function withinDays(iso: string, days: number): boolean {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  const delta = t - Date.now();
  return delta > -3 * 3600_000 && delta < days * 86400_000;
}

function horizonDays(sport: string): number {
  switch (sport) {
    case "NBA":
      return 40;
    case "NHL":
      return 24;
    case "NCAAB":
      return 70;
    case "NFL":
      return 12;
    case "NCAAF":
      return 10;
    case "MLB":
      return 4;
    default:
      return 10;
  }
}

function capEventIds(quotes: QuoteLine[], sport: string, n: number): QuoteLine[] {
  const ids = [...new Set(quotes.filter((q) => q.sport === sport).map((q) => q.eventId))].slice(0, n);
  if (!ids.length) return quotes;
  return quotes.filter((q) => q.sport !== sport || ids.includes(q.eventId));
}

export async function fetchLiveQuotes(): Promise<{ quotes: QuoteLine[]; notes: string[] }> {
  const yesterday = yyyymmddEt(-1);
    const today = yyyymmddEt(0);
  const plus2 = yyyymmddEt(2);
  const plus24 = yyyymmddEt(24);
  const plus40 = yyyymmddEt(40);
  const year = etParts().year;
  const urls: Array<{ sport: string; url: string }> = [
    { sport: "NFL", url: `${ESPN_WEB}/football/nfl/scoreboard?limit=50` },
    { sport: "MLB", url: `${ESPN_WEB}/baseball/mlb/scoreboard?dates=${yesterday}-${plus2}&limit=50` },
    { sport: "NCAAF", url: `${ESPN_WEB}/football/college-football/scoreboard?limit=80&groups=80` },
    { sport: "NCAAF", url: `${ESPN_WEB}/football/college-football/scoreboard?limit=80&week=2&year=${year}&seasontype=2&groups=80` },
    { sport: "NHL", url: `${ESPN_WEB}/hockey/nhl/scoreboard?limit=40` },
    { sport: "NHL", url: `${ESPN_WEB}/hockey/nhl/scoreboard?dates=${yesterday}-${plus24}&limit=50` },
    { sport: "NBA", url: `${ESPN_WEB}/basketball/nba/scoreboard?limit=30` },
    { sport: "NBA", url: `${ESPN_WEB}/basketball/nba/scoreboard?dates=${yesterday}-${plus40}&limit=50` },
    { sport: "NCAAB", url: `${ESPN_WEB}/basketball/mens-college-basketball/scoreboard?limit=50` },
  ];

  const results = await Promise.all(urls.map(async (u) => ({ ...u, board: await fetchJson(u.url) })));
  const notes: string[] = [];
  const byId = new Map<string, QuoteLine>();
  const fetched = new Set<string>();

  for (const r of results) {
    if (!r.board) continue;
    fetched.add(r.sport);
    const rows = quotesFromScoreboard(r.board, r.sport);
    const horizon = horizonDays(r.sport);
    for (const q of rows) {
      if (!withinDays(q.start, horizon)) continue;
      if (!byId.has(`${q.eventId}-${q.marketType}-${q.side}`)) {
        byId.set(`${q.eventId}-${q.marketType}-${q.side}`, q);
      }
    }
  }

  let quotes = [...byId.values()].sort((a, b) => +new Date(a.start) - +new Date(b.start));
  quotes = capEventIds(quotes, "NCAAF", 18);
  quotes = capEventIds(quotes, "NCAAB", 16);
  quotes = capEventIds(quotes, "NBA", 16);
  quotes = capEventIds(quotes, "NHL", 16);
  for (const sport of ALL_SPORTS) {
    if (!fetched.has(sport)) notes.push(`${sport} feed missed`);
  }
  return { quotes, notes };
}

async function fetchActionNetworkTape(): Promise<RawBookTape[]> {
  const jobs = Object.entries(AN_SPORT).map(async ([sport, slug]) => {
    const json = await fetchJson(`https://api.actionnetwork.com/web/v1/scoreboard/${slug}`);
    if (!json) return [] as RawBookTape[];
    return parseActionNetworkScoreboard(json, sport);
  });
  const bags = await Promise.all(jobs);
  return bags.flat();
}

function splitsFromTape(
  quotes: QuoteLine[],
  raw: RawBookTape[],
): PublicSplit[] {
  const unique = new Map<string, QuoteLine>();
  for (const q of quotes) {
    if (!unique.has(q.eventId)) unique.set(q.eventId, q);
  }
  const out: PublicSplit[] = [];
  for (const q of unique.values()) {
    const hit = matchRawTape(raw, {
      eventId: q.eventId,
      sport: q.sport,
      home: q.home,
      away: q.away,
      homeAbbr: q.homeAbbr,
      awayAbbr: q.awayAbbr,
    });
    const mlHome = quotes.find((x) => x.eventId === q.eventId && x.marketType === "ml" && x.side === "home");
    const mlAway = quotes.find((x) => x.eventId === q.eventId && x.marketType === "ml" && x.side === "away");
    let openHome: number | undefined;
    let closeHome: number | undefined;
    if (mlHome?.openPrice != null && mlAway?.openPrice != null) {
      const nv = twoWayNoVig(mlHome.openPrice, mlAway.openPrice);
      if (Number.isFinite(nv.fairHome)) openHome = nv.fairHome;
    }
    if (mlHome?.price != null && mlAway?.price != null) {
      const nv = twoWayNoVig(mlHome.price, mlAway.price);
      if (Number.isFinite(nv.fairHome)) closeHome = nv.fairHome;
    }
    if (hit) {
      out.push(rawToSplit(hit, q.eventId, openHome, closeHome));
      continue;
    }
    if (openHome != null && closeHome != null && Math.abs(closeHome - openHome) >= 0.015) {
      const handle = reconstructHandle(0.5, openHome, closeHome);
      const steam = Math.abs(closeHome - openHome) >= 0.02;
      const read = analyzeTape(0.5, handle, steam);
      out.push({
        eventId: q.eventId,
        side: "home",
        marketType: "ml",
        publicPct: 50,
        ticketPct: 50,
        handlePct: Math.round(handle * 100),
        steam,
        lean: read.lean,
        source: "line-move",
        note: `Ticket count not posted. The moneyline moved from ${Math.round(openHome * 100)} to ${Math.round(closeHome * 100)} on ${q.home}. Treated as informed money, not a public copy-trade. Not Hard Rock's book.`,
      });
    }
  }
  return out;
}

async function fetchBriefs(
  quotes: QuoteLine[],
  predictByEvent: Map<string, PredictQuote>,
  rawTape: RawBookTape[] = [],
): Promise<EventBrief[]> {
  const unique = new Map<string, QuoteLine>();
  for (const q of quotes) {
    if (!unique.has(q.eventId) && q.espnId && ESPN_PATH[q.sport]) unique.set(q.eventId, q);
  }
  const soon = [...unique.values()]
    .filter((q) => {
      const t = new Date(q.start).getTime() - Date.now();
      return t > -3 * 3600_000 && t < 40 * 3600_000;
    })
    .sort((a, b) => {
      const todayA = isTodayEt(a.start) ? 1 : 0;
      const todayB = isTodayEt(b.start) ? 1 : 0;
      if (todayB !== todayA) return todayB - todayA;
      return +new Date(a.start) - +new Date(b.start);
    });
  const bySport = new Map<string, QuoteLine[]>();
  for (const q of soon) {
    const list = bySport.get(q.sport) ?? [];
    list.push(q);
    bySport.set(q.sport, list);
  }
  const even: QuoteLine[] = [];
  for (let i = 0; i < 6 && even.length < 16; i++) {
    for (const list of bySport.values()) {
      if (list[i] && even.length < 16) even.push(list[i]);
    }
  }
  const briefs = await Promise.all(
    even.map(async (q): Promise<EventBrief | null> => {
      const path = ESPN_PATH[q.sport];
      const parsed = parseInternalEventId(q.eventId);
      if (!path || !parsed) return null;
      const raw = await fetchJson(`https://site.web.api.espn.com/apis/site/v2/sports/${path}/summary?event=${parsed.espnId}`);
      if (!raw) return null;
      const research = parseEspnSummary(raw, q.eventId, q.sport, parsed.espnId) as EventResearch;
      const [homeForm, awayForm, homeLooks, awayLooks] = await Promise.all([
        research.homeTeamId ? fetchTeamLastTen(path, research.homeTeamId, research.home) : Promise.resolve(null),
        research.awayTeamId ? fetchTeamLastTen(path, research.awayTeamId, research.away) : Promise.resolve(null),
        research.homeTeamId ? fetchTeamLooks(path, research.homeTeamId, q.awayAbbr) : Promise.resolve(null),
        research.awayTeamId ? fetchTeamLooks(path, research.awayTeamId, q.homeAbbr) : Promise.resolve(null),
      ]);
      research.lastFive = mergeForm(
        (research.lastFive ?? []).map((b) => ({
          team: b.team,
          line: b.line,
          results: b.results,
          games: b.games ?? [],
          seasonGames: b.seasonGames,
        })),
        [homeForm, awayForm],
      );
      research.homeLooks = homeLooks ?? research.homeLooks;
      research.awayLooks = awayLooks ?? research.awayLooks;
      {
        const starters = (research.players ?? []).filter((p) => p.starter && p.id).slice(0, 6);
        if (starters.length) {
          const recents = await Promise.all(starters.map((p) => fetchPlayerRecent(q.sport, p.id)));
          const byId = new Map(starters.map((p, i) => [p.id, recents[i]]));
          research.players = (research.players ?? []).map((p) => {
            const hit = byId.get(p.id);
            if (!hit) return p;
            return { ...p, recentStats: hit.recentStats, recentN: hit.n, usageMin: hit.usageMin };
          });
        }
      }
      const pred = predictByEvent.get(q.eventId);
      const tape = matchRawTape(rawTape, {
        eventId: q.eventId,
        sport: q.sport,
        home: q.home,
        away: q.away,
        homeAbbr: q.homeAbbr,
        awayAbbr: q.awayAbbr,
      });
      let openHome: number | undefined = research.openHomeWin;
      const mlHome = quotes.find((x) => x.eventId === q.eventId && x.marketType === "ml" && x.side === "home");
      const mlAway = quotes.find((x) => x.eventId === q.eventId && x.marketType === "ml" && x.side === "away");
      if (openHome == null && mlHome?.openPrice != null && mlAway?.openPrice != null) {
        const nv = twoWayNoVig(mlHome.openPrice, mlAway.openPrice);
        if (Number.isFinite(nv.fairHome)) openHome = nv.fairHome;
      }
      const oddsHome =
        mlHome?.price != null && mlAway?.price != null && Number.isFinite(mlHome.price) && Number.isFinite(mlAway.price)
          ? twoWayNoVig(mlHome.price, mlAway.price).fairHome
          : undefined;
      const chance = buildChance({
        home: q.home,
        away: q.away,
        sport: q.sport,
        start: q.start,
        oddsHome,
        espnHome: research.espnHomeWin,
        bookHome: research.bookHomeWin,
        openHome,
        kalshiHome: pred?.kalshiHome,
        kalshiVolume: pred?.kalshiVolume,
        kalshiSpread: pred?.kalshiSpread,
        polyHome: pred?.polyHome,
        polyVolume: pred?.polyVolume,
        homeSpread: research.homeSpread ?? q.homeSpread,
        total: research.total ?? q.total,
        homeRecord: research.homeRecord ?? q.homeRecord,
        awayRecord: research.awayRecord ?? q.awayRecord,
        homeSplit: research.homeSplit,
        awaySplit: research.awaySplit,
        homeEra: research.homeEra ?? parseEra(q.homePitcher),
        awayEra: research.awayEra ?? parseEra(q.awayPitcher),
        homeWhip: research.homeWhip,
        awayWhip: research.awayWhip,
        lastFive: research.lastFive,
        homeOuts: research.homeOuts,
        awayOuts: research.awayOuts,
        homeQuestionable: research.homeQuestionable,
        awayQuestionable: research.awayQuestionable,
        homePf: research.homePf,
        homePa: research.homePa,
        awayPf: research.awayPf,
        awayPa: research.awayPa,
        weatherTemp: research.weatherTemp,
        weatherWind: research.weatherWind,
        weatherPrecip: research.weatherPrecip,
        venue: research.venue,
        seriesHomeWins: research.seriesHomeWins,
        seriesAwayWins: research.seriesAwayWins,
        homeRestDays: research.homeRestDays,
        awayRestDays: research.awayRestDays,
        ticketHome: tape?.ticketHome,
        handleHome: tape?.handleHome,
        steam: tape?.steam,
        homeLooks: research.homeLooks,
        awayLooks: research.awayLooks,
        homePitcherHand: research.homePitcherHand === "L" || research.homePitcherHand === "R" ? research.homePitcherHand : undefined,
        awayPitcherHand: research.awayPitcherHand === "L" || research.awayPitcherHand === "R" ? research.awayPitcherHand : undefined,
      });
      const brief: EventBrief = {
        eventId: q.eventId,
        espnHomeWin: research.espnHomeWin,
        espnAwayWin: research.espnAwayWin,
        homeRecord: research.homeRecord ?? q.homeRecord,
        awayRecord: research.awayRecord ?? q.awayRecord,
        weather: research.weather,
        series: research.series,
        injuryCount: research.injuries.length,
        kalshiHomeWin: pred?.kalshiHome,
        polyHomeWin: pred?.polyHome,
        kalshiVolume: pred?.kalshiVolume,
        polyVolume: pred?.polyVolume,
        kalshiSpread: pred?.kalshiSpread,
        bookHomeWin: research.bookHomeWin,
        chanceHome: chance?.home,
        homeSpread: research.homeSpread ?? q.homeSpread,
        total: research.total ?? q.total,
        openHomeWin: openHome,
        ticketHome: tape?.ticketHome,
        handleHome: tape?.handleHome,
        steam: tape?.steam,
        venue: research.venue,
        homeScore: q.homeScore,
        awayScore: q.awayScore,
        clock: q.clock,
        period: q.period,
        situation: q.situation,
        weatherTemp: research.weatherTemp,
        weatherWind: research.weatherWind,
        weatherPrecip: research.weatherPrecip,
        homeEra: research.homeEra,
        awayEra: research.awayEra,
        homeSplit: research.homeSplit,
        awaySplit: research.awaySplit,
        homeOuts: research.homeOuts,
        awayOuts: research.awayOuts,
        homeQuestionable: research.homeQuestionable,
        awayQuestionable: research.awayQuestionable,
        homeWhip: research.homeWhip,
        awayWhip: research.awayWhip,
        homePf: research.homePf,
        homePa: research.homePa,
        awayPf: research.awayPf,
        awayPa: research.awayPa,
        seriesHomeWins: research.seriesHomeWins,
        seriesAwayWins: research.seriesAwayWins,
        homeRestDays: research.homeRestDays,
        awayRestDays: research.awayRestDays,
        players: (research.players ?? []).slice(0, 28).map((p) => ({
          id: p.id,
          name: p.name,
          team: p.team,
          homeAway: p.homeAway,
          position: p.position,
          headshot: p.headshot,
          starter: p.starter,
          stats: p.stats ?? {},
          recentStats: p.recentStats,
          recentN: p.recentN,
          usageMin: p.usageMin,
        })),
        injuries: research.injuries.slice(0, 16).map((i) => ({
          team: i.team,
          player: i.player,
          status: i.status,
          detail: i.detail,
        })),
        form: research.lastFive,
        homeLooks: research.homeLooks,
        awayLooks: research.awayLooks,
        homePitcherHand: research.homePitcherHand === "L" || research.homePitcherHand === "R" ? research.homePitcherHand : undefined,
        awayPitcherHand: research.awayPitcherHand === "L" || research.awayPitcherHand === "R" ? research.awayPitcherHand : undefined,
      };
      return brief;
    }),
  );
  return briefs.filter((b): b is EventBrief => b !== null);
}

export async function buildLiveSnapshot(asOf = new Date().toISOString()): Promise<DeskSnapshot> {
  const [{ quotes, notes }, kalshiContracts, polyContracts, rawTape] = await Promise.all([
    fetchLiveQuotes(),
    fetchKalshiContracts().catch(() => []),
    fetchPolymarketContracts().catch(() => [] as PolyContract[]),
    fetchActionNetworkTape().catch(() => [] as RawBookTape[]),
  ]);
  const uniqueQuotes: QuoteLine[] = [];
  const seen = new Set<string>();
  const nowMs = Date.now();
  for (const q of quotes) {
    if (seen.has(q.eventId)) continue;

    const isNFL = q.sport === "NFL";
    const todayEt = isTodayEt(q.start);
    
    if (isNFL) {
      const msUntil = new Date(q.start).getTime() - nowMs;
      if (msUntil > 7 * 86400_000) continue; 
    } else {
      if (!todayEt && !q.inPlay) continue; 
    }

    seen.add(q.eventId);
    uniqueQuotes.push(q);
  }

  const polyBag: PolyContract[] = [...polyContracts];
  const unmatched = uniqueQuotes.filter((q) => !polymarketHomeWin(polyBag, { sport: q.sport, home: q.home, away: q.away, homeAbbr: q.homeAbbr, awayAbbr: q.awayAbbr, start: q.start }));
  const slugLookups = unmatched.slice(0, 12).map(async (q) => {
    const slug = guessPolySlug(q.sport, q.awayAbbr, q.homeAbbr, q.start);
    if (!slug) return;
    const extra = await fetchPolymarketBySlug(slug, q.sport);
    if (extra) polyBag.push(extra);
  });
  await Promise.all(slugLookups);

  const predictByEvent = new Map<string, PredictQuote>();
  const predict: PredictQuote[] = [];
  for (const q of uniqueQuotes) {
    const k = kalshiHomeWin(kalshiContracts, {
      sport: q.sport,
      home: q.home,
      away: q.away,
      homeAbbr: q.homeAbbr,
      awayAbbr: q.awayAbbr,
      start: q.start,
    });
    const poly = polymarketHomeWin(polyBag, {
      sport: q.sport,
      home: q.home,
      away: q.away,
      homeAbbr: q.homeAbbr,
      awayAbbr: q.awayAbbr,
      start: q.start,
    });
    if (!k && !poly) continue;
    const row: PredictQuote = {
      eventId: q.eventId,
      sport: q.sport,
      kalshiHome: k?.home,
      kalshiVolume: k?.volume,
      kalshiSpread: k?.spread,
      polyHome: poly?.home,
      polyVolume: poly?.volume,
      source: k && poly ? "both" : poly ? "polymarket" : "kalshi",
    };
    predictByEvent.set(q.eventId, row);
    predict.push(row);
  }
  const briefs = quotes.length ? await fetchBriefs(quotes, predictByEvent, rawTape) : [];
  const publicSplits = splitsFromTape(quotes, rawTape);
  const tapeNote = publicSplits.length
    ? ` Ticket vs handle tape on ${publicSplits.length} game${publicSplits.length === 1 ? "" : "s"} (Action Network + line-move inference — not Hard Rock's own book).`
    : " No public ticket/handle tape on this pull.";
  const et = etParts();
  const upcoming = quotes
    .filter((q) => !q.inPlay && new Date(q.start).getTime() > Date.now())
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const nextLock = upcoming[0]?.start ?? null;
  const listed = [...new Set(quotes.map((q) => q.sport))];
  const labels = ALL_SPORTS.map((sport) => {
    const q = quotes.find((x) => x.sport === sport);
    if (!q) return sport;
    const when = new Date(q.start).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" });
    if (q.phase === "preseason") return `${sport} preseason ${when}`;
    return `${sport}`;
  });
  const live = quotes.length > 0;
  return {
    asOf,
    delayed: true,
    sample: false,
    hours: {
      preGameOpen: true,
      etStamp: et.etStamp,
      etDate: et.etDate,
      nextLock,
      label: nextLock
        ? `Next kickoff ${new Date(nextLock).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} ET`
        : live
          ? "No upcoming kickoff on the live board"
          : "Live schedule unavailable",
      note: live
        ? `Live ESPN schedule for every league we cover: ${labels.join(" · ")}. Odds, ESPN model, Kalshi + Polymarket, records, pitchers, rest, injuries, ticket count vs handle. NBA, NHL, and college basketball stay on the board even before books post a number — photograph Hard Rock Bet Florida when they do. Confirm at ${BRAND.venueLive}.`
        : "Could not load the live ESPN schedule. Photograph a Hard Rock screen so we still have real games.",
    },
    quotes,
    news: [],
    publicSplits,
    briefs,
    predict,
    sourceNote: live
      ? `Live ESPN games (${listed.join(", ")}) as of ${asOf}.${notes.length ? ` ${notes.join("; ")}.` : ""}${tapeNote} Prediction markets are research, not a Hard Rock fill. Not a lock.`
      : "Live ESPN schedule failed to load. No invented games.",
  };
}







