import { invLogit } from "./math.ts";
/** Rest / travel / body clock on G. NBA-NHL B2B, NFL short week vs bye, MLB bullpen B2B. */
export type RestSnap = {
  sport: string;
  start?: string;
  homeRestDays?: number;
  awayRestDays?: number;
  homeWinPct?: number;
  awayWinPct?: number;
};

export type RestEffect = {
  homeLogit: number;
  totalMul: number;
  homeMeanMul: number;
  awayMeanMul: number;
  layerHome: number;
  precision: number;
  empty: boolean;
  note: string;
};



export function kickHourEt(start?: string): number | undefined {
  if (!start) return undefined;
  const t = new Date(start).getTime();
  if (!Number.isFinite(t)) return undefined;
  return ((new Date(t).getUTCHours() - 4) + 24) % 24;
}

export function restEffect(input: RestSnap): RestEffect {
  const sport = input.sport || "";
  const rawH = input.homeRestDays;
  const rawA = input.awayRestDays;
  if ((rawH == null || !Number.isFinite(rawH)) && (rawA == null || !Number.isFinite(rawA))) {
    return {
      homeLogit: 0,
      totalMul: 1,
      homeMeanMul: 1,
      awayMeanMul: 1,
      layerHome: 0.5,
      precision: 0,
      empty: true,
      note: "Looked up rest from the live log. Empty look.",
    };
  }
  const h = rawH != null && Number.isFinite(rawH) ? rawH : 3;
  const a = rawA != null && Number.isFinite(rawA) ? rawA : 3;
  const early = kickHourEt(input.start);
  const afternoonEt = early != null && early < 17;
  let z = 0;
  let totalMul = 1;
  let homeMeanMul = 1;
  let awayMeanMul = 1;
  const notes: string[] = [];
  if (sport === "NBA" || sport === "NHL" || sport === "NCAAB") {
    const homeB2b = h < 1.25;
    const awayB2b = a < 1.25;
    if (homeB2b) {
      z -= 0.1;
      homeMeanMul *= 0.985;
      notes.push("Home on a back-to-back.");
    }
    if (awayB2b) {
      z += 0.13;
      awayMeanMul *= 0.98;
      notes.push("Away on a back-to-back.");
    }
    if (homeB2b && awayB2b) totalMul *= 0.985;
    if (awayB2b && afternoonEt) {
      z += 0.04;
      notes.push("Away body clock vs an afternoon ET start.");
    }
    if (!homeB2b && !awayB2b && h + 1.2 <= a) {
      z += 0.03;
      notes.push("Home has more rest.");
    }
    if (!homeB2b && !awayB2b && a + 1.2 <= h) {
      z -= 0.03;
      notes.push("Away has more rest.");
    }
  } else if (sport === "NFL" || sport === "NCAAF") {
    const homeShort = h < 6.5;
    const awayShort = a < 6.5;
    const homeBye = h >= 13;
    const awayBye = a >= 13;
    if (homeShort && !awayShort) {
      z -= 0.07;
      homeMeanMul *= 0.99;
      notes.push("Home short week.");
    }
    if (awayShort && !homeShort) {
      z += 0.07;
      // [ALPHA] Short Week Travel Disadvantage
      z += 0.03; 
      awayMeanMul *= 0.98;
      notes.push("Away short-week travel disadvantage. Brutal spot for road teams.");
    }
    if (homeBye && !awayBye) {
      z += 0.04;
      notes.push("Home off a bye.");
    }
    if (awayBye && !homeBye) {
      z -= 0.03;
      notes.push("Away off a bye (Rust vs Rest).");
    }
    if (homeShort || awayShort) totalMul *= 0.995;

    // [ALPHA] Lookahead / Trap Spots
    if (input.awayWinPct != null && input.homeWinPct != null) {
      if (input.awayWinPct >= 0.75 && input.homeWinPct <= 0.35) {
        z += 0.06; // Boost the home dog
        notes.push("[ALPHA] Lookahead/Trap Spot: Elite road team facing weak home team. Often caught looking ahead to next week.");
      } else if (input.homeWinPct >= 0.75 && input.awayWinPct <= 0.35) {
        z -= 0.03;
        notes.push("[ALPHA] Lookahead Spot: Elite home team may coast or rest starters late.");
      }
    }
  } else if (sport === "MLB") {
    if (h < 1.15) {
      z -= 0.05;
      homeMeanMul *= 0.99;
      notes.push("Home bullpen on no rest.");
    }
    if (a < 1.15) {
      z += 0.05;
      awayMeanMul *= 0.99;
      notes.push("Away bullpen on no rest.");
    }
    if (h >= 3 && a < 2) {
      z += 0.02;
      notes.push("Home extra rest vs a short-turn away.");
    }
  }
  return {
    homeLogit: z,
    totalMul,
    homeMeanMul,
    awayMeanMul,
    layerHome: invLogit(z, 0.03, 0.97),
    precision: notes.length ? 2.1 : 0.8,
    empty: notes.length === 0 && Math.abs(z) < 1e-9,
    note: notes.join(" ") || `Rest home ${h.toFixed(1)}d / away ${a.toFixed(1)}d.`,
  };
}

export function applyRestToMeans(
  sport: string,
  snap: { start?: string; homeRestDays?: number; awayRestDays?: number },
  muH: number,
  muA: number,
): { muH: number; muA: number; note?: string } {
  const r = restEffect({ sport, ...snap });
  return {
    muH: muH * r.homeMeanMul * r.totalMul,
    muA: muA * r.awayMeanMul * r.totalMul,
    note: r.empty ? undefined : r.note,
  };
}

