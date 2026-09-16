/**
 * ESPN research + ticket matching. Live looks, not generated cards.
 */
import { americanToImplied, americanToDecimal, product, twoWayNoVig, valueScore } from "./engine.ts";
import { isTodayEt } from "../utils.ts";
import { buildChance, parseEra, parseWhip, type ChanceInput, type ChanceReport, type FormGame } from "./chance.ts";
import { buildPropChance, parsePropSelection, propContextFromBrief, teamWinForPlayer, type PropReport } from "./props.ts";
import { analyzeScores, ewmaMean, formatScoreLine, mergeForm, parseEspnScore, type FormTape, type ScoreGame } from "./form.ts";
import { fetchTeamLooks, type TeamLooks } from "./looks.ts";
import { sgpHaircut } from "./parlays.ts";
import { shownCombinedChance } from "./calibrate.ts";
import { formatChancePct } from "../copy.ts";
import type { DeskSnapshot, EventBrief, MarketType, ParsedTicket, PredictQuote, QuoteLine, ScanRow } from "./types.ts";

export type InjuryRow = { team: string; player: string; status: string; detail: string };
export type LastFive = { team: string; line: string; results: string[]; games?: FormGame[]; seasonGames?: FormGame[] };
export type PitcherRow = { team: string; name: string; line: string; hand?: "L" | "R"; athleteId?: string };
export type Headline = { title: string; whyKept?: string };

export type ResearchPlayer = {
  id: string;
  name: string;
  team: string;
  homeAway: "home" | "away";
  position: string;
  headshot?: string;
  starter?: boolean;
  stats: Record<string, number>;
  recentStats?: Record<string, number>;
  recentN?: number;
  usageMin?: number;
  vsOppStats?: Record<string, number>;
};

export type EventResearch = {
  eventId: string;
  sport: string;
  espnId: string;
  home: string;
  away: string;
  start?: string;
  venue?: string;
  city?: string;
  weather?: string;
  weatherTemp?: number;
  weatherWind?: number;
  weatherPrecip?: number;
  homeRecord?: string;
  awayRecord?: string;
  homeSplit?: string;
  awaySplit?: string;
  espnHomeWin?: number;
  espnAwayWin?: number;
  bookHomeWin?: number;
  openHomeWin?: number;
  kalshiHomeWin?: number;
  polyHomeWin?: number;
  homeWins?: number;
  homeLosses?: number;
  awayWins?: number;
  awayLosses?: number;
  homeEra?: number;
  awayEra?: number;
  homeWhip?: number;
  awayWhip?: number;
  homeOuts?: number;
  awayOuts?: number;
  homeQuestionable?: number;
  awayQuestionable?: number;
  homePf?: number;
  homePa?: number;
  awayPf?: number;
  awayPa?: number;
  homeSpread?: number;
  total?: number;
  series?: string;
  seriesHomeWins?: number;
  seriesAwayWins?: number;
  homeRestDays?: number;
  awayRestDays?: number;
  pitchers: PitcherRow[];
  lastFive: LastFive[];
  injuries: InjuryRow[];
  headlines: Headline[];
  players: ResearchPlayer[];
  homeTeamId?: string;
  awayTeamId?: string;
  homeAbbr?: string;
  awayAbbr?: string;
  homeLooks?: TeamLooks;
  awayLooks?: TeamLooks;
  homePitcherHand?: "L" | "R";
  awayPitcherHand?: "L" | "R";
  note: string;
};

export type ParlayPick = {
  key: string;
  eventId: string;
  sport: string;
  start: string;
  home: string;
  away: string;
  marketType: MarketType;
  side: string;
  selection: string;
  price: number;
  fairProb: number;
  point?: number;
  player?: string;
  propReport?: PropReport;
};

export type ParlayGrade = {
  legs: ParlayPick[];
  combinedFair: number;
  combinedImplied: number;
  decimalPayout: number;
  profitOn100: number;
  independent: boolean;
  longshot: boolean;
  entertainment: boolean;
  headline: string;
  because: string;
  correlation?: "shared-latent" | "near-independent" | "fallback-haircut";
};

export function blendHomeWin(opts: { oddsHome?: number; espnHome?: number; bookHome?: number }): { home: number; sources: string[] } | null {
  const report = buildChance({
    home: "Home",
    away: "Away",
    sport: "NFL",
    oddsHome: opts.oddsHome,
    espnHome: opts.espnHome,
    bookHome: opts.bookHome,
  });
  if (!report) return null;
  return { home: report.home, sources: report.layers.map((l) => l.label) };
}

export function formNudge(lastFive: LastFive[], home: string, away: string): number {
  const read = (team: string) => {
    const block = lastFive.find((b) => b.team.toLowerCase() === team.toLowerCase());
    return analyzeScores(block?.games ?? [], 10)?.wp ?? null;
  };
  const h = read(home);
  const a = read(away);
  if (h == null || a == null) return 0;
  return (h - a) * 0.04;
}

// @ts-nocheck — restored from live desk, then typed at the edges
export const ESPN_PATH = {
	NFL: "football/nfl",
	NCAAF: "football/college-football",
	MLB: "baseball/mlb",
	NBA: "basketball/nba",
	NHL: "hockey/nhl",
	NCAAB: "basketball/mens-college-basketball"
};
export function parseInternalEventId(eventId) {
	const m = /^espn-([A-Z0-9]+)-(.+)$/.exec(eventId);
	if (!m) return null;
	return {
		sport: m[1],
		espnId: m[2]
	};
}
export function normName(s) {
	return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
/** Distinctive team tokens. Never city-only ("Los Angeles") so Dodgers cannot match Angels. */
export function teamTokens(displayName, abbreviation) {
	const n = normName(displayName);
	const parts = n.split(" ").filter(Boolean);
	const out = new Set();
	if (n) out.add(n);
	if (abbreviation) out.add(normName(abbreviation));
	const lastTwo = parts.slice(-2).join(" ");
	if (lastTwo && parts.length >= 2) out.add(lastTwo);
	const last = parts[parts.length - 1];
	if (last && last.length >= 4 && last !== "city") out.add(last);
	return [...out];
}
export function headlineBelongsToGame(article, home, away, espnId, homeAbbr, awayAbbr) {
	const title = article.headline?.trim();
	if (!title) return false;
	const cats = article.categories ?? [];
	const teamCats = cats.filter((c) => c.type === "team");
	const eventCats = cats.filter((c) => c.type === "event");
	if (espnId && eventCats.some((c) => String(c.eventId) === String(espnId))) return true;
	const ours = new Set([...teamTokens(home, homeAbbr), ...teamTokens(away, awayAbbr)]);
	const tagged = teamCats.map((c) => normName(c.team?.description || c.description || "")).filter(Boolean);
	const uniqueTeams = [...new Set(tagged)];
	if (uniqueTeams.length >= 6) return false;
	if (uniqueTeams.length) return uniqueTeams.some((t) => ours.has(t) || [...ours].some((o) => t === o || t.endsWith(" " + o) || o.endsWith(" " + t)));
	const hay = ` ${normName(title)} `;
	if (![...ours].some((tok) => tok.length >= 4 && hay.includes(` ${tok} `))) return false;
	return true;
}
export function chanceFromGame(rows, brief, extra) {
	return buildChance(assembleChanceInput({
		rows,
		brief,
		extra,
		home: extra?.home,
		away: extra?.away
	}));
}
export function assembleChanceInput(opts) {
	const rows = opts.rows ?? [];
	const mls = rows.filter((r) => r.marketType === "ml");
	const homeRow = mls.find((r) => r.side === "home");
	const awayRow = mls.find((r) => r.side === "away");
	const spreadHome = rows.find((r) => r.marketType === "spread" && r.side === "home");
	const totalRow = rows.find((r) => r.marketType === "total");
	const r = opts.research;
	const b = opts.brief;
	const p = opts.predict;
	const x = opts.extra ?? {};
	const home = x.home || opts.home || r?.home || homeRow?.home || awayRow?.home || "";
	const away = x.away || opts.away || r?.away || homeRow?.away || awayRow?.away || "";
	const oddsHome = homeRow?.scheduleOnly ? undefined : homeRow?.fairProb ?? (awayRow ? 1 - awayRow.fairProb : undefined);
	let openHome = x.openHome ?? b?.openHomeWin ?? r?.openHomeWin;
	if (openHome == null && homeRow?.openPrice != null && awayRow?.openPrice != null) {
		const nv = twoWayNoVig(homeRow.openPrice, awayRow.openPrice);
		if (Number.isFinite(nv.fairHome)) openHome = nv.fairHome;
	}
	const pitcherLineHome = homeRow?.homePitcher ?? awayRow?.homePitcher;
	const pitcherLineAway = homeRow?.awayPitcher ?? awayRow?.awayPitcher;
	return {
		home,
		away,
		sport: homeRow?.sport ?? awayRow?.sport ?? r?.sport ?? "NFL",
		start: homeRow?.start ?? awayRow?.start ?? r?.start,
		oddsHome: x.oddsHome ?? oddsHome,
		bookHome: x.bookHome ?? r?.bookHomeWin ?? b?.bookHomeWin,
		openHome,
		espnHome: x.espnHome ?? r?.espnHomeWin ?? b?.espnHomeWin,
		kalshiHome: x.kalshiHome ?? p?.kalshiHome ?? r?.kalshiHomeWin ?? b?.kalshiHomeWin,
		kalshiVolume: x.kalshiVolume ?? p?.kalshiVolume ?? b?.kalshiVolume,
		kalshiSpread: x.kalshiSpread ?? p?.kalshiSpread ?? b?.kalshiSpread,
		polyHome: x.polyHome ?? p?.polyHome ?? r?.polyHomeWin ?? b?.polyHomeWin,
		polyVolume: x.polyVolume ?? p?.polyVolume ?? b?.polyVolume,
		homeSpread: x.homeSpread ?? r?.homeSpread ?? b?.homeSpread ?? spreadHome?.point ?? homeRow?.homeSpread ?? awayRow?.homeSpread,
		total: x.total ?? r?.total ?? b?.total ?? totalRow?.point ?? homeRow?.total ?? awayRow?.total,
		homeRecord: x.homeRecord ?? r?.homeRecord ?? b?.homeRecord ?? homeRow?.homeRecord ?? awayRow?.homeRecord,
		awayRecord: x.awayRecord ?? r?.awayRecord ?? b?.awayRecord ?? homeRow?.awayRecord ?? awayRow?.awayRecord,
		homeSplit: x.homeSplit ?? r?.homeSplit ?? b?.homeSplit,
		awaySplit: x.awaySplit ?? r?.awaySplit ?? b?.awaySplit,
		homeEra: x.homeEra ?? r?.homeEra ?? b?.homeEra ?? parseEra(pitcherLineHome),
		awayEra: x.awayEra ?? r?.awayEra ?? b?.awayEra ?? parseEra(pitcherLineAway),
		homeWhip: x.homeWhip ?? r?.homeWhip ?? b?.homeWhip ?? parseWhip(pitcherLineHome),
		awayWhip: x.awayWhip ?? r?.awayWhip ?? b?.awayWhip ?? parseWhip(pitcherLineAway),
		homeOuts: x.homeOuts ?? r?.homeOuts ?? b?.homeOuts,
		awayOuts: x.awayOuts ?? r?.awayOuts ?? b?.awayOuts,
		homeQuestionable: x.homeQuestionable ?? r?.homeQuestionable ?? b?.homeQuestionable,
		awayQuestionable: x.awayQuestionable ?? r?.awayQuestionable ?? b?.awayQuestionable,
		homePf: x.homePf ?? r?.homePf ?? b?.homePf,
		homePa: x.homePa ?? r?.homePa ?? b?.homePa,
		awayPf: x.awayPf ?? r?.awayPf ?? b?.awayPf,
		awayPa: x.awayPa ?? r?.awayPa ?? b?.awayPa,
		weatherTemp: x.weatherTemp ?? r?.weatherTemp ?? b?.weatherTemp,
		weatherWind: x.weatherWind ?? r?.weatherWind ?? b?.weatherWind,
		weatherPrecip: x.weatherPrecip ?? r?.weatherPrecip ?? b?.weatherPrecip,
		venue: x.venue ?? r?.venue ?? b?.venue,
		seriesHomeWins: x.seriesHomeWins ?? r?.seriesHomeWins ?? b?.seriesHomeWins,
		seriesAwayWins: x.seriesAwayWins ?? r?.seriesAwayWins ?? b?.seriesAwayWins,
		homeRestDays: x.homeRestDays ?? r?.homeRestDays ?? b?.homeRestDays,
		awayRestDays: x.awayRestDays ?? r?.awayRestDays ?? b?.awayRestDays,
		ticketHome: x.ticketHome ?? b?.ticketHome ?? homeRow?.ticketPct,
		handleHome: x.handleHome ?? b?.handleHome ?? homeRow?.handlePct,
		lastFive: x.lastFive ?? r?.lastFive ?? b?.form,
		homeLooks: x.homeLooks ?? r?.homeLooks ?? b?.homeLooks,
		awayLooks: x.awayLooks ?? r?.awayLooks ?? b?.awayLooks,
		homePitcherHand: x.homePitcherHand ?? r?.homePitcherHand ?? b?.homePitcherHand,
		awayPitcherHand: x.awayPitcherHand ?? r?.awayPitcherHand ?? b?.awayPitcherHand,
		steam: x.steam ?? b?.steam ?? homeRow?.tapeLean === "sharp"
	};
}
export function researchedFavorite(rows, brief, extra) {
	const report = chanceFromGame(rows, brief, extra);
	if (!report) return null;
	return {
		side: report.favorite,
		name: report.favoriteName,
		chance: report.chance,
		homeChance: report.home,
		report
	};
}
export function predictFor(predict, eventId) {
	return predict?.find((p) => p.eventId === eventId);
}
export function uniqueUpcomingGames(rows: ScanRow[]): ScanRow[] {
	const now = Date.now();
	const horizon = now + 36 * 3600_000;
	const recentlyStarted = now - 6 * 3600_000;
	const rank = (r: ScanRow) =>
		r.marketType === "ml" ? 3 : r.marketType === "spread" ? 2 : r.marketType === "total" ? 1 : 0;
	const map = new Map<string, ScanRow>();
	for (const r of rows) {
		if (r.tag === "illegal_fl") continue;
		const t = new Date(r.start).getTime();
		const upcoming = Number.isFinite(t) && t >= recentlyStarted && t <= horizon;
		if (!upcoming && !r.inPlay && !isTodayEt(r.start)) continue;
		const cur = map.get(r.eventId);
		if (!cur || rank(r) > rank(cur) || (rank(r) === rank(cur) && (r.fairProb ?? 0) > (cur.fairProb ?? 0))) {
			map.set(r.eventId, r);
		}
	}
	return [...map.values()];
}
export function sortByResearchedChance(games, allRows, briefs, kalshiByEvent) {
	const predictList = Array.isArray(kalshiByEvent) ? kalshiByEvent : undefined;
	const kalshiOnly = kalshiByEvent instanceof Map ? kalshiByEvent : undefined;
	const scoreOf = (g) => {
		const rows = allRows.filter((r) => r.eventId === g.eventId);
		const brief = briefs?.find((x) => x.eventId === g.eventId);
		const pred = predictList ? predictFor(predictList, g.eventId) : undefined;
		const fav = researchedFavorite(rows, brief, {
			home: g.home,
			away: g.away,
			kalshiHome: pred?.kalshiHome ?? kalshiOnly?.get(g.eventId) ?? brief?.kalshiHomeWin,
			polyHome: pred?.polyHome ?? brief?.polyHomeWin,
			kalshiVolume: pred?.kalshiVolume ?? brief?.kalshiVolume,
			polyVolume: pred?.polyVolume ?? brief?.polyVolume,
			kalshiSpread: pred?.kalshiSpread ?? brief?.kalshiSpread,
			homeSpread: g.homeSpread ?? brief?.homeSpread,
			total: g.total ?? brief?.total,
			openHome: brief?.openHomeWin
		});
		return valueScore(fav?.chance ?? Math.max(g.fairProb, 1 - g.fairProb), ((fav ? rows.find((r) => r.marketType === "ml" && r.side === fav.side) : undefined) ?? rows.find((r) => r.marketType === "ml" && r.side === g.side) ?? g).price);
	};
	return [...games].sort((a, b) => {
		const d = scoreOf(b) - scoreOf(a);
		if (Math.abs(d) > .002) return d;
		const todayA = isTodayEt(a.start) ? 1 : 0;
		const todayB = isTodayEt(b.start) ? 1 : 0;
		if (todayB !== todayA) return todayB - todayA;
		return +new Date(a.start) - +new Date(b.start);
	});
}
export function parseAmericanLoose(raw) {
	if (raw == null || raw === "") return undefined;
	const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[^0-9.+-]/g, ""));
	return Number.isFinite(n) && n !== 0 ? n : undefined;
}
export function pickcenterHomeWin(raw) {
	if (!Array.isArray(raw) || !raw[0] || typeof raw[0] !== "object") return undefined;
	const pc = raw[0];
	const home = pc.homeTeamOdds?.moneyLine ?? parseAmericanLoose(pc.moneyline?.home?.close?.odds);
	const away = pc.awayTeamOdds?.moneyLine ?? parseAmericanLoose(pc.moneyline?.away?.close?.odds);
	if (home == null || away == null) return undefined;
	return twoWayNoVig(home, away).fairHome;
}
export function pickKey(p) {
	return `${p.eventId}:${p.marketType}:${p.side}:${p.player ?? ""}:${p.point ?? ""}:${p.selection ?? ""}`;
}
export function num(raw) {
	const n = typeof raw === "number" ? raw : Number(raw);
	return Number.isFinite(n) ? n : undefined;
}
export function recSummary(records, type) {
	if (!Array.isArray(records)) return undefined;
	const hit = records.find((r) => {
		if (!r || typeof r !== "object") return false;
		const row = r;
		return row.type === type || row.name?.toLowerCase() === type;
	});
	return hit?.summary || hit?.displayValue;
}
export function pitcherLine(probables, team) {
	if (!Array.isArray(probables) || !probables[0] || typeof probables[0] !== "object") return null;
	const p = probables[0];
	const name = p.athlete?.displayName || p.athlete?.fullName;
	if (!name) return null;
	const cats = Array.isArray(p.statistics) ? p.statistics : p.statistics?.splits?.categories ?? [];
	const grab = (abbr, nameKey) => cats.find((c) => c.abbreviation === abbr || c.name === nameKey)?.displayValue;
	const bits = [
		grab("W", "wins") && grab("L", "losses") ? `${grab("W")}-${grab("L")}` : null,
		grab("ERA") ? `ERA ${grab("ERA")}` : null,
		grab("WHIP") ? `WHIP ${grab("WHIP")}` : null
	].filter(Boolean);
	return {
		team,
		name,
		line: bits.length ? `${name} · ${bits.join(" · ")}` : name,
		hand: pitcherHandOf(probables),
		athleteId: p.athlete?.id || p.playerId
	};
}
export function pitcherHandOf(probables) {
	if (!Array.isArray(probables) || !probables[0] || typeof probables[0] !== "object") return undefined;
	const a = probables[0].athlete || {};
	const throws = a.throws;
	const raw =
		(throws && typeof throws === "object" ? throws.abbreviation || throws.type : throws) ||
		a.hand?.abbreviation ||
		a.hand ||
		a.bats;
	const s = String(raw || "").toUpperCase();
	if (s.startsWith("L")) return "L";
	if (s.startsWith("R")) return "R";
	return undefined;
}
export function pitcherStats(probables) {
	if (!Array.isArray(probables) || !probables[0] || typeof probables[0] !== "object") return {};
	const p = probables[0];
	const cats = Array.isArray(p.statistics) ? p.statistics : p.statistics?.splits?.categories ?? [];
	const grab = (abbr) => {
		const hit = cats.find((c) => c.abbreviation === abbr || c.name === abbr);
		const n = hit?.value ?? (hit?.displayValue ? Number(hit.displayValue) : NaN);
		return Number.isFinite(n) ? n : undefined;
	};
	return {
		era: grab("ERA"),
		whip: grab("WHIP")
	};
}
export function headshotOf(raw) {
	if (!raw) return undefined;
	if (typeof raw === "string") return raw;
	if (typeof raw === "object" && raw && "href" in raw && typeof raw.href === "string") return raw.href;
}
export function statsFromCats(cats) {
	const out = {};
	if (!cats?.length) return out;
	for (const c of cats) {
		const n = c.value ?? (c.displayValue ? Number(String(c.displayValue).replace(/[^0-9.+-]/g, "")) : NaN);
		if (!Number.isFinite(n)) continue;
		const key = (c.abbreviation || c.name || "").toLowerCase();
		if (!key) continue;
		out[key] = n;
		const name = (c.name || "").toLowerCase();
		if (key === "avg" || name === "avg" || name === "batting average") out.avg = n;
		if (name.includes("slug") || key === "slg" || key === "slugavg") out.slg = n;
		if (name.includes("on base") || key === "obp" || key === "onbasepct") out.obp = n;
		if (name === "home runs" || key === "hr" || key === "homeruns") out.hr = n;
		if (key === "rbi" || key === "rbis") out.rbi = n;
		if (key === "k" || key === "strikeouts" || name === "strikeouts") out.k = n;
		if (key === "era") out.era = n;
		if (key === "whip") out.whip = n;
		if (key === "fi" || key === "ip" || name.includes("inning")) out.ip = n;
		if (key === "h" && name === "hits" || key === "hits" || name === "hits") out.hits = n;
		if (key === "sb" || name.includes("stolen")) out.sb = n;
		if (key === "r" && name === "runs" || name === "runs") out.runs = n;
		if (key === "yds" || key === "yards" || name.includes("yards")) {
			if (name.includes("pass")) out.passYds = n;
			else if (name.includes("rush")) out.rushYds = n;
			else if (name.includes("receiv")) out.recYds = n;
			else out.yds = n;
		}
		if (key === "pts" || name === "points" || name === "pointspergame") out.pts = n;
		if (key === "reb" || name.includes("rebound")) out.reb = n;
		if (key === "ast" || name.includes("assist")) out.ast = n;
		if (key === "sog" || name.includes("shots")) out.sog = n;
		if (key === "g" && name.includes("goal") || name === "goals") out.goals = n;
		if (key === "sv" || name.includes("save")) out.saves = n;
		if (name.includes("3point") || name.includes("three")) out.threes = n;
	}
	return out;
}
export function playerFromAthlete(ath, team, homeAway, extra) {
	const name = ath.displayName || ath.fullName;
	if (!name) return null;
	const pos = ath.position?.abbreviation || ath.position?.displayName || "";
	return {
		id: String(ath.id || name),
		name,
		team,
		homeAway,
		position: pos,
		headshot: headshotOf(ath.headshot),
		starter: extra?.starter,
		stats: extra?.stats ?? {}
	};
}
export function leaderStats(catName, row) {
	const extra = statsFromCats(row.statistics);
	const cname = (catName || "").toLowerCase();
	const val = typeof row.value === "number" && Number.isFinite(row.value) ? row.value : Number(String(row.displayValue ?? "").replace(/[^0-9.+-]/g, ""));
	if (Number.isFinite(val)) {
		if (cname === "avg") extra.avg = val;
		if (cname === "homeruns" || cname === "home runs") extra.hr = val;
		if (cname === "rbis" || cname === "rbi") extra.rbi = val;
		if (cname === "era") extra.era = val;
		if (cname === "strikeouts") extra.k = val;
		if (cname === "points") extra.pts = val;
		if (cname.includes("pass") && cname.includes("yard")) extra.passYds = val;
		if (cname.includes("rush") && cname.includes("yard")) extra.rushYds = val;
		if (cname.includes("receiv") && cname.includes("yard")) extra.recYds = val;
		if (cname.includes("shot")) extra.sog = val;
	}
	return extra;
}
export function collectSummaryPlayers(d, home, away, homeC, awayC) {
	const byId = new Map();
	const put = (p) => {
		if (!p) return;
		const prev = byId.get(p.id);
		if (!prev) {
			byId.set(p.id, p);
			return;
		}
		byId.set(p.id, {
			...prev,
			...p,
			headshot: p.headshot || prev.headshot,
			starter: p.starter || prev.starter,
			stats: {
				...prev.stats,
				...p.stats
			}
		});
	};
	const leaders = Array.isArray(d.leaders) ? d.leaders : [];
	for (const block of leaders) {
		const teamName = block.team?.displayName ?? "";
		const homeAway = namesHit(teamName, home) ? "home" : "away";
		for (const cat of block.leaders ?? []) for (const row of cat.leaders ?? []) {
			if (!row.athlete) continue;
			put(playerFromAthlete(row.athlete, teamName || (homeAway === "home" ? home : away), homeAway, {
				starter: true,
				stats: leaderStats(cat.name, row)
			}));
		}
	}
	const takeProbables = (c, team, homeAway) => {
		const list = c?.probables;
		if (!Array.isArray(list)) return;
		for (const p of list) {
			if (!p.athlete) continue;
			const cats = p.statistics?.splits?.categories;
			put(playerFromAthlete(p.athlete, team, homeAway, {
				starter: true,
				stats: statsFromCats(cats)
			}));
		}
	};
	takeProbables(homeC, home, "home");
	takeProbables(awayC, away, "away");
	return [...byId.values()];
}
export function mergeResearchPlayers(into, extra) {
	const byId = new Map();
	for (const p of [...into, ...extra]) {
		const prev = byId.get(p.id);
		if (!prev) {
			byId.set(p.id, p);
			continue;
		}
		byId.set(p.id, {
			...prev,
			...p,
			headshot: p.headshot || prev.headshot,
			starter: Boolean(prev.starter || p.starter),
			stats: {
				...prev.stats,
				...p.stats
			}
		});
	}
	return [...byId.values()];
}
export function rosterGroupPos(g) {
	const p = g.position;
	if (!p) return "";
	if (typeof p === "string") return {
		Pitchers: "P",
		Catchers: "C",
		Infielders: "IF",
		Outfielders: "OF",
		"Designated Hitter": "DH",
		Quarterbacks: "QB",
		"Running Backs": "RB",
		"Wide Receivers": "WR",
		"Tight Ends": "TE",
		Goalies: "G",
		Forwards: "F",
		Defensemen: "D",
		Centers: "C",
		Guards: "G"
	}[p] || p.slice(0, 2).toUpperCase();
	return p.abbreviation || p.name || "";
}
export async function fetchEspnRoster(path, teamId, teamName, homeAway) {
	if (!teamId) return [];
	try {
		const res = await fetch(`https://site.web.api.espn.com/apis/site/v2/sports/${path}/teams/${encodeURIComponent(teamId)}/roster`, {
			headers: {
				"User-Agent": "Mozilla/5.0 (compatible; SportsLock/1.0)",
				Accept: "application/json"
			},
			signal: AbortSignal.timeout(8_000)
		});
		if (!res.ok) return [];
		const json = await res.json();
		const out = [];
		for (const g of json.athletes ?? []) {
			const groupPos = rosterGroupPos(g);
			for (const item of g.items ?? []) {
				const status = item.status?.type || item.status?.name || "";
				if (/injured|inactive|reserve/i.test(status) && !/active/i.test(status)) continue;
				const pos = item.position?.abbreviation || groupPos || item.position?.parent?.abbreviation || "";
				const p = playerFromAthlete({
					id: item.id,
					displayName: item.displayName,
					fullName: item.fullName,
					headshot: item.headshot,
					position: { abbreviation: pos }
				}, teamName, homeAway);
				if (p) out.push(p);
			}
		}
		return out;
	} catch {
		return [];
	}
}
const CORE_LEAGUE = {
	MLB: {
		sport: "baseball",
		league: "mlb"
	},
	NFL: {
		sport: "football",
		league: "nfl"
	},
	NBA: {
		sport: "basketball",
		league: "nba"
	},
	NHL: {
		sport: "hockey",
		league: "nhl"
	}
};
const LEADER_STAT = {
	avg: "avg",
	homeruns: "hr",
	rbis: "rbi",
	runs: "runs",
	hits: "hits",
	stolenbases: "sb",
	onbasepct: "obp",
	slugavg: "slg",
	ops: "ops",
	strikeouts: "k",
	era: "era",
	whip: "whip",
	innings: "ip",
	passingyards: "passYds",
	rushingyards: "rushYds",
	receivingyards: "recYds",
	receptions: "rec",
	passingtouchdowns: "passTd",
	points: "pts",
	pointspergame: "pts",
	rebounds: "reb",
	reboundspergame: "reb",
	assists: "ast",
	assistspergame: "ast",
	"3pointmadepergame": "threes",
	goals: "goals",
	saves: "saves",
	shots: "sog"
};
export function athleteIdFromRef(ref) {
	if (!ref) return undefined;
	return /\/athletes\/(\d+)/.exec(ref)?.[1];
}
/** Pull per-player season stats out of an ESPN core team-leaders payload. */
export function leaderStatsFromCore(raw) {
	const out = new Map();
	const cats = raw && typeof raw === "object" ? raw.categories : null;
	if (!Array.isArray(cats)) return out;
	for (const cat of cats) {
		if (!cat || typeof cat !== "object") continue;
		const c = cat;
		const key = LEADER_STAT[(c.name || "").toLowerCase()] ?? LEADER_STAT[(c.abbreviation || "").toLowerCase()];
		if (!key || !Array.isArray(c.leaders)) continue;
		for (const row of c.leaders) {
			if (!row || typeof row !== "object") continue;
			const r = row;
			const id = athleteIdFromRef(r.athlete?.$ref);
			const n = typeof r.value === "number" && Number.isFinite(r.value) ? r.value : Number(String(r.displayValue ?? "").replace(/[^0-9.+-]/g, ""));
			if (!id || !Number.isFinite(n)) continue;
			const prev = out.get(id) ?? {};
			prev[key] = n;
			out.set(id, prev);
		}
	}
	return out;
}
export async function fetchEspnTeamLeaders(sport, teamId) {
	const spec = CORE_LEAGUE[sport];
	if (!spec || !teamId) return new Map();
	const year = (new Date()).getFullYear();
	for (const y of [year, year - 1]) try {
		const res = await fetch(`https://sports.core.api.espn.com/v2/sports/${spec.sport}/leagues/${spec.league}/seasons/${y}/types/2/teams/${encodeURIComponent(teamId)}/leaders`, {
			headers: {
				"User-Agent": "Mozilla/5.0 (compatible; SportsLock/1.0)",
				Accept: "application/json"
			},
			signal: AbortSignal.timeout(8_000)
		});
		if (!res.ok) continue;
		const bag = leaderStatsFromCore(await res.json());
		if (bag.size) return bag;
	} catch {}
	return new Map();
}
export function applyLeaderStats(players, bags) {
	if (!bags.length) return players;
	const all = new Map();
	for (const bag of bags) for (const [id, st] of bag) all.set(id, {
		...all.get(id) ?? {},
		...st
	});
	if (!all.size) return players;
	return players.map((p) => {
		const extra = all.get(p.id);
		if (!extra) return p;
		return {
			...p,
			stats: {
				...extra,
				...p.stats
			}
		};
	});
}
export function isOutStatus(status) {
	return /out|injured reserve|\bil\b|10-day|15-day|60-day|inactive|doubtful/i.test(status);
}
export function isQuestionableStatus(status) {
	return /questionable|game time|gtd/i.test(status) && !isOutStatus(status);
}
export function standingsPoints(raw, teamName) {
	const st = raw && typeof raw === "object" ? raw : null;
	if (!st?.groups) return {};
	const needle = teamName.split(" ").pop()?.toLowerCase() ?? "";
	for (const g of st.groups) for (const e of g.standings?.entries ?? []) {
		const t = (e.team ?? "").toLowerCase();
		if (!t || needle && !t.includes(needle) && !teamName.toLowerCase().includes(t)) continue;
		const pf = e.stats?.find((s) => s.abbreviation === "PF")?.value;
		const pa = e.stats?.find((s) => s.abbreviation === "PA")?.value;
		return {
			pf: Number.isFinite(pf) ? pf : undefined,
			pa: Number.isFinite(pa) ? pa : undefined
		};
	}
	return {};
}
export function pickcenterExtras(raw) {
	if (!Array.isArray(raw) || !raw[0] || typeof raw[0] !== "object") return {};
	const pc = raw[0];
	const home = pc.homeTeamOdds?.moneyLine ?? parseAmericanLoose(pc.moneyline?.home?.close?.odds);
	const away = pc.awayTeamOdds?.moneyLine ?? parseAmericanLoose(pc.moneyline?.away?.close?.odds);
	const openH = parseAmericanLoose(pc.moneyline?.home?.open?.odds);
	const openA = parseAmericanLoose(pc.moneyline?.away?.open?.odds);
	const bookHome = home != null && away != null ? twoWayNoVig(home, away).fairHome : undefined;
	const openHome = openH != null && openA != null ? twoWayNoVig(openH, openA).fairHome : undefined;
	const spreadLine = pc.pointSpread?.home?.close?.line;
	const parsedSpread = spreadLine != null ? Number(String(spreadLine).replace(/[^0-9.+-]/g, "")) : undefined;
	const homeSpread = parsedSpread != null && Number.isFinite(parsedSpread) ? parsedSpread : pc.spread;
	const totRaw = pc.total?.over?.close?.line ?? pc.overUnder;
	const total = totRaw != null ? Number(String(totRaw).replace(/[ouOU]/g, "")) : undefined;
	return {
		bookHome: bookHome != null && Number.isFinite(bookHome) ? bookHome : undefined,
		openHome: openHome != null && Number.isFinite(openHome) ? openHome : undefined,
		homeSpread: homeSpread != null && Number.isFinite(homeSpread) ? homeSpread : undefined,
		total: total != null && Number.isFinite(total) ? total : undefined
	};
}
export function seriesWins(raw, home, away) {
	if (!Array.isArray(raw) || !raw[0] || typeof raw[0] !== "object") return undefined;
	const events = (raw.find((s) => s.type === "current") ?? raw[0]).events;
	if (!Array.isArray(events)) return undefined;
	let h = 0;
	let a = 0;
	for (const ev of events) {
		if (ev.status && ev.status !== "post") continue;
		for (const c of ev.competitors ?? []) {
			if (!c.winner) continue;
			const n = (c.team?.displayName ?? "").toLowerCase();
			if (n && home.toLowerCase().includes(n.split(" ").pop() ?? n)) h += 1;
			else if (n && away.toLowerCase().includes(n.split(" ").pop() ?? n)) a += 1;
		}
	}
	if (h + a === 0) return undefined;
	return {
		home: h,
		away: a
	};
}
export function restFrom(block, start) {
	const dates = (block?.games ?? []).map((g) => g.date).filter((d) => Boolean(d));
	if (!dates.length || !start) return undefined;
	const last = dates.map((d) => new Date(d).getTime()).filter((t) => Number.isFinite(t)).sort((a, b) => b - a)[0];
	const startMs = new Date(start).getTime();
	if (last == null || !Number.isFinite(startMs)) return undefined;
	const days = (startMs - last) / 86400_000;
	if (days < .15 || days > 21) return undefined;
	return days;
}
export function parseEspnSummary(raw, eventId, sport, espnId) {
	const d = raw && typeof raw === "object" ? raw : {};
	const header = d.header && typeof d.header === "object" ? d.header : {};
	const comps = header.competitions?.[0]?.competitors ?? [];
	const homeC = comps.find((c) => c.homeAway === "home");
	const awayC = comps.find((c) => c.homeAway === "away");
	const teamName = (c) => {
		return (c?.team)?.displayName ?? "";
	};
	const teamAbbr = (c) => {
		return (c?.team)?.abbreviation;
	};
	const home = teamName(homeC);
	const away = teamName(awayC);
	const homeAbbr = teamAbbr(homeC);
	const awayAbbr = teamAbbr(awayC);
	const pred = d.predictor;
	const espnHomeWin = num(pred?.homeTeam?.gameProjection) != null ? num(pred?.homeTeam?.gameProjection) / 100 : undefined;
	const espnAwayWin = num(pred?.awayTeam?.gameProjection) != null ? num(pred?.awayTeam?.gameProjection) / 100 : undefined;
	const gameInfo = d.gameInfo && typeof d.gameInfo === "object" ? d.gameInfo : {};
	const wx = gameInfo.weather;
	const weather = wx && wx.temperature != null ? `${wx.temperature}°F${wx.precipitation != null ? ` · rain ${wx.precipitation}%` : ""}${wx.gust != null ? ` · wind ${wx.gust} mph` : ""}` : undefined;
	const seriesRaw = d.seasonseries;
	const series = Array.isArray(seriesRaw) ? seriesRaw[0]?.summary : undefined;
	const seriesWL = seriesWins(seriesRaw, home, away);
	const pc = pickcenterExtras(d.pickcenter);
	const lastFive = [];
	if (Array.isArray(d.lastFiveGames)) for (const block of d.lastFiveGames) {
		const team = block.team?.displayName ?? "";
		const events = (block.events ?? []).slice(0, 10);
		const results = events.map((e) => e.gameResult ?? "?");
		const games = events.map((e) => {
			const hs = parseEspnScore(e.homeTeamScore);
			const as = parseEspnScore(e.awayTeamScore);
			const road = e.atVs === "@";
			const pf = road ? as : hs;
			const pa = road ? hs : as;
			return {
				date: e.gameDate,
				result: e.gameResult ?? "?",
				pf,
				pa,
				opponent: e.opponent?.abbreviation,
				homeAway: e.atVs === "@" ? "away" : "home",
			};
		});
		const line = formatScoreLine(games) || events.map((e) => `${e.gameResult ?? "?"} ${e.score ?? ""} ${e.atVs ?? ""} ${e.opponent?.abbreviation ?? ""}`.trim()).join(" · ");
		lastFive.push({
			team,
			line,
			results,
			games
		});
	}
	const injuries = [];
	if (Array.isArray(d.injuries)) for (const block of d.injuries) {
		const team = block.team?.displayName ?? "";
		for (const inj of (block.injuries ?? []).slice(0, 8)) {
			const det = inj.details;
			const detail = [det?.type, det?.detail].filter((x) => x && x !== "Not Specified").join(" · ");
			injuries.push({
				team,
				player: inj.athlete?.displayName ?? "Player",
				status: inj.status ?? "Listed",
				detail
			});
		}
	}
	const headlines = [];
	const seen = new Set();
	const consider = (title, article) => {
		const t = title?.trim();
		if (!t || seen.has(t)) return;
		if (!headlineBelongsToGame(article ?? { headline: t }, home, away, espnId, homeAbbr, awayAbbr)) return;
		seen.add(t);
		headlines.push({ title: t });
	};
	const recap = d.article;
	if (recap?.headline) consider(recap.headline, recap);
	const arts = d.news?.articles ?? [];
	for (const a of arts) consider(a.headline, a);
	const pitchers = [];
	const hp = pitcherLine(homeC?.probables, home);
	const ap = pitcherLine(awayC?.probables, away);
	if (ap) pitchers.push(ap);
	if (hp) pitchers.push(hp);
	const homeP = pitcherStats(homeC?.probables);
	const awayP = pitcherStats(awayC?.probables);
	const homeRec = recSummary(homeC?.record ?? homeC?.records, "total");
	const awayRec = recSummary(awayC?.record ?? awayC?.records, "total");
	const parsedHome = /(\d+)\s*-\s*(\d+)/.exec(homeRec ?? "");
	const parsedAway = /(\d+)\s*-\s*(\d+)/.exec(awayRec ?? "");
	const homePts = standingsPoints(d.standings, home);
	const awayPts = standingsPoints(d.standings, away);
	const start = header.competitions?.[0]?.date;
	return {
		eventId,
		sport,
		espnId,
		home,
		away,
		start,
		venue: gameInfo.venue?.fullName,
		city: [gameInfo.venue?.address?.city, gameInfo.venue?.address?.state].filter(Boolean).join(", "),
		weather,
		weatherTemp: wx?.temperature,
		weatherWind: wx?.gust,
		weatherPrecip: wx?.precipitation,
		homeRecord: homeRec,
		awayRecord: awayRec,
		homeSplit: recSummary(homeC?.record ?? homeC?.records, "home"),
		awaySplit: recSummary(awayC?.record ?? awayC?.records, "road"),
		espnHomeWin,
		espnAwayWin,
		bookHomeWin: pc.bookHome ?? pickcenterHomeWin(d.pickcenter),
		openHomeWin: pc.openHome,
		homeWins: parsedHome ? Number(parsedHome[1]) : undefined,
		homeLosses: parsedHome ? Number(parsedHome[2]) : undefined,
		awayWins: parsedAway ? Number(parsedAway[1]) : undefined,
		awayLosses: parsedAway ? Number(parsedAway[2]) : undefined,
		homeEra: homeP.era,
		awayEra: awayP.era,
		homeWhip: homeP.whip,
		awayWhip: awayP.whip,
		homeOuts: injuries.filter((i) => i.team === home && isOutStatus(i.status)).length,
		awayOuts: injuries.filter((i) => i.team === away && isOutStatus(i.status)).length,
		homeQuestionable: injuries.filter((i) => i.team === home && isQuestionableStatus(i.status)).length,
		awayQuestionable: injuries.filter((i) => i.team === away && isQuestionableStatus(i.status)).length,
		homePf: homePts.pf,
		homePa: homePts.pa,
		awayPf: awayPts.pf,
		awayPa: awayPts.pa,
		homeSpread: pc.homeSpread,
		total: pc.total,
		series,
		seriesHomeWins: seriesWL?.home,
		seriesAwayWins: seriesWL?.away,
		homeRestDays: restFrom(lastFive.find((b) => b.team === home), start),
		awayRestDays: restFrom(lastFive.find((b) => b.team === away), start),
		pitchers,
		lastFive,
		injuries,
		headlines,
		players: collectSummaryPlayers(d, home, away, homeC, awayC),
		homeTeamId: (homeC?.team)?.id,
		awayTeamId: (awayC?.team)?.id,
		homeAbbr,
		awayAbbr,
		homePitcherHand: pitcherHandOf(homeC?.probables),
		awayPitcherHand: pitcherHandOf(awayC?.probables),
		note: "Ensemble of sportsbook, Kalshi/Polymarket, ESPN's model, records, pitchers, form, rest, and injuries. Research, not a promise. Confirm the live Hard Rock Bet number before you bet."
	};
}
export function chanceWords(p) {
	if (!Number.isFinite(p)) return "unknown";
	const n = Math.round(p * 100);
	if (n >= 70) return `a clear favorite (~${n} in 100)`;
	if (n >= 57) return `more likely than not (~${n} in 100)`;
	if (n >= 47) return `a coin flip (~${n} in 100)`;
	if (n >= 35) return `the underdog (~${n} in 100)`;
	return `a long shot (~${n} in 100)`;
}
export function leanEnglish(opts) {
	const { home, away, oddsHome, espnHome, ensembleHome, crowdHome } = opts;
	const parts = [];
	if (oddsHome != null) parts.push(`the live sportsbook (cut removed) says ${home} is ${chanceWords(oddsHome)}`);
	if (crowdHome != null) parts.push(`prediction markets (Kalshi / Polymarket) give ${home} ${Math.round(crowdHome * 100)} in 100`);
	if (espnHome != null) parts.push(`ESPN's matchup model gives ${home} ${Math.round(espnHome * 100)} in 100`);
	const avg = ensembleHome ?? (oddsHome != null && espnHome != null ? (oddsHome + espnHome) / 2 : oddsHome ?? espnHome);
	if (avg == null) return {
		side: "toss",
		title: "Not enough to lean",
		because: "We need a two-way price or ESPN's model."
	};
	if (avg >= .53) return {
		side: "home",
		title: `${home} is the more likely winner`,
		because: `${parts.join(". ")}. The full ensemble puts ${home} at about ${Math.round(avg * 100)} in 100. That is still not a lock — about ${Math.round((1 - avg) * 100)} in 100 times the other team wins.`
	};
	if (avg <= .47) {
		const awayChance = 1 - avg;
		return {
			side: "away",
			title: `${away} is the more likely winner`,
			because: `${parts.join(". ")}. The full ensemble puts ${away} at about ${Math.round(awayChance * 100)} in 100. That is still not a lock — about ${Math.round((1 - awayChance) * 100)} in 100 times ${home} wins.`
		};
	}
	return {
		side: "toss",
		title: "Too close to call",
		because: `${parts.join(". ")}. When a game sits near 50/50, the sportsbook's cut is the real opponent.`
	};
}
export function gradeParlay(legs) {
	const sameGame = new Set(legs.map((l) => l.eventId)).size < legs.length;
	const mlAndSpread = sameGame && legs.some((l) => l.marketType === "ml") && legs.some((l) => l.marketType === "spread");
	const raw = product(legs.map((l) => Number.isFinite(l.fairProb) ? l.fairProb : americanToImplied(l.price)));
	const fair = Math.min(.97, raw * (sameGame ? sgpHaircut(legs.length, mlAndSpread) : 1));
	const implied = product(legs.map((l) => americanToImplied(l.price)));
	const decimalPayout = product(legs.map((l) => americanToDecimal(l.price)));
	const profitOn100 = (decimalPayout - 1) * 100;
	const longshot = legs.length >= 4 || fair < .2;
	const entertainment = fair < .25 || legs.length >= 4;
	const shownPct = formatChancePct(shownCombinedChance(fair, decimalPayout, legs.length, sameGame)) ?? `${Math.round(fair * 100)}%`;
	return {
		legs,
		combinedFair: fair,
		combinedImplied: implied,
		decimalPayout,
		profitOn100,
		independent: !sameGame,
		longshot,
		entertainment,
		correlation: sameGame ? "fallback-haircut" : "near-independent",
		headline: entertainment ? `${legs.length}-game parlay — fun money, not a plan` : `${legs.length}-game parlay`,
		because: [
			sameGame
				? `Thin fallback-haircut. Combined chance ≈ ${shownPct}.`
				: `If every game is independent, about ${shownPct.replace("%", "")} in 100 tickets like this hit.`,
			`The sportsbook pays about $${profitOn100.toFixed(0)} profit on a $100 bet if they all win.`,
			longshot ? "Stacking more games makes the payout jump and the win chance collapse. That is the trade." : "Both (or all) must win or the whole ticket loses.",
			"Real parlays hit a bit less often than this math because each price already includes the house cut.",
			legs.some((l) => l.marketType === "prop") ? "Player-bet legs use the photographed number plus game total, script, weather, park, rest, and injuries." : null,
		].filter(Boolean).join(" ")
	};
}
export function matchParsedToRows(parsed, rows) {
	return parsed.map((p, i) => {
		const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
		const home = norm(p.home);
		const away = norm(p.away);
		const sel = norm(p.selection);
		const hit = rows.find((r) => {
			if (r.marketType !== p.marketType) return false;
			if (!((norm(r.home).includes(home) || home.includes(norm(r.home))) && (norm(r.away).includes(away) || away.includes(norm(r.away))))) return false;
			if (p.side && r.side === p.side) return true;
			return norm(r.selection).includes(sel.split(" ")[0] ?? sel) || sel.includes(norm(r.selection));
		}) ?? rows.find((r) => {
			return (norm(r.home).includes(home) || home.includes(norm(r.home))) && (norm(r.away).includes(away) || away.includes(norm(r.away))) && r.marketType === p.marketType;
		});
		const game = hit ?? rows.find((r) => {
			return (norm(r.home).includes(home) || home.includes(norm(r.home))) && (norm(r.away).includes(away) || away.includes(norm(r.away))) && r.marketType === "ml";
		});
		const fair = hit?.fairProb ?? americanToImplied(p.price);
		const eventId = game?.eventId ?? hit?.eventId ?? `shot-${i}-${sel.slice(0, 12)}`;
		return {
			key: pickKey({
				eventId,
				marketType: p.marketType,
				side: hit?.side ?? p.side
			}),
			eventId,
			sport: hit?.sport ?? game?.sport ?? p.sport,
			start: hit?.start ?? game?.start ?? p.start ?? "",
			home: hit?.home ?? game?.home ?? p.home,
			away: hit?.away ?? game?.away ?? p.away,
			marketType: p.marketType,
			side: hit?.side ?? p.side,
			selection: hit?.selection ?? p.selection,
			price: Number.isFinite(p.price) ? p.price : hit?.price ?? -110,
			fairProb: fair,
			point: p.point ?? hit?.point,
			player: p.player
		};
	});
}
export function namesHit(a, b) {
	const na = normName(a);
	const nb = normName(b);
	if (!na || !nb) return false;
	if (na === nb) return true;
	if (na.includes(nb) || nb.includes(na)) return true;
	const lastA = na.split(" ").pop() ?? na;
	const lastB = nb.split(" ").pop() ?? nb;
	return lastA.length >= 4 && lastA === lastB;
}
export function ticketMatchesQuote(t, q) {
	if (!(namesHit(t.home, q.home) && namesHit(t.away, q.away))) return false;
	if (t.marketType && t.marketType !== q.marketType) return false;
	if (t.side && t.side !== q.side) {
		const sel = normName(t.selection);
		if (!(sel && (normName(q.selection).includes(sel) || sel.includes(normName(q.selection))))) return false;
	}
	return true;
}
/** Photograph prices replace matching delayed rows so the ensemble uses the live Hard Rock Bet Florida number. */
export function overlayQuotesWithTickets(quotes, tickets) {
	const ready = tickets.filter((t) => t.confirmed && t.home && Number.isFinite(t.price));
	if (!ready.length) return quotes;
	const used = new Set();
	const next = quotes.map((q) => {
		const idx = ready.findIndex((t, i) => !used.has(i) && ticketMatchesQuote(t, q));
		if (idx < 0) return q;
		used.add(idx);
		const t = ready[idx];
		const venueNote = q.venueNote === "dk_sportsbook" || q.venueNote === "fd_sportsbook" ? q.venueNote : "hardrock";
		return {
			...q,
			price: t.price,
			hardRockPrice: t.price,
			point: t.point ?? q.point,
			source: "screenshot",
			confirmed: true,
			venueNote
		};
	});
	const extras = ready.filter((_, i) => !used.has(i)).map((t, i) => ({
		eventId: `shot-${normName(t.home)}-${normName(t.away)}-${i}`.replace(/\s+/g, "-"),
		sport: t.sport || "NFL",
		start: t.start ?? new Date(Date.now() + 43_200_000).toISOString(),
		home: t.home,
		away: t.away,
		marketType: t.marketType,
		side: t.side,
		selection: t.selection,
		price: t.price,
		hardRockPrice: t.price,
		point: t.point,
		source: "screenshot",
		delayed: true,
		isProp: t.marketType === "prop",
		player: t.player,
		venueNote: "hardrock",
		confirmed: true
	}));
	return extras.length ? [...extras, ...next] : next;
}
export function overlaySnapshot(base, tickets) {
	if (!base) return undefined;
	const ready = tickets.filter((t) => t.confirmed && t.home && Number.isFinite(t.price));
	if (!ready.length) return base;
	return {
		...base,
		quotes: overlayQuotesWithTickets(base.quotes, ready)
	};
}
/** Same ensemble used on the board: ML legs get researched win chance; player bets get the prop stack. */
export function enrichParlayPicks(picks, rows, briefs, predict) {
	return picks.map((p) => {
		const gameRows = rows.filter((r) => r.eventId === p.eventId);
		const byName = gameRows.length > 0 ? gameRows : rows.filter((r) => namesHit(r.home, p.home) && namesHit(r.away, p.away));
		const useRows = byName.length ? byName : gameRows;
		const eventId = useRows[0]?.eventId ?? p.eventId;
		const brief = briefs?.find((b) => b.eventId === eventId) ?? briefs?.find((b) => b.eventId === p.eventId);
		const pred = predictFor(predict, eventId) ?? predictFor(predict, p.eventId);
		const fav = researchedFavorite(useRows, brief, {
			home: p.home,
			away: p.away,
			kalshiHome: pred?.kalshiHome,
			polyHome: pred?.polyHome,
			kalshiVolume: pred?.kalshiVolume,
			polyVolume: pred?.polyVolume,
			kalshiSpread: pred?.kalshiSpread
		});
		if (p.marketType === "prop") {
			const parsed = parsePropSelection(p.selection, p.sport, { player: p.player, point: p.point, side: p.side });
			const report = buildPropChance({
				sport: p.sport,
				selection: p.selection,
				price: p.price,
				player: p.player,
				side: p.side,
				point: p.point,
				home: p.home,
				away: p.away,
				gameTotal: brief?.total ?? useRows[0]?.total,
				homeSpread: brief?.homeSpread ?? useRows[0]?.homeSpread,
				teamWinChance: teamWinForPlayer(p.home, p.away, undefined, fav?.homeChance),
				injuries: brief?.injuries,
				venue: brief?.venue,
				weatherTemp: brief?.weatherTemp,
				weatherWind: brief?.weatherWind,
				weatherPrecip: brief?.weatherPrecip,
				...propContextFromBrief(brief, { home: p.home, away: p.away, player: p.player, stat: parsed.stat }),
			});
			return {
				...p,
				eventId,
				start: useRows[0]?.start || p.start,
				home: useRows[0]?.home || p.home,
				away: useRows[0]?.away || p.away,
				fairProb: report.hit,
				player: report.player,
				point: report.line ?? p.point,
				propReport: report
			};
		}
		if (p.marketType === "ml") {
			if (fav) {
				const onHome = p.side === "home" || namesHit(p.selection, p.home);
				return {
					...p,
					eventId,
					fairProb: onHome ? fav.homeChance : 1 - fav.homeChance
				};
			}
		}
		const hit = useRows.find((r) => r.marketType === p.marketType && (r.side === p.side || namesHit(r.selection, p.selection)));
		if (hit && Number.isFinite(hit.fairProb)) return {
			...p,
			eventId,
			fairProb: hit.fairProb,
			start: hit.start || p.start,
			home: hit.home || p.home,
			away: hit.away || p.away
		};
		return {
			...p,
			eventId
		};
	});
}
export function rowToPick(row) {
	return {
		key: pickKey(row),
		eventId: row.eventId,
		sport: row.sport,
		start: row.start,
		home: row.home,
		away: row.away,
		marketType: row.marketType,
		side: row.side,
		selection: row.selection,
		price: row.price,
		fairProb: row.fairProb,
		point: row.point,
		player: row.player
	};
}


const TEAM_UA = { "User-Agent": "Mozilla/5.0 (compatible; SportsLock/1.0)", Accept: "application/json" };

/** Last 10 completed games + full season log from ESPN team schedule. Analysis, not a card. */
export async function fetchTeamLastTen(path: string, teamId: string, teamName: string): Promise<FormTape | null> {
  if (!path || !teamId) return null;
  try {
    const res = await fetch(
      `https://site.web.api.espn.com/apis/site/v2/sports/${path}/teams/${encodeURIComponent(teamId)}/schedule`,
      { headers: TEAM_UA, signal: AbortSignal.timeout(8_000) },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      events?: Array<{
        date?: string;
        competitions?: Array<{
          status?: { type?: { completed?: boolean } };
          competitors?: Array<{
            homeAway?: string;
            score?: string | number | { value?: number; displayValue?: string };
            winner?: boolean;
            team?: { abbreviation?: string; displayName?: string };
          }>;
        }>;
      }>;
    };
    const games: ScoreGame[] = [];
    for (const ev of json.events ?? []) {
      const c = ev.competitions?.[0];
      if (!c?.status?.type?.completed) continue;
      const me =
        c.competitors?.find((x) => String(x.team?.displayName ?? "").toLowerCase() === teamName.toLowerCase()) ??
        c.competitors?.find((x) => x.team?.abbreviation && teamName.toLowerCase().includes((x.team.abbreviation || "").toLowerCase()));
      if (!me) continue;
      const opp = c.competitors?.find((x) => x !== me);
      const pf = parseEspnScore(me.score);
      const pa = parseEspnScore(opp?.score);
      const win = me.winner === true || (Number.isFinite(pf) && Number.isFinite(pa) && pf > pa);
      const loss = me.winner === false || (Number.isFinite(pf) && Number.isFinite(pa) && pf < pa);
      if (!win && !loss) continue;
      games.push({
        date: ev.date,
        result: win ? "W" : "L",
        pf: Number.isFinite(pf) ? pf : undefined,
        pa: Number.isFinite(pa) ? pa : undefined,
        opponent: opp?.team?.abbreviation,
        homeAway: me.homeAway === "away" ? "away" : "home",
      });
    }
    games.sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
    const last = games.slice(0, 10);
    if (last.length < 3) return null;
    return {
      team: teamName,
      line: formatScoreLine(last),
      results: last.map((g) => g.result),
      games: last,
      seasonGames: games,
    };
  } catch {
    return null;
  }
}

const STAT_LABEL: Record<string, string> = {
  hits: "hits", h: "hits", hr: "hr", homeruns: "hr", rbi: "rbi", rbis: "rbi",
  runs: "runs", r: "runs", bb: "bb", walks: "bb", k: "k", strikeouts: "k", so: "k",
  avg: "avg", points: "pts", pts: "pts", rebounds: "reb", reb: "reb", assists: "ast", ast: "ast",
  threes: "threes", "3pm": "threes", fg3m: "threes",
  passingyards: "passYds", passyds: "passYds", rushingyards: "rushYds", rushyds: "rushYds",
  receivingyards: "recYds", recyds: "recYds", receptions: "rec", rec: "rec",
  sog: "sog", shots: "sog", goals: "goals", g: "goals", saves: "saves",
  tb: "tb", totalbases: "tb", min: "min", minutes: "min", mp: "min",
};

/** Last-10 per-game averages from ESPN athlete gamelog. Drops low-minute games when minutes exist. */
export async function fetchPlayerRecent(
  sport: string,
  athleteId: string,
): Promise<{ recentStats: Record<string, number>; n: number; usageMin?: number } | null> {
  const core = CORE_LEAGUE[sport as keyof typeof CORE_LEAGUE];
  if (!core || !athleteId) return null;
  try {
    const res = await fetch(
      `https://site.web.api.espn.com/apis/common/v3/sports/${core.sport}/${core.league}/athletes/${encodeURIComponent(athleteId)}/gamelog`,
      { headers: TEAM_UA, signal: AbortSignal.timeout(8_000) },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      labels?: string[];
      names?: string[];
      displayNames?: string[];
      events?: Record<string, { stats?: Array<string | number>; event?: { date?: string } }> | Array<{ stats?: Array<string | number>; event?: { date?: string } }>;
    };
    const labels = (json.labels ?? json.names ?? json.displayNames ?? []).map((s) =>
      String(s).toLowerCase().replace(/[^a-z0-9]+/g, ""),
    );
    const rawEvents = json.events;
    const list = Array.isArray(rawEvents) ? rawEvents : rawEvents ? Object.values(rawEvents) : [];
    const dated = list
      .map((e) => ({ stats: e?.stats ?? [], date: e?.event?.date ?? "" }))
      .filter((e) => e.stats.length)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 15);
    if (dated.length < 3) return null;
    const minIdx = labels.findIndex((k) => k === "min" || k === "minutes" || k === "mp");
    const minutes = dated.map((row) => {
      if (minIdx < 0) return undefined;
      const v = row.stats[minIdx];
      const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^0-9.+-]/g, ""));
      return Number.isFinite(n) ? n : undefined;
    });
    const known = minutes.filter((n): n is number => n != null && n > 0).sort((a, b) => a - b);
    const median = known.length ? known[Math.floor(known.length / 2)]! : undefined;
    const keptIdx = dated
      .map((_, i) => i)
      .filter((i) => {
        const m = minutes[i];
        if (median == null || m == null) return true;
        return m >= median * 0.5;
      });
    const useIdx = (keptIdx.length >= 3 ? keptIdx : dated.map((_, i) => i)).slice(0, 10);
    const rows = useIdx.map((i) => dated[i]!);
    const series: Record<string, number[]> = {};
    for (const row of rows) {
      row.stats.forEach((val, i) => {
        const key = STAT_LABEL[labels[i] ?? ""] ?? labels[i];
        if (!key) return;
        const n = typeof val === "number" ? val : Number(String(val).replace(/[^0-9.+-]/g, ""));
        if (!Number.isFinite(n)) return;
        (series[key] ??= []).push(n);
      });
    }
    const recentStats: Record<string, number> = {};
    for (const k of Object.keys(series)) {
      const m = ewmaMean(series[k]!);
      if (m != null) recentStats[k] = m;
    }
    if (!Object.keys(recentStats).length) return null;
    const usageMin =
      ewmaMean(useIdx.map((i) => minutes[i]).filter((n): n is number => n != null && Number.isFinite(n))) ?? median;
    return { recentStats, n: rows.length, usageMin };
  } catch {
    return null;
  }
}

export async function enrichResearchForm(research: EventResearch, path: string): Promise<EventResearch> {
  const [homeForm, awayForm, homeLooks, awayLooks] = await Promise.all([
    research.homeTeamId ? fetchTeamLastTen(path, research.homeTeamId, research.home) : Promise.resolve(null),
    research.awayTeamId ? fetchTeamLastTen(path, research.awayTeamId, research.away) : Promise.resolve(null),
    research.homeLooks ? Promise.resolve(research.homeLooks) : research.homeTeamId ? fetchTeamLooks(path, research.homeTeamId, research.awayAbbr) : Promise.resolve(null),
    research.awayLooks ? Promise.resolve(research.awayLooks) : research.awayTeamId ? fetchTeamLooks(path, research.awayTeamId, research.homeAbbr) : Promise.resolve(null),
  ]);
  const lastFive = mergeForm(
    (research.lastFive ?? []).map((b) => ({
      team: b.team,
      line: b.line,
      results: b.results,
      games: b.games ?? [],
      seasonGames: b.seasonGames,
    })),
    [homeForm, awayForm],
  );
  const starters = (research.players ?? []).filter((p) => p.starter && p.id).slice(0, 8);
  const extra = starters.length ? (research.players ?? []).filter((p) => !p.starter && p.id).slice(0, 4) : (research.players ?? []).slice(0, 8);
  const targets = [...starters, ...extra].slice(0, 10);
  const recents = await Promise.all(targets.map((p) => fetchPlayerRecent(research.sport, p.id)));
  const byId = new Map(targets.map((p, i) => [p.id, recents[i]]));
  const players = (research.players ?? []).map((p) => {
    const hit = byId.get(p.id);
    if (!hit) return p;
    return { ...p, recentStats: hit.recentStats, recentN: hit.n, usageMin: hit.usageMin };
  });
  return {
    ...research,
    lastFive,
    players,
    homeLooks: homeLooks ?? research.homeLooks,
    awayLooks: awayLooks ?? research.awayLooks,
  };
}
