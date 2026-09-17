import { buildChance, type ChanceInput } from "./chance.ts";
import { leagueTotal } from "./chance.ts";
import { latentFromScores, type GameLatent } from "./sim.ts";
import { applyLiveRemaining } from "./live-state.ts";
import { applyVenueToMeans } from "./venues.ts";
import { applyRestToMeans } from "./rest.ts";
import { applyAvailabilityToMeans } from "./availability.ts";
import { applyProcessToMeans } from "./process-g.ts";
import { applyRecencyToMeans } from "./recency-g.ts";
import { applySplitsToMeans } from "./splits-g.ts";
import { applyMatchupToMeans } from "./matchup-g.ts";
import { capLatentToClose } from "./g-cap.ts";
import { applyOfficialsToMeans, type OfficialPosting } from "./officials.ts";
import { enrichOfficialsWithTendencies } from "./officials-registry.ts";
import { applyNflToMeans } from "./nfl-matchup.ts";
import { applyMlbParkToMeans } from "./mlb-park.ts";
import { applyNcaafBlowoutToMeans } from "./ncaaf-blowout.ts";
import { applyNhlGoalieToMeans } from "./nhl-goalie.ts";
import { applyHoopsVarianceToMeans } from "./hoops-variance.ts";
import { applyNbaVarianceToMeans } from "./nba-variance.ts";
import { applyNcaabVarianceToMeans } from "./ncaab-variance.ts";

export type LiveLatentFields = {
  inPlay?: boolean;
  homeScore?: number;
  awayScore?: number;
  period?: string;
  clock?: string;
  officials?: OfficialPosting[];
};

export function buildLatents(input: ChanceInput & { eventId: string; chanceHome?: number } & LiveLatentFields): {
  latent: GameLatent;
  poolHome?: number;
  layers: ReturnType<typeof buildChance> extends infer R ? R : never;
} {
  const report = buildChance(input);
  const homeWin = report?.home ?? input.oddsHome ?? input.espnHome ?? 0.5;
  const total = input.total ?? leagueTotal(input.sport);
  const venueMeans = applyVenueToMeans(
    input.sport,
    input.venue,
    { windMph: input.weatherWind, precip: input.weatherPrecip, tempF: input.weatherTemp },
    1,
    1,
  );
  const restMeans = applyRestToMeans(
    input.sport,
    { start: input.start, homeRestDays: input.homeRestDays, awayRestDays: input.awayRestDays },
    1,
    1,
  );
  const avail = applyAvailabilityToMeans(
    {
      sport: input.sport,
      homeOuts: input.homeOuts,
      awayOuts: input.awayOuts,
      homeQuestionable: input.homeQuestionable,
      awayQuestionable: input.awayQuestionable,
    },
    1,
    1,
  );
  let chaos = Math.max(0, Math.min(0.22, (total - leagueTotal(input.sport)) / (leagueTotal(input.sport) * 4)));
  if (!venueMeans.enclosed && input.weatherWind != null && input.weatherWind >= 20) chaos += 0.05;
  if (!venueMeans.enclosed && input.weatherPrecip != null && input.weatherPrecip >= 40) chaos += 0.03;
  
  const enrichedOfficials = enrichOfficialsWithTendencies(input.officials ?? [], input.sport);
  const officialMeans = applyOfficialsToMeans({ sport: input.sport, officials: enrichedOfficials }, 1, 1);
  
  const matchupMeans = applyMatchupToMeans(
    {
      sport: input.sport,
      homeLooks: input.homeLooks,
      awayLooks: input.awayLooks,
      homeEra: input.homeEra,
      awayEra: input.awayEra,
      homeWhip: input.homeWhip,
      awayWhip: input.awayWhip,
      homePitcherHand: input.homePitcherHand,
      awayPitcherHand: input.awayPitcherHand,
      homeBullpenXfip: input.homeBullpenXfip,
      awayBullpenXfip: input.awayBullpenXfip,
      homeBullpenRest: input.homeBullpenRest,
      awayBullpenRest: input.awayBullpenRest,
    },
    1,
    1,
  );

  const mlbParkMeans = applyMlbParkToMeans(input);
  const ncaafBlowoutMeans = applyNcaafBlowoutToMeans(input);
  const nhlGoalieMeans = applyNhlGoalieToMeans(input);

  chaos = Math.min(0.28, chaos + avail.chaosAdd + officialMeans.chaosAdd + matchupMeans.chaosAdd + mlbParkMeans.chaosAdd + ncaafBlowoutMeans.chaosAdd + nhlGoalieMeans.chaosAdd);
  const latent = latentFromScores({
    eventId: input.eventId,
    sport: input.sport,
    homeWin,
    total,
    homeSpread: input.homeSpread,
    poolHome: report?.home,
    marketHome: input.oddsHome,
    chaos,
  });

  const hoopsMeans = applyHoopsToMeans(input);
  if (!hoopsMeans.empty) {
    latent.muH = hoopsMeans.muH;
    latent.muA = hoopsMeans.muA;
  }

  const hoopsVarianceMeans = applyHoopsVarianceToMeans(input);
  if (!hoopsVarianceMeans.empty) {
    latent.muH *= hoopsVarianceMeans.muH;
    latent.muA *= hoopsVarianceMeans.muA;
    latent.chaos += hoopsVarianceMeans.chaosAdd;
  }

  const nbaVarianceMeans = applyNbaVarianceToMeans(input);
  if (!nbaVarianceMeans.empty) {
    latent.muH *= nbaVarianceMeans.muH;
    latent.muA *= nbaVarianceMeans.muA;
    latent.chaos += nbaVarianceMeans.chaosAdd;
  }

  const ncaabVarianceMeans = applyNcaabVarianceToMeans(input);
  if (!ncaabVarianceMeans.empty) {
    latent.muH *= ncaabVarianceMeans.muH;
    latent.muA *= ncaabVarianceMeans.muA;
    latent.chaos += ncaabVarianceMeans.chaosAdd;
  }

  const nflMeans = applyNflToMeans(input, latent.muH, latent.muA);
  if (!nflMeans.empty) {
    latent.muH *= nflMeans.muH;
    latent.muA *= nflMeans.muA;
    latent.chaos += nflMeans.chaosAdd;
  }
  const processMeans = applyProcessToMeans(
    {
      sport: input.sport,
      homeLooks: input.homeLooks,
      awayLooks: input.awayLooks,
      homePf: input.homePf,
      homePa: input.homePa,
      awayPf: input.awayPf,
      awayPa: input.awayPa,
    },
    1,
    1,
  );
  const recencyMeans = applyRecencyToMeans(
    { sport: input.sport, home: input.home, away: input.away, lastFive: input.lastFive },
    1,
    1,
  );
  const splitMeans = applySplitsToMeans(
    { sport: input.sport, home: input.home, away: input.away, lastFive: input.lastFive, homeLooks: input.homeLooks, awayLooks: input.awayLooks },
    1,
    1,
  );
  latent.muH *= venueMeans.muH * restMeans.muH * avail.muH * processMeans.muH * recencyMeans.muH * splitMeans.muH * matchupMeans.muH * officialMeans.muH * mlbParkMeans.muH * ncaafBlowoutMeans.muH * nhlGoalieMeans.muH;
  latent.muA *= venueMeans.muA * restMeans.muA * avail.muA * processMeans.muA * recencyMeans.muA * splitMeans.muA * matchupMeans.muA * officialMeans.muA * mlbParkMeans.muA * ncaafBlowoutMeans.muA * nhlGoalieMeans.muA;
  const note = [venueMeans.note, restMeans.note, avail.note, processMeans.empty ? undefined : processMeans.note, recencyMeans.empty ? undefined : recencyMeans.note, splitMeans.empty ? undefined : splitMeans.note, matchupMeans.empty ? undefined : matchupMeans.note, officialMeans.empty ? undefined : officialMeans.note, mlbParkMeans.empty ? undefined : mlbParkMeans.note, ncaafBlowoutMeans.empty ? undefined : ncaafBlowoutMeans.note, nhlGoalieMeans.empty ? undefined : nhlGoalieMeans.note, typeof hoopsMeans !== "undefined" && !hoopsMeans.empty ? hoopsMeans.note : undefined, typeof hoopsVarianceMeans !== "undefined" && !hoopsVarianceMeans.empty ? hoopsVarianceMeans.note : undefined, typeof nbaVarianceMeans !== "undefined" && !nbaVarianceMeans.empty ? nbaVarianceMeans.note : undefined, typeof ncaabVarianceMeans !== "undefined" && !ncaabVarianceMeans.empty ? ncaabVarianceMeans.note : undefined, typeof nflMeans !== "undefined" && !nflMeans.empty ? nflMeans.note : undefined].filter(Boolean).join(" ");
  if (note) latent.note = note;
  const capped = capLatentToClose(latent);
  const next = applyLiveRemaining(capped, {
    inPlay: input.inPlay,
    homeScore: input.homeScore,
    awayScore: input.awayScore,
    period: input.period,
    clock: input.clock,
  });
  return { latent: next, poolHome: report?.home, layers: report };
}

function applyHoopsToMeans(input: ChanceInput): { muH: number; muA: number; chaosAdd: number; empty: boolean; note?: string } {
  if (input.sport !== "NBA" && input.sport !== "NCAAB") {
    return { muH: 1, muA: 1, chaosAdd: 0, empty: true };
  }

  const { homePace, awayPace, homeOffensiveRating, awayOffensiveRating } = input;

  if (
    homePace == null || Number.isNaN(homePace) ||
    awayPace == null || Number.isNaN(awayPace) ||
    homeOffensiveRating == null || Number.isNaN(homeOffensiveRating) ||
    awayOffensiveRating == null || Number.isNaN(awayOffensiveRating)
  ) {
    return { muH: 1, muA: 1, chaosAdd: 0, empty: true };
  }

  const projectedPace = (homePace + awayPace) / 2;
  const muH = (projectedPace / 100) * homeOffensiveRating;
  const muA = (projectedPace / 100) * awayOffensiveRating;

  return {
    muH,
    muA,
    chaosAdd: 0,
    empty: false,
    note: `Pace/Eff decoupled (${projectedPace.toFixed(1)} pace).`
  };
}






















