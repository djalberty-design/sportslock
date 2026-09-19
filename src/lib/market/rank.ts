import type { DeskSnapshot, ScanBundle, ScanRow } from "./types.ts";
import { buildScan } from "./engine.ts";
import { buildDeskPicks, type DeskPicks, type DeskPick } from "./picks.ts";
import type { RankSettings } from "../desk-settings.ts";
import { DESK_VERSION } from "./rules.ts";
import { floridaBlockReason, isFloridaBlocked } from "./florida.ts";
import { comboHasBlockedLeg, keepLegalCombos } from "./combo-law.ts";
import { applyAcceptedOverrides, listOverrides } from "./overrides.ts";

export type RankRequest = {
  id: number;
  snapshot: DeskSnapshot;
  halt: boolean;
  settings?: RankSettings;
};

export type RankResult = {
  id: number;
  scan: ScanBundle;
  picks: DeskPicks;
  ms: number;
};

function applyFloridaLaw(scan: ScanBundle): ScanBundle {
  const rows: ScanRow[] = scan.rows.map((r) => {
    if (!isFloridaBlocked(r) || r.tag === "illegal_fl") return r;
    return {
      ...r,
      tag: "illegal_fl",
      action: "stand_down",
      reason: floridaBlockReason(r) ?? r.reason,
    };
  });
  const keep = keepLegalCombos;
  const bestTwo = scan.bestTwo && !comboHasBlockedLeg(scan.bestTwo) ? scan.bestTwo : null;
  const bestSpicy = scan.bestSpicy && !comboHasBlockedLeg(scan.bestSpicy) ? scan.bestSpicy : null;
  return {
    ...scan,
    rows,
    bestTwo,
    bestSpicy,
    topTwos: keep(scan.topTwos),
    topThrees: keep(scan.topThrees),
    topFours: keep(scan.topFours),
    topSgp: keep(scan.topSgp),
  };
}

function pickLooksBlocked(p: DeskPick): boolean {
  const row = p.row;
  if (p.parlay && comboHasBlockedLeg(p.parlay)) return true;
  return isFloridaBlocked({
    sport: row?.sport ?? p.sport,
    isProp: row?.isProp || p.bucket === "prop",
    marketType: row?.marketType ?? (p.bucket === "prop" ? "prop" : undefined),
    player: row?.player ?? p.player,
    selection: row?.selection ?? p.selection,
    venueNote: row?.venueNote,
  });
}

function scrubPicks(picks: DeskPicks): DeskPicks {
  const keep = (list: DeskPick[]) => list.filter((p) => !pickLooksBlocked(p));
  const hero = picks.hero && pickLooksBlocked(picks.hero) ? null : picks.hero;
  return {
    ...picks,
    hero,
    popular: keep(picks.popular),
    props: keep(picks.props),
    periods: keep(picks.periods),
    sgp: keep(picks.sgp),
    two: keep(picks.two),
    three: keep(picks.three),
    four: keep(picks.four),
    ribbon: keep(picks.ribbon),
    all: keep(picks.all),
  };
}

export async function rankDesk(
  snapshot: DeskSnapshot,
  halt: boolean,
  settings?: RankSettings,
): Promise<{ scan: ScanBundle; picks: DeskPicks }> {
  const raw = applyFloridaLaw(await buildScan(snapshot, halt, settings));
  const overrides = await listOverrides();
  const rows = applyAcceptedOverrides(raw.rows, overrides);
  const scan = { ...raw, rows };
  const picks = scrubPicks(buildDeskPicks(scan, snapshot));
  return { scan, picks };
}

export async function runRankJob(req: RankRequest): Promise<RankResult> {
  const t0 = Date.now();
  const { scan, picks } = await rankDesk(req.snapshot, req.halt, req.settings);
  return { id: req.id, scan, picks, ms: Date.now() - t0 };
}

export function oddsFingerprint(snapshot: DeskSnapshot): string {
  const quotes = snapshot.quotes
    .map((q) => `${q.eventId}:${q.marketType}:${q.side}:${q.price}:${q.point ?? ""}:${q.inPlay ? 1 : 0}:${q.homeScore ?? ""}:${q.awayScore ?? ""}:${q.period ?? ""}:${q.clock ?? ""}:${q.source ?? ""}`)
    .sort()
    .join("|");
  return `${DESK_VERSION}|${snapshot.quotes.length}#${quotes}`;
}
