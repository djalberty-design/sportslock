import { useMemo, useState, type ReactNode } from "react";
import { Calendar, Check, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn, formatKickoff, isTodayEt } from "@/lib/utils";
import { espnLogoUrl, teamNick } from "@/lib/market/logos";
import { pickKey, rowToPick, type EventResearch, type ParlayPick } from "@/lib/market/research";
import { buildSheet, marketsOnTab, seedTemplate, type SheetLine, type SheetMarket } from "@/lib/market/sheet";
import type { ScanRow } from "@/lib/market/types";
import { HitReadout } from "./wager-meter";
import { TapeStrip } from "./play-card";

type TabId = "popular" | "props" | "research" | "innings" | "half" | "quarters" | "halves" | "periods";

const TABS: Record<string, Array<{ id: TabId; label: string }>> = {
  MLB: [
    { id: "popular", label: "Popular" },
    { id: "props", label: "Player Props" },
    { id: "innings", label: "Innings Props" },
    { id: "half", label: "Half Inning" },
    { id: "research", label: "Research" },
  ],
  NFL: [
    { id: "popular", label: "Popular" },
    { id: "props", label: "Player Props" },
    { id: "quarters", label: "Quarters" },
    { id: "halves", label: "Halves" },
    { id: "research", label: "Research" },
  ],
  NBA: [
    { id: "popular", label: "Popular" },
    { id: "props", label: "Player Props" },
    { id: "quarters", label: "Quarters" },
    { id: "halves", label: "Halves" },
    { id: "research", label: "Research" },
  ],
  NHL: [
    { id: "popular", label: "Popular" },
    { id: "props", label: "Player Props" },
    { id: "periods", label: "Periods" },
    { id: "research", label: "Research" },
  ],
  NCAAF: [
    { id: "popular", label: "Popular" },
    { id: "props", label: "Player Props" },
    { id: "quarters", label: "Quarters" },
    { id: "halves", label: "Halves" },
    { id: "research", label: "Research" },
  ],
  NCAAB: [
    { id: "popular", label: "Popular" },
    { id: "props", label: "Player Props" },
    { id: "quarters", label: "Quarters" },
    { id: "halves", label: "Halves" },
    { id: "research", label: "Research" },
  ],
};

const FALLBACK_TABS: Array<{ id: TabId; label: string }> = [
  { id: "popular", label: "Popular" },
  { id: "props", label: "Player Props" },
  { id: "research", label: "Research" },
];

export function HardRockSheet({
  sport,
  home,
  away,
  homeAbbr,
  awayAbbr,
  homeLogo,
  awayLogo,
  start,
  phase,
  scheduleOnly,
  rows,
  selected,
  legs,
  onPick,
  addLeg,
  removeLeg,
  research,
  eventResearch,
  homeWin,
  researchLoading,
}: {
  sport: string;
  home: string;
  away: string;
  homeAbbr?: string;
  awayAbbr?: string;
  homeLogo?: string;
  awayLogo?: string;
  start: string;
  phase?: string;
  scheduleOnly?: boolean;
  rows: ScanRow[];
  selected: ScanRow | null;
  legs: ParlayPick[];
  onPick: (row: ScanRow) => void;
  addLeg: (leg: ParlayPick) => void;
  removeLeg: (key: string) => void;
  research: ReactNode;
  eventResearch?: EventResearch | null;
  homeWin: number;
  researchLoading?: boolean;
}) {
  const [tab, setTab] = useState<TabId>("popular");
  const [sgp, setSgp] = useState(false);
  const [open, setOpen] = useState<string | null>("ml");
  const [more, setMore] = useState<Record<string, boolean>>({});
  const [altsOpen, setAltsOpen] = useState<Record<string, boolean>>({});

  const mlHome = rows.find((r) => r.marketType === "ml" && r.side === "home");
  const mlAway = rows.find((r) => r.marketType === "ml" && r.side === "away");
  const awayNick = teamNick(away, awayAbbr, mlAway?.selection);
  const homeNick = teamNick(home, homeAbbr, mlHome?.selection);
  const tabs = TABS[sport] ?? FALLBACK_TABS;
  const college = sport === "NCAAF" || sport === "NCAAB";

  const sheet = useMemo(() => {
    const seed = rows.length
      ? rows
      : [
          seedTemplate({
            eventId: eventResearch?.eventId,
            sport,
            start,
            home,
            away,
            homeAbbr,
            awayAbbr,
            homeLogo,
            awayLogo,
            homeWin,
          }),
        ];
    return buildSheet({
      sport,
      home,
      away,
      homeNick,
      awayNick,
      rows: seed,
      research: eventResearch,
      homeWin,
    });
  }, [sport, home, away, homeNick, awayNick, rows, eventResearch, homeWin, start, homeAbbr, awayAbbr, homeLogo, awayLogo]);

  const markets = tab === "research" ? [] : marketsOnTab(sheet, tab);

  function tap(row: ScanRow | undefined) {
    if (!row || row.scheduleOnly) return;
    if (sgp) {
      const key = pickKey(row);
      if (legs.some((l) => l.key === key)) removeLeg(key);
      else addLeg(rowToPick(row));
    }
    onPick(row);
  }

  const mains = mainCells(sheet, rows);

  return (
    <div>
      <header className="px-1 pb-5 pt-2">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <TeamMark sport={sport} abbr={awayAbbr} name={awayNick} logo={awayLogo} />
          <p className="text-sm text-faint">@</p>
          <TeamMark sport={sport} abbr={homeAbbr} name={homeNick} logo={homeLogo} />
        </div>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-sm text-muted">
          <Calendar className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
          {sheetWhen(start)}
        </p>
        {mlHome?.ticketPct != null || mlAway?.ticketPct != null ? (
          <div className="mx-auto mt-3 max-w-md">
            <TapeStrip
              ticketPct={mlHome?.ticketPct ?? (mlAway?.ticketPct != null ? 1 - mlAway.ticketPct : undefined)}
              handlePct={mlHome?.handlePct ?? (mlAway?.handlePct != null ? 1 - mlAway.handlePct : undefined)}
              lean={mlHome?.tapeLean ?? mlAway?.tapeLean}
              note={mlHome?.tapeNote ?? mlAway?.tapeNote}
            />
          </div>
        ) : null}
        {phase === "preseason" || scheduleOnly ? (
          <p className="mt-1 text-center text-xs text-emerald-500">
            {phase === "preseason" ? "Preseason" : ""}
            {phase === "preseason" && scheduleOnly ? " · " : ""}
            {scheduleOnly ? "Odds not posted yet" : ""}
          </p>
        ) : null}
      </header>

      <div className="flex items-center justify-between gap-3 rounded-md bg-wash px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="sgp-badge">SGP</span>
          <p className="text-xs text-muted">
            Only show bets for <span className="font-semibold tracking-wide text-ink">SAME GAME PARLAY</span>
          </p>
        </div>
        <button
          type="button"
          role="checkbox"
          aria-checked={sgp}
          onClick={() => setSgp((v) => !v)}
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-sm border-2 transition-colors",
            sgp ? "border-emerald-500 bg-emerald-500 text-zinc-950" : "border-muted bg-transparent text-transparent",
          )}
        >
          <Check className="size-3.5" strokeWidth={3} aria-hidden />
          <span className="sr-only">Same game parlay</span>
        </button>
      </div>
      {sgp ? (
        <p className="mt-2 px-1 text-xs text-muted">
          Tap a number to add it. Photograph the Hard Rock slip before you lock.
        </p>
      ) : null}

      <div className="mt-4 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              const next = t.id === "research" ? null : (marketsOnTab(sheet, t.id)[0]?.id ?? null);
              setOpen(next);
            }}
            className={cn(
              "min-h-11 shrink-0 px-3 text-sm font-medium",
              tab === t.id ? "border-b-2 border-emerald-500 text-ink" : "text-muted",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "research" ? <div className="pt-4">{research}</div> : null}

      {tab === "popular" ? (
        <div className="pt-4">
          <MainGrid
            awayNick={awayNick}
            homeNick={homeNick}
            spAway={mains.spAway}
            spHome={mains.spHome}
            totOver={mains.totOver}
            totUnder={mains.totUnder}
            mlAway={mains.mlAway}
            mlHome={mains.mlHome}
            selected={selected}
            legs={legs}
            sgp={sgp}
            onTap={tap}
          />
          <p className="mt-4 px-1 text-xs text-muted">
            Every cell shows chance it hits and what your Start-tab stake pays if it does. Gold numbers without a photo
            are a research look — photograph Hard Rock to lock the live price.
          </p>
          <MarketList
            markets={markets}
            open={open}
            setOpen={setOpen}
            more={more}
            setMore={setMore}
            altsOpen={altsOpen}
            setAltsOpen={setAltsOpen}
            selected={selected}
            legs={legs}
            sgp={sgp}
            onTap={tap}
            researchLoading={researchLoading}
            homeLogo={homeLogo}
            awayLogo={awayLogo}
          />
        </div>
      ) : null}

      {tab !== "popular" && tab !== "research" ? (
        <div className="pt-2">
          {college && tab === "props" ? (
            <p className="mt-3 rounded-md bg-wash-gold px-4 py-3 text-sm text-emerald-500">
              College player bets are not allowed on Hard Rock Bet in Florida. Use who wins, the spread, or the total.
            </p>
          ) : (
            <MarketList
              markets={markets}
              open={open}
              setOpen={setOpen}
              more={more}
              setMore={setMore}
              altsOpen={altsOpen}
              setAltsOpen={setAltsOpen}
              selected={selected}
              legs={legs}
              sgp={sgp}
              onTap={tap}
              researchLoading={researchLoading}
              homeLogo={homeLogo}
              awayLogo={awayLogo}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

function mainCells(sheet: ReturnType<typeof buildSheet>, rows: ScanRow[]) {
  const ml = sheet.popular.find((m) => m.id === "ml");
  const spread = sheet.popular.find((m) => m.id === "spread");
  const total = sheet.popular.find((m) => m.id === "total");
  const postedSpread = rows.find((r) => r.marketType === "spread" && r.side === "home")?.point;
  const postedTotal = rows.find((r) => r.marketType === "total")?.point;
  const spreadLine =
    spread?.lines.find((l) => l.right && postedSpread != null && Math.abs((l.right.point ?? 0) - postedSpread) < 0.05) ??
    spread?.lines[Math.floor((spread.lines.length || 1) / 2)];
  const totLine =
    total?.lines.find((l) => postedTotal != null && Math.abs(Number(l.label) - postedTotal) < 0.05) ??
    total?.lines[Math.floor((total.lines.length || 1) / 2)];
  return {
    mlHome: ml?.lines[0]?.single,
    mlAway: ml?.lines[1]?.single,
    spHome: spreadLine?.right,
    spAway: spreadLine?.left,
    totOver: totLine?.left,
    totUnder: totLine?.right,
  };
}

function MainGrid({
  awayNick,
  homeNick,
  spAway,
  spHome,
  totOver,
  totUnder,
  mlAway,
  mlHome,
  selected,
  legs,
  sgp,
  onTap,
}: {
  awayNick: string;
  homeNick: string;
  spAway?: ScanRow;
  spHome?: ScanRow;
  totOver?: ScanRow;
  totUnder?: ScanRow;
  mlAway?: ScanRow;
  mlHome?: ScanRow;
  selected: ScanRow | null;
  legs: ParlayPick[];
  sgp: boolean;
  onTap: (row: ScanRow | undefined) => void;
}) {
  return (
    <div className="px-1">
      <div className="grid grid-cols-[minmax(3.25rem,0.85fr)_repeat(3,minmax(0,1fr))] items-end gap-1.5">
        <p />
        <p className="stamp pb-1 text-center text-faint">Spread</p>
        <p className="stamp pb-1 text-center text-faint">Total</p>
        <p className="stamp pb-1 text-center text-faint">Winner</p>

        <p className="flex min-h-24 items-center pr-1 text-sm font-medium text-ink">{awayNick}</p>
        <OddsCell row={spAway} selected={selected} legs={legs} sgp={sgp} onTap={onTap} />
        <OddsCell row={totOver} selected={selected} legs={legs} sgp={sgp} onTap={onTap} />
        <OddsCell row={mlAway} selected={selected} legs={legs} sgp={sgp} onTap={onTap} />

        <p className="flex min-h-24 items-center pr-1 text-sm font-medium text-ink">{homeNick}</p>
        <OddsCell row={spHome} selected={selected} legs={legs} sgp={sgp} onTap={onTap} />
        <OddsCell row={totUnder} selected={selected} legs={legs} sgp={sgp} onTap={onTap} />
        <OddsCell row={mlHome} selected={selected} legs={legs} sgp={sgp} onTap={onTap} />
      </div>
    </div>
  );
}

function activeRow(row: ScanRow, selected: ScanRow | null, legs: ParlayPick[], sgp: boolean): boolean {
  const key = pickKey(row);
  if (selected && pickKey(selected) === key) return true;
  if (sgp && legs.some((l) => l.key === key)) return true;
  return false;
}

function OddsCell({
  row,
  selected,
  legs,
  sgp,
  onTap,
  badge,
}: {
  row?: ScanRow;
  selected: ScanRow | null;
  legs: ParlayPick[];
  sgp: boolean;
  onTap: (row: ScanRow | undefined) => void;
  badge?: string | null;
}) {
  if (!row || row.scheduleOnly) {
    return <div className="grid min-h-24 place-items-center rounded-sm bg-wash text-sm text-faint">—</div>;
  }
  const on = activeRow(row, selected, legs, sgp);
  const line = badge === undefined ? lineLabel(row) : badge;
  const pct =
    Number.isFinite(row.fairProb) && row.fairProb > 0
      ? Math.max(0, Math.min(100, row.fairProb * 100))
      : null;
  return (
    <button
      type="button"
      onClick={() => onTap(row)}
      className={cn(
        "relative flex min-h-24 w-full min-w-0 flex-col items-center justify-center overflow-hidden rounded-sm bg-wash px-1 py-2",
        on && "bg-wash-gold ring-2 ring-gold",
      )}
    >
      {line ? <span className="text-sm leading-none text-ink">{line}</span> : null}
      <HitReadout
        className={line ? "mt-1" : undefined}
        chance={row.fairProb}
        price={row.price}
        hero={!line}
      />
      {pct != null ? (
        <span className="absolute inset-x-0 bottom-0 h-0.5 bg-line" aria-hidden>
          <span className="block h-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </span>
      ) : null}
    </button>
  );
}

function MarketList({
  markets,
  open,
  setOpen,
  more,
  setMore,
  altsOpen,
  setAltsOpen,
  selected,
  legs,
  sgp,
  onTap,
  researchLoading,
  homeLogo,
  awayLogo,
}: {
  markets: SheetMarket[];
  open: string | null;
  setOpen: (id: string | null) => void;
  more: Record<string, boolean>;
  setMore: (next: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
  altsOpen: Record<string, boolean>;
  setAltsOpen: (next: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
  selected: ScanRow | null;
  legs: ParlayPick[];
  sgp: boolean;
  onTap: (row: ScanRow | undefined) => void;
  researchLoading?: boolean;
  homeLogo?: string;
  awayLogo?: string;
}) {
  if (!markets.length) return null;
  return (
    <ul className="mt-5 divide-y divide-line border-y border-line">
      {markets.map((m) => {
        const shown = open === m.id;
        const expanded = Boolean(more[m.id]);
        const visible = expanded || m.lines.length <= m.preview ? m.lines : m.lines.slice(0, m.preview);
        const hidden = Math.max(0, m.lines.length - visible.length);
        return (
          <li key={m.id}>
            <button
              type="button"
              className="flex min-h-14 w-full items-center justify-between gap-3 px-1 py-3 text-left"
              onClick={() => setOpen(shown ? null : m.id)}
              aria-expanded={shown}
            >
              <span className="text-[15px] font-medium text-ink">{m.title}</span>
              <span className="flex items-center gap-2">
                <span className="sgp-badge">SGP</span>
                <ChevronDown
                  className={cn("size-4 text-muted transition-transform", shown && "rotate-180")}
                  strokeWidth={1.75}
                />
              </span>
            </button>
            {shown ? (
              m.lines.length ? (
                <div className="border-t border-line bg-card pb-2">
                  <MarketBody
                    market={m}
                    lines={visible}
                    selected={selected}
                    legs={legs}
                    sgp={sgp}
                    onTap={onTap}
                    altsOpen={altsOpen}
                    setAltsOpen={setAltsOpen}
                    homeLogo={homeLogo}
                    awayLogo={awayLogo}
                  />
                  {hidden > 0 ? (
                    <button
                      type="button"
                      className="mx-auto flex min-h-11 items-center justify-center gap-1 px-3 text-sm font-medium text-ink"
                      onClick={() => setMore((prev) => ({ ...prev, [m.id]: true }))}
                    >
                      More
                      <ChevronDown className="size-4 text-muted" strokeWidth={1.75} />
                    </button>
                  ) : null}
                </div>
              ) : (
                <p className="border-t border-line bg-card px-3 py-3 text-sm text-muted">
                  {researchLoading
                    ? "Filling the roster from ESPN…"
                    : "Photograph this market on Hard Rock. We fill the live number from the photo."}
                </p>
              )
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function MarketBody({
  market,
  lines,
  selected,
  legs,
  sgp,
  onTap,
  altsOpen,
  setAltsOpen,
  homeLogo,
  awayLogo,
}: {
  market: SheetMarket;
  lines: SheetLine[];
  selected: ScanRow | null;
  legs: ParlayPick[];
  sgp: boolean;
  onTap: (row: ScanRow | undefined) => void;
  altsOpen: Record<string, boolean>;
  setAltsOpen: (next: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
  homeLogo?: string;
  awayLogo?: string;
}) {
  if (market.kind === "ml") {
    return (
      <ul>
        {lines.map((line) => (
          <li key={line.label} className="flex items-center justify-between gap-3 px-3 py-2">
            <p className="min-w-0 text-sm font-medium text-ink">{line.label}</p>
            <div className="w-32 shrink-0">
              <OddsCell row={line.single} selected={selected} legs={legs} sgp={sgp} onTap={onTap} badge={null} />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (market.kind === "spread-grid") {
    return (
      <div className="px-3 pb-1 pt-2">
        <div className="mb-2 grid grid-cols-2 gap-2">
          <p className="stamp text-center text-faint">{market.leftHeader}</p>
          <p className="stamp text-center text-faint">{market.rightHeader}</p>
        </div>
        <ul className="space-y-2">
          {lines.map((line) => (
            <li key={line.label} className="grid grid-cols-2 gap-2">
              <OddsCell
                row={line.left}
                selected={selected}
                legs={legs}
                sgp={sgp}
                onTap={onTap}
                badge={spreadBadge(line.left)}
              />
              <OddsCell
                row={line.right}
                selected={selected}
                legs={legs}
                sgp={sgp}
                onTap={onTap}
                badge={spreadBadge(line.right)}
              />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (market.kind === "total-ladder") {
    return (
      <div className="px-3 pb-1 pt-2">
        <div className="mb-2 grid grid-cols-[3rem_1fr_1fr] gap-2">
          <p />
          <p className="stamp text-center text-faint">{market.leftHeader}</p>
          <p className="stamp text-center text-faint">{market.rightHeader}</p>
        </div>
        <ul className="space-y-2">
          {lines.map((line) => (
            <li key={line.label} className="grid grid-cols-[3rem_1fr_1fr] items-center gap-2">
              <p className="text-sm font-medium tabular-nums text-ink">{line.label}</p>
              <OddsCell row={line.left} selected={selected} legs={legs} sgp={sgp} onTap={onTap} badge={null} />
              <OddsCell row={line.right} selected={selected} legs={legs} sgp={sgp} onTap={onTap} badge={null} />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (market.kind === "player-yes") {
    return (
      <div className="px-2 pb-1 pt-2">
        <p className="stamp mb-2 pr-1 text-right text-faint">{market.leftHeader}</p>
        <ul className="space-y-3">
          {lines.map((line) => (
            <li key={line.label} className="grid grid-cols-[minmax(0,1fr)_minmax(6.5rem,8rem)] items-center gap-2">
              <PlayerName line={line} homeLogo={homeLogo} awayLogo={awayLogo} />
              <OddsCell
                row={line.single}
                selected={selected}
                legs={legs}
                sgp={sgp}
                onTap={onTap}
                badge={ouBadge("over", line.single?.point)}
              />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const anyAlts = lines.some((l) => l.alts && l.alts.length > 0);
  const cols = anyAlts
    ? "grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1fr)]"
    : "grid-cols-2";

  return (
    <div className="px-2 pb-1 pt-2">
      <div className={cn("mb-2 grid gap-2", cols)}>
        {anyAlts ? <p /> : null}
        <p className="stamp text-center text-faint">{market.leftHeader}</p>
        <p className="stamp text-center text-faint">{market.rightHeader}</p>
      </div>
      <ul className="space-y-3">
        {lines.map((line) => (
          <PlayerOuRow
            key={line.label}
            marketId={market.id}
            line={line}
            showChevronCol={anyAlts}
            selected={selected}
            legs={legs}
            sgp={sgp}
            onTap={onTap}
            altsOpen={altsOpen}
            setAltsOpen={setAltsOpen}
            homeLogo={homeLogo}
            awayLogo={awayLogo}
          />
        ))}
      </ul>
    </div>
  );
}

function PlayerOuRow({
  marketId,
  line,
  showChevronCol,
  selected,
  legs,
  sgp,
  onTap,
  altsOpen,
  setAltsOpen,
  homeLogo,
  awayLogo,
}: {
  marketId: string;
  line: SheetLine;
  showChevronCol: boolean;
  selected: ScanRow | null;
  legs: ParlayPick[];
  sgp: boolean;
  onTap: (row: ScanRow | undefined) => void;
  altsOpen: Record<string, boolean>;
  setAltsOpen: (next: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
  homeLogo?: string;
  awayLogo?: string;
}) {
  const key = `${marketId}:${line.label}`;
  const hasAlts = Boolean(line.alts?.length);
  const expanded = Boolean(altsOpen[key]);
  const cols = showChevronCol
    ? "grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1fr)]"
    : "grid-cols-2";
  return (
    <li className="space-y-1.5">
      <div className={cn("grid items-center gap-2", cols)}>
        {showChevronCol ? (
          hasAlts ? (
            <button
              type="button"
              className="grid size-11 place-items-center text-muted"
              aria-expanded={expanded}
              aria-label={`More ${line.label} lines`}
              onClick={() => setAltsOpen((prev) => ({ ...prev, [key]: !prev[key] }))}
            >
              <ChevronsUpDown className="size-4" strokeWidth={1.75} />
            </button>
          ) : (
            <span />
          )
        ) : null}
        <div className={showChevronCol ? "col-span-2 min-w-0" : "col-span-2 min-w-0"}>
          <PlayerName line={line} homeLogo={homeLogo} awayLogo={awayLogo} />
        </div>
      </div>
      <div className={cn("grid items-stretch gap-2", cols)}>
        {showChevronCol ? <span /> : null}
        <OddsCell
          row={line.left}
          selected={selected}
          legs={legs}
          sgp={sgp}
          onTap={onTap}
          badge={ouBadge("over", line.left?.point)}
        />
        <OddsCell
          row={line.right}
          selected={selected}
          legs={legs}
          sgp={sgp}
          onTap={onTap}
          badge={ouBadge("under", line.right?.point)}
        />
      </div>
      {expanded && hasAlts
        ? line.alts!.map((alt, i) => (
            <div key={`${key}-alt-${i}`} className={cn("grid items-stretch gap-2", cols)}>
              {showChevronCol ? <span /> : null}
              <OddsCell
                row={alt.left}
                selected={selected}
                legs={legs}
                sgp={sgp}
                onTap={onTap}
                badge={ouBadge("over", alt.left?.point)}
              />
              <OddsCell
                row={alt.right}
                selected={selected}
                legs={legs}
                sgp={sgp}
                onTap={onTap}
                badge={ouBadge("under", alt.right?.point)}
              />
            </div>
          ))
        : null}
    </li>
  );
}

function PlayerName({
  line,
  homeLogo,
  awayLogo,
}: {
  line: SheetLine;
  homeLogo?: string;
  awayLogo?: string;
}) {
  const [broken, setBroken] = useState(false);
  const src = line.player?.headshot;
  const letter = line.label.slice(0, 1).toUpperCase();
  const mark = line.player?.homeAway === "away" ? awayLogo : homeLogo;
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="relative size-10 shrink-0">
        {src && !broken ? (
          <img src={src} alt="" className="size-10 rounded-full object-cover" onError={() => setBroken(true)} />
        ) : (
          <span className="grid size-10 place-items-center rounded-full bg-wash text-sm font-medium text-emerald-500">
            {letter}
          </span>
        )}
        {mark ? (
          <img
            src={mark}
            alt=""
            className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-card object-contain ring-1 ring-card"
          />
        ) : null}
      </span>
      <p className="min-w-0 text-sm font-medium leading-snug text-ink">{line.label}</p>
    </div>
  );
}

function TeamMark({
  sport,
  abbr,
  name,
  logo,
}: {
  sport: string;
  abbr?: string;
  name: string;
  logo?: string;
}) {
  const [broken, setBroken] = useState(false);
  const src = logo || espnLogoUrl(sport, abbr);
  const letter = (abbr || name).slice(0, 3).toUpperCase();
  return (
    <div className="flex flex-col items-center text-center">
      {src && !broken ? (
        <img src={src} alt="" className="size-24 object-contain" onError={() => setBroken(true)} />
      ) : (
        <span className="grid size-24 place-items-center rounded-full bg-wash font-display text-2xl text-emerald-500">
          {letter}
        </span>
      )}
      <p className="mt-2 text-lg font-medium text-ink">{name}</p>
    </div>
  );
}

function lineLabel(row: ScanRow): string | null {
  if (row.marketType === "spread" && row.point != null) {
    return row.point > 0 ? `+${row.point}` : String(row.point);
  }
  if (row.marketType === "total" && row.point != null) {
    return `${row.side === "under" ? "U" : "O"} ${row.point}`;
  }
  return null;
}

function spreadBadge(row?: ScanRow): string | null {
  if (!row || row.point == null) return null;
  return row.point > 0 ? `+${row.point}` : String(row.point);
}

function ouBadge(side: "over" | "under", point?: number): string {
  const mark = side === "over" ? "O" : "U";
  return point == null ? mark : `${mark} ${point}`;
}

function sheetWhen(iso: string): string {
  if (!iso) return "Time TBA";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "Time TBA";
  const time = d
    .toLocaleString("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/\s/g, "")
    .toLowerCase();
  if (isTodayEt(iso)) return `Today, ${time} ET`;
  return formatKickoff(iso, true);
}
