import type { CheckId } from "./universe.ts";
import type { DkVolume } from "./dfs-scoring.ts";

export type MarketType = "ml" | "spread" | "total" | "prop";
export type Lane = "safe" | "middle" | "risky";
export type Conviction = "low" | "medium" | "high";
export type CheckUsed = "blocks" | "supports" | "noted" | "discarded";
export type ScanTag = "fair_or_better" | "close_enough" | "juiced" | "stale_watch" | "illegal_fl" | "in_play" | "unknown_market";
export type OptionKind = "sit" | "main" | "parlay" | "prop" | "dfs_cash" | "dfs_gpp" | "predict" | "path";
export type OptionStatusKind = "go" | "caution" | "blocked" | "lagged" | "seed";
export type QuoteSource = "espn" | "hardrock_fl" | "screenshot" | "sample";
export type VenueNote = "hardrock" | "dk_sportsbook" | "fd_sportsbook" | "other";
export type SeasonPhase = "preseason" | "regular" | "playoff";
export type TapeLean = "sharp" | "public" | "neutral" | "sharp_rlm";
export type TapeStamp = "hr-fl" | "photographed" | "research";
export type ParlayCorrelation = "shared-latent" | "near-independent" | "fallback-haircut";
export type ParlayMix = "same-game" | "same-sport" | "cross-sport";
export type PickBucket = "popular" | "prop" | "period" | "sgp" | "parlay2" | "parlay3" | "parlay4";

export type PlayerBrief = {
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
};

export type QuoteLine = {
  eventId: string;
  sport: string;
  start: string;
  home: string;
  away: string;
  marketType: MarketType;
  side: string;
  selection: string;
  price: number;
  source: QuoteSource | string;
  delayed: boolean;
  confirmed?: boolean;
  inPlay?: boolean;
  statusText?: string;
  isProp?: boolean;
  player?: string;
  point?: number;
  consensusPrice?: number;
  hardRockPrice?: number;
  openPrice?: number;
  venueNote?: VenueNote | string;
  homeRecord?: string;
  awayRecord?: string;
  homePitcher?: string;
  awayPitcher?: string;
  homeAbbr?: string;
  awayAbbr?: string;
  homeScore?: number;
  awayScore?: number;
  clock?: string;
  period?: number;
  homeLogo?: string;
  awayLogo?: string;
  homeSpread?: number;
  total?: number;
  scheduleOnly?: boolean;
  phase?: SeasonPhase;
  espnId?: string;
  sportPath?: string;
  homeScore?: number;
  awayScore?: number;
  clock?: string;
  period?: string;
  situation?: string;
};

export type ScanRow = {
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
  evPct: number;
  hold: number;
  tag: ScanTag;
  action: "stand_down" | "enter_ticket";
  reason: string;
  conviction: Conviction;
  spark: string;
  hardRockPrice?: number;
  consensusPrice?: number;
  point?: number;
  inPlay?: boolean;
  statusText?: string;
  isProp?: boolean;
  player?: string;
  venueNote?: VenueNote | string;
  homeRecord?: string;
  awayRecord?: string;
  homePitcher?: string;
  awayPitcher?: string;
  homeAbbr?: string;
  awayAbbr?: string;
  homeScore?: number;
  awayScore?: number;
  clock?: string;
  period?: number;
  homeLogo?: string;
  awayLogo?: string;
  homeSpread?: number;
  total?: number;
  openPrice?: number;
  scheduleOnly?: boolean;
  phase?: SeasonPhase;
  researchOnly?: boolean;
  playerId?: string;
  headshot?: string;
  ticketPct?: number;
  handlePct?: number;
  tapeLean?: TapeLean;
  tapeNote?: string;
  source?: string;
  simFair?: number;
  poolFair?: number;
  tapeStamp?: TapeStamp;
  leftover?: boolean;
  processLooked?: boolean;
  processSource?: string;
  homeScore?: number;
  awayScore?: number;
  clock?: string;
  period?: string;
  situation?: string;
};

export type ParlayLeg = {
  eventId: string;
  sport: string;
  selection: string;
  marketType: MarketType;
  side: string;
  price: number;
  fairProb: number;
  start: string;
  home: string;
  away: string;
};

export type ParlayCandidate = {
  legs: ParlayLeg[];
  combinedFair: number;
  combinedEv: number;
  pricedAsEntertainment: boolean;
  researchOnly: boolean;
  sameGame: boolean;
  title: string;
  reason: string;
  score?: number;
  mix?: ParlayMix;
  decimalPayout?: number;
  sports?: string[];
  correlation?: ParlayCorrelation;
};

export type ScanBundle = {
  asOf: string;
  delayed: boolean;
  halt: boolean;
  rows: ScanRow[];
  bestMain: ScanRow | null;
  bestSpicy: ParlayCandidate | null;
  bestTwo: ParlayCandidate | null;
  bestFlip: ScanRow | null;
  missingBoard: boolean;
  topSingles: ScanRow[];
  topTwos: ParlayCandidate[];
  topThrees: ParlayCandidate[];
  topFours: ParlayCandidate[];
  topSgp: ParlayCandidate[];
};

export type NewsItem = {
  id: string;
  title: string;
  source: string;
  discarded?: boolean;
};

export type PublicSplit = {
  eventId: string;
  side: string;
  marketType?: MarketType;
  publicPct: number;
  ticketPct: number;
  handlePct: number;
  steam?: boolean;
  lean?: TapeLean;
  source?: string;
  note?: string;
};

export type PredictQuote = {
  eventId: string;
  sport: string;
  kalshiHome?: number;
  kalshiVolume?: number;
  kalshiSpread?: number;
  polyHome?: number;
  polyVolume?: number;
  source: "kalshi" | "polymarket" | "both";
};

export type EventBrief = {
  eventId: string;
  espnHomeWin?: number;
  espnAwayWin?: number;
  homeRecord?: string;
  awayRecord?: string;
  weather?: string;
  series?: string;
  injuryCount?: number;
  kalshiHomeWin?: number;
  polyHomeWin?: number;
  kalshiVolume?: number;
  polyVolume?: number;
  kalshiSpread?: number;
  bookHomeWin?: number;
  chanceHome?: number;
  homeSpread?: number;
  total?: number;
  openHomeWin?: number;
  ticketHome?: number;
  handleHome?: number;
  steam?: boolean;
  venue?: string;
  weatherTemp?: number;
  weatherWind?: number;
  weatherPrecip?: number;
  homeEra?: number;
  awayEra?: number;
  homeSplit?: string;
  awaySplit?: string;
  homeOuts?: number;
  awayOuts?: number;
  homeQuestionable?: number;
  awayQuestionable?: number;
  homeWhip?: number;
  awayWhip?: number;
  homePf?: number;
  homePa?: number;
  awayPf?: number;
  awayPa?: number;
  seriesHomeWins?: number;
  seriesAwayWins?: number;
  homeRestDays?: number;
  awayRestDays?: number;
  homeLooks?: import("./looks.ts").TeamLooks;
  awayLooks?: import("./looks.ts").TeamLooks;
  homePitcherHand?: "L" | "R";
  awayPitcherHand?: "L" | "R";
  players?: PlayerBrief[];
  injuries?: Array<{ team: string; player: string; status: string; detail?: string }>;
  homeScore?: number;
  awayScore?: number;
  clock?: string;
  period?: string;
  situation?: string;
  form?: Array<{
    team: string;
    line: string;
    results: string[];
    games?: Array<{ date?: string; result: string; pf?: number; pa?: number; opponent?: string; homeAway?: "home" | "away" }>;
    seasonGames?: Array<{ date?: string; result: string; pf?: number; pa?: number; opponent?: string; homeAway?: "home" | "away" }>;
  }>;
};

export type DeskHours = {
  preGameOpen: boolean;
  etStamp: string;
  etDate: string;
  nextLock: string | null;
  label: string;
  note: string;
};

export type DeskSnapshot = {
  asOf: string;
  delayed: boolean;
  sample?: boolean;
  hours: DeskHours;
  quotes: QuoteLine[];
  news: NewsItem[];
  publicSplits: PublicSplit[];
  briefs?: EventBrief[];
  predict?: PredictQuote[];
  sourceNote: string;
};

export type Play = {
  lane: Lane;
  title: string;
  action: string;
  because: string;
  symbol: string;
  optionKind: OptionKind;
  venue: string;
  conviction: Conviction;
  liveFits: boolean;
  unitCount: number;
  details?: string;
  pricedAsEntertainment?: boolean;
  combinedFair?: number;
  price?: number;
  decimalPayout?: number;
  fairProb?: number;
  plainPick?: string;
  oddsEnglish?: string;
  payoutEnglish?: string;
  fairEnglish?: string;
  marketExplain?: string;
  home?: string;
  away?: string;
  start?: string;
  kickoffEnglish?: string;
  matchupEnglish?: string;
  sport?: string;
  eventId?: string;
  ticketPct?: number;
  handlePct?: number;
  tapeLean?: TapeLean;
  tapeNote?: string;
  legs?: Array<{
    selection: string;
    home: string;
    away: string;
    start: string;
    kickoffEnglish: string;
    matchupEnglish: string;
    sport: string;
  }>;
};

export type CrossCheck = {
  id: CheckId;
  label: string;
  used: CheckUsed;
  finding: string;
};

export type Verdict = {
  doThis: string;
  because: string;
  venue: string;
  symbol: string;
  lane: Lane;
  conviction: Conviction;
  checks: CrossCheck[];
  learnMore: string;
};

export type PlayBoard = {
  safe: Play;
  middle: Play;
  risky: Play;
  recommended: Lane;
  verdict: Verdict;
  singles: Play[];
  twoLegs: Play[];
  threeLegs: Play[];
};

export type OptionStatus = {
  kind: OptionKind;
  status: OptionStatusKind;
  note: string;
};

export type ParsedTicket = {
  sport: string;
  home: string;
  away: string;
  marketType: MarketType;
  side: string;
  selection: string;
  price: number;
  point?: number;
  start?: string;
  player?: string;
  confidence: number;
  confirmed: boolean;
};

export type PaperTicket = {
  id: string;
  createdAt: string;
  kind: "main" | "parlay" | "prop" | "dfs";
  description: string;
  stake: number;
  price?: number;
  status: "open" | "win" | "loss" | "void" | "dismissed";
  postedPrice?: number;
  delayedPrice?: number;
  livePrice?: number;
  closePrice?: number;
  clv?: number;
  pnl?: number;
  chance?: number;
  venue: "paper";
  gameIds: string[];
  hedge?: boolean;
  home?: string;
  away?: string;
  fairAtLock?: number;
  tapeSource?: TapeStamp;
};

export type ContestOffer = {
  name: string;
  buyIn: number;
  fieldSize?: number;
  prize?: number;
  kind: "cash" | "gpp" | "unknown";
  confirmed: boolean;
};

export type { DkVolume } from "./dfs-scoring.ts";

export type SalaryShift = {
  name: string;
  was: number;
  now: number;
};

export type InactiveAlert = {
  playerId: string;
  name: string;
  kind: "out" | "window" | "late-swap";
  line: string;
};

export type SlatePlayer = {
  id: string;
  name: string;
  pos: string;
  team: string;
  opp: string;
  status: "ok" | "out" | "ir" | "locked" | "questionable";
  salary: number;
  p20: number;
  p50: number;
  p80: number;
  ownershipEst: number;
  stackKey: string;
  confidence: "low" | "med" | "high";
  confirmed: boolean;
  ePts: number;
  value: number;
  researchNote?: string;
  volume?: DkVolume;
  targetShare?: number;
  usageRate?: number;
  opportunityWeight?: number;
  spread?: number;
  total?: number;
  favoredBy?: number;
  kickoff?: string;
  windMph?: number;
  prevSalary?: number;
};

export type SlateLineup = {
  kind: "cash" | "gpp" | "showdown";
  players: SlatePlayer[];
  capUsed: number;
  cap: number;
  projP20: number;
  projP50: number;
  projP80: number;
  warnings: string[];
  captainId?: string | null;
  stackNote?: string;
};

export type SlateBundle = {
  site: "draftkings_classic";
  sport: string;
  slateDate: string;
  cap: number;
  players: SlatePlayer[];
  source: string;
  confirmed: boolean;
  cash: SlateLineup | null;
  gpp: SlateLineup | null;
  showdown?: SlateLineup | null;
  salaryShifts?: SalaryShift[];
  inactiveAlerts?: InactiveAlert[];
};



