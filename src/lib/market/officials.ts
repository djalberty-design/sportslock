import { clip } from "./math.ts";
/** Officials on G. Crew names from ESPN. Tendencies only when posted. A name with no file is empty. */
export type OfficialPosting = {
  name: string;
  role?: string;
  homeWinBias?: number; // Deviation from 50%
  totalOverBias?: number; // Deviation from league average total
  strikeZoneWidth?: number; // MLB
  penaltyRate?: number; // NFL/NHL
  foulRate?: number; // NBA
  isFatigued?: boolean; // Step 6.2: Grueling back-to-back travel schedules
  grudgePlayers?: string[]; // Step 6.2: Notoriously antagonistic referee/player relationships
};

export type OfficialSnap = {
  sport: string;
  officials?: OfficialPosting[];
  homeFtRate?: number;
  awayFtRate?: number;
  homeK9?: number;
  awayK9?: number;
};

export type OfficialLayer = {
  id: "officials";
  label: string;
  home: number;
  precision: number;
  empty: boolean;
  note: string;
};

export type OfficialMeans = {
  muH: number;
  muA: number;
  chaosAdd: number;
  empty: boolean;
  note?: string;
  layer: OfficialLayer;
};



function displayName(o: OfficialPosting): string {
  return [o.name, o.role].filter(Boolean).join(" · ");
}

export function parseEspnOfficials(raw: unknown): OfficialPosting[] {
  if (!raw || typeof raw !== "object") return [];
  const root = raw as { gameInfo?: { officials?: unknown }; officials?: unknown };
  const list = root.gameInfo?.officials ?? root.officials;
  if (!Array.isArray(list)) return [];
  const out: OfficialPosting[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as {
      fullName?: string;
      displayName?: string;
      name?: string;
      position?: { displayName?: string; name?: string } | string;
    };
    const name = o.fullName || o.displayName || o.name;
    if (!name) continue;
    const role = typeof o.position === "string" ? o.position : o.position?.displayName || o.position?.name;
    out.push({ name, role });
  }
  return out;
}

export function officialLayer(snap: OfficialSnap): OfficialLayer {
  const crew = snap.officials ?? [];
  const names = crew.map(displayName).filter(Boolean);
  const posted = crew.filter(
    (o) =>
      o.homeWinBias != null ||
      o.totalOverBias != null ||
      o.strikeZoneWidth != null ||
      o.penaltyRate != null ||
      o.foulRate != null,
  );
  
  if (!crew.length) {
    return {
      id: "officials",
      label: "Officials / umpire",
      home: 0.5,
      precision: 0,
      empty: true,
      note: "Looked up crew. ESPN/RefMetrics file not posted. Empty = Looked, not an invented strike zone.",
    };
  }
  
  if (!posted.length) {
    return {
      id: "officials",
      label: "Officials / umpire",
      home: 0.5,
      precision: 0,
      empty: true,
      note: `Crew posted: ${names.slice(0, 3).join(", ")}. Tendency file empty â€” no invented ATS or zone.`,
    };
  }
  
  const home =
    posted.reduce((s, o) => s + (o.homeWinBias != null ? o.homeWinBias + 0.5 : 0.5), 0) /
    posted.length;
    
  return {
    id: "officials",
    label: "Officials / umpire",
    home: clip(home, 0.2, 0.8),
    precision: 1.4,
    empty: false,
    note: `Posted crew tendency on ${posted.map(displayName).join(", ")}.`,
  };
}

export function applyOfficialsToMeans(snap: OfficialSnap, muH: number, muA: number): OfficialMeans {
  const layer = officialLayer(snap);
  const crew = snap.officials ?? [];
  const posted = crew.filter(
    (o) =>
      o.homeWinBias != null ||
      o.totalOverBias != null ||
      o.strikeZoneWidth != null ||
      o.penaltyRate != null ||
      o.foulRate != null,
  );

  // The Empty Look Law (Strict Guardrail)
  if (!posted.length) {
    return { muH: 1, muA: 1, chaosAdd: 0, empty: true, note: "", layer };
  }

  let nextH = muH;
  let nextA = muA;
  let chaosAdd = 0;

  for (const o of posted) {
    if (o.totalOverBias != null && Number.isFinite(o.totalOverBias)) {
      const pace = clip(1 + o.totalOverBias, 0.95, 1.05);
      nextH *= pace;
      nextA *= pace;
    }
    
    if (o.homeWinBias != null && Number.isFinite(o.homeWinBias)) {
      const tilt = clip(o.homeWinBias, -0.05, 0.05);
      nextH *= 1 + tilt;
      nextA *= 1 - tilt;
    }

    if (o.strikeZoneWidth != null && Number.isFinite(o.strikeZoneWidth)) {
      let effectiveZone = o.strikeZoneWidth;
      if (o.isFatigued) {
        effectiveZone += 0.03; // Artificially widen the zone
      }

      // Step 4.1: Umpire Zone Compounding (Diamond Alpha)
      if (snap.sport === "MLB") {
        const homeK = snap.homeK9 ?? 8.5; // Average K/9 is ~8.5
        const awayK = snap.awayK9 ?? 8.5;
        
        const homeKEdge = clip((homeK - 8.5) / 3, -0.5, 1.0);
        const awayKEdge = clip((awayK - 8.5) / 3, -0.5, 1.0);

        if (effectiveZone > 0) {
          // Wide zone (pitcher-friendly): 
          // The AWAY pitcher's K-rate suppresses the HOME team's expected runs!
          nextH *= 1 - (effectiveZone * (1 + awayKEdge));
          // The HOME pitcher's K-rate suppresses the AWAY team's expected runs!
          nextA *= 1 - (effectiveZone * (1 + homeKEdge));
        } else if (effectiveZone < 0) {
          // Tight zone (hitter-friendly): boost runs
          const absZone = Math.abs(effectiveZone);
          nextH *= 1 + (absZone * (1 + awayKEdge));
          nextA *= 1 + (absZone * (1 + homeKEdge));
        }
      }
      chaosAdd += Math.abs(effectiveZone);
    }
    
    if (o.penaltyRate != null && Number.isFinite(o.penaltyRate)) {
      chaosAdd += clip(o.penaltyRate, -0.02, 0.04);
    }
    
    if (o.foulRate != null && Number.isFinite(o.foulRate)) {
      // Step 3.2: Referee Playstyle Compounding (Hardwood Alpha)
      if (snap.sport === "NBA" || snap.sport === "NCAAB") {
        if (snap.homeFtRate != null && snap.awayFtRate != null) {
          // If a ref is foul-heavy (e.g. Scott Foster), and a team lives at the line, compound it.
          // average FT Rate is usually ~0.25
          const homeFtEdge = (snap.homeFtRate - 0.25) * 2;
          const awayFtEdge = (snap.awayFtRate - 0.25) * 2;
          
          if (o.foulRate > 0) {
             nextH *= 1 + (o.foulRate * homeFtEdge);
             nextA *= 1 + (o.foulRate * awayFtEdge);
          }
        }
      }
      chaosAdd += clip(o.foulRate, -0.02, 0.04);
    }
  }

  return {
    muH: nextH,
    muA: nextA,
    chaosAdd: clip(chaosAdd, 0, 0.06),
    empty: false,
    note: layer.note,
    layer,
  };
}


import type { PropLayer } from "./props.ts";

/**
 * Step 6.2: Referee Grudges
 * Aggressively fade players facing a referee that statistically penalizes them.
 */
export function applyRefereeGrudgeToProps(
  statCategory: string,
  playerName: string,
  officials?: OfficialPosting[]
): PropLayer | null {
  if (!officials || officials.length === 0) return null;

  for (const o of officials) {
    if (o.grudgePlayers && o.grudgePlayers.includes(playerName)) {
      if (statCategory === "points" || statCategory === "assists" || statCategory === "pra") {
        return {
          id: "referee_grudge",
          label: "Referee Grudge",
          p: 0.35, // Skews heavily towards UNDER (Foul trouble risk)
          precision: 4.5,
          family: "context",
          note: `[ALPHA] Foul trouble risk: Officiated by ${o.name} (Antagonistic History).`,
        };
      }
    }
  }
  return null;
}