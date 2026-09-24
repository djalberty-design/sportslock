import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useDeskDecision } from "@/lib/market/use-board";
import { useDeskStore } from "@/lib/desk-store";
import {
  Scale,
  TrendingUp,
  ShieldCheck,
  Zap,
  ExternalLink,
  Plus,
  Check,
  DollarSign,
  ArrowRight,
  Sparkles,
  Layers,
  ArrowLeftRight,
  Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  scanArbitrageOpportunities,
  buildLineShoppingMatrix,
  SPORTSBOOKS,
  calculateArbitrage,
  type SportsbookKey,
  type ArbitrageOpportunity,
} from "@/lib/arbitrage";
import { formatAmerican } from "@/lib/market/hit-pct";
import { useParlaySlip, isLegSelected } from "@/lib/parlay-slip";

export const Route = createFileRoute("/arbitrage")({
  component: ArbitragePage,
});

function ArbitragePage() {
  const { scan } = useDeskDecision();
  const totalBankroll = useDeskStore((s) => s.totalBankroll);
  const placePaper = useDeskStore((s) => s.placePaperTicket);
  const { legs: slipLegs, addLeg, removeLeg } = useParlaySlip();

  const [activeTab, setActiveTab] = useState<"arbitrage" | "shopping">("arbitrage");
  const [totalCapital, setTotalCapital] = useState<number>(totalBankroll || 1000);
  const [marketFilter, setMarketFilter] = useState<string>("all");
  const [loggedArbs, setLoggedArbs] = useState<Record<string, boolean>>({});

  const rows = scan?.rows || [];

  // Compute live opportunities
  const opportunities = useMemo(() => {
    return scanArbitrageOpportunities(rows, totalCapital);
  }, [rows, totalCapital]);

  const shoppingMatrix = useMemo(() => {
    return buildLineShoppingMatrix(rows);
  }, [rows]);

  const filteredOpps = useMemo(() => {
    if (marketFilter === "all") return opportunities;
    if (marketFilter === "middle") return opportunities.filter((o) => o.isMiddle);
    if (marketFilter === "pure") return opportunities.filter((o) => o.isArbitrage && !o.isMiddle);
    return opportunities.filter((o) => o.marketType === marketFilter);
  }, [opportunities, marketFilter]);

  const filteredShopping = useMemo(() => {
    if (marketFilter === "all") return shoppingMatrix;
    return shoppingMatrix.filter((s) => s.marketType === marketFilter);
  }, [shoppingMatrix, marketFilter]);

  // Log arb pair to paper ledger
  const handleLogArb = (opp: ArbitrageOpportunity) => {
    const calc = opp.calculation;

    // Log Side A
    placePaper({
      kind: "main",
      description: `[ARB 1/2] ${opp.sideA.selection} (${opp.sideA.bookName})`,
      stake: calc.stakeA,
      price: opp.sideA.price,
      status: "open",
      gameIds: [opp.eventId],
      fastLog: true,
      sport: opp.sport,
    });

    // Log Side B
    placePaper({
      kind: "main",
      description: `[ARB 2/2] ${opp.sideB.selection} (${opp.sideB.bookName})`,
      stake: calc.stakeB,
      price: opp.sideB.price,
      status: "open",
      gameIds: [opp.eventId],
      fastLog: true,
      sport: opp.sport,
    });

    setLoggedArbs((prev) => ({ ...prev, [opp.id]: true }));
  };

  const pureArbCount = opportunities.filter((o) => o.isArbitrage).length;
  const middleCount = opportunities.filter((o) => o.isMiddle).length;
  const bestRoi = opportunities.length > 0 ? Math.max(...opportunities.map((o) => o.roiPct)) : 0;

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-4 py-6 space-y-6 animate-in fade-in duration-500">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-primary uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
              <Scale className="size-3.5" /> Market Superiority Engine
            </span>
            <span className="text-[10px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded">
              Hard Rock FL Synchronized
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-ink tracking-tight mt-1">
            Real-Time Arbitrage & Line Shopping
          </h1>
          <p className="text-xs sm:text-sm text-muted max-w-2xl mt-0.5">
            Exploit price discrepancies across major sportsbooks. Lock in guaranteed mathematical profit via two-way arbitrage, leverage middle windows, and shop the optimal line across Hard Rock, DraftKings, FanDuel, BetMGM, and Pinnacle.
          </p>
        </div>

        {/* Total Capital Input for Arb Hedge Sizing */}
        <div className="bg-panel border border-line rounded-xl p-3 flex flex-col gap-1.5 min-w-[200px] shrink-0">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center justify-between">
            <span>Arbitrage Bankroll</span>
            <span className="text-primary font-mono">${totalCapital}</span>
          </label>
          <div className="relative">
            <DollarSign className="size-4 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="number"
              min="50"
              step="100"
              value={totalCapital}
              onChange={(e) => setTotalCapital(Math.max(10, Number(e.target.value) || 100))}
              className="w-full bg-obsidian border border-line rounded-lg pl-8 pr-3 py-1.5 text-ink font-mono text-sm font-bold focus:outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* Intelligence KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-panel border border-line rounded-xl p-3 flex items-center gap-3">
          <div className="size-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Percent className="size-4 text-emerald-400" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono text-muted block">Risk-Free Arbs</span>
            <span className="text-lg font-mono font-bold text-emerald-400">{pureArbCount} Found</span>
          </div>
        </div>

        <div className="bg-panel border border-line rounded-xl p-3 flex items-center gap-3">
          <div className="size-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
            <ArrowLeftRight className="size-4 text-amber-400" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono text-muted block">Middle Windows</span>
            <span className="text-lg font-mono font-bold text-amber-400">{middleCount} Active</span>
          </div>
        </div>

        <div className="bg-panel border border-line rounded-xl p-3 flex items-center gap-3">
          <div className="size-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
            <TrendingUp className="size-4 text-primary" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono text-muted block">Max Return on Capital</span>
            <span className="text-lg font-mono font-bold text-primary">
              {bestRoi > 0 ? `+${bestRoi.toFixed(2)}%` : "0.0%"}
            </span>
          </div>
        </div>

        <div className="bg-panel border border-line rounded-xl p-3 flex items-center gap-3">
          <div className="size-9 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center shrink-0">
            <ShieldCheck className="size-4 text-purple-400" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono text-muted block">Books Monitored</span>
            <span className="text-lg font-mono font-bold text-ink">6 Sportsbooks</span>
          </div>
        </div>
      </div>

      {/* Main Mode Tabs & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("arbitrage")}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold font-mono transition-all flex items-center gap-2 border",
              activeTab === "arbitrage"
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-panel border-line text-muted hover:border-primary/40 hover:text-ink"
            )}
          >
            <Scale className="size-3.5" />
            <span>Arbitrage & Middles ({opportunities.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("shopping")}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold font-mono transition-all flex items-center gap-2 border",
              activeTab === "shopping"
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-panel border-line text-muted hover:border-primary/40 hover:text-ink"
            )}
          >
            <Layers className="size-3.5" />
            <span>Line Shopping Matrix ({shoppingMatrix.length})</span>
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { key: "all", label: "All Markets" },
            { key: "pure", label: "Pure Arb Only" },
            { key: "middle", label: "Middles Only" },
            { key: "ml", label: "Moneylines" },
            { key: "spread", label: "Spreads" },
            { key: "total", label: "Totals" },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setMarketFilter(key)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[10px] font-mono font-bold border transition-colors shrink-0",
                marketFilter === key
                  ? "bg-primary/20 text-primary border-primary/40"
                  : "bg-panel border-line text-muted hover:text-ink"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Arbitrage & Middle Opportunities List */}
      {activeTab === "arbitrage" && (
        <div className="space-y-4">
          {filteredOpps.length === 0 ? (
            <div className="text-center p-12 bg-panel border border-dashed border-line rounded-2xl text-muted text-sm flex flex-col items-center gap-3">
              <Scale className="size-8 text-muted/60" />
              <p>No active arbitrage opportunities currently meet the threshold for this market filter.</p>
              <p className="text-xs text-muted/70 max-w-md">
                SportsLock automatically scrapes and re-evaluates all book feeds every 30 seconds. Check back when games approach kickoff and market volume accelerates.
              </p>
            </div>
          ) : (
            filteredOpps.map((opp) => {
              const calc = opp.calculation;
              const isLogged = loggedArbs[opp.id];

              return (
                <div
                  key={opp.id}
                  className="rounded-2xl border border-line bg-panel p-4 space-y-4 transition-all hover:border-line/90 shadow-sm"
                >
                  {/* Top Bar: Event, Sport, ROI Tag */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold uppercase text-muted bg-line/50 px-2 py-0.5 rounded">
                        {opp.sport.replace(/^[a-z]+_/, "").toUpperCase()}
                      </span>
                      <span className="text-sm font-bold text-ink">{opp.eventDescription}</span>
                      <span className="text-xs font-mono text-muted uppercase">· {opp.marketType}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {opp.isMiddle && (
                        <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded flex items-center gap-1">
                          ⚡ Middle: {opp.middlePoints} pts
                        </span>
                      )}
                      <span
                        className={cn(
                          "text-xs font-mono font-bold px-2.5 py-1 rounded-md border",
                          opp.isArbitrage
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                        )}
                      >
                        {opp.roiPct >= 0 ? `+${opp.roiPct}% ROI` : "Discrepancy"}
                      </span>
                    </div>
                  </div>

                  {/* Dual Sides Hedge Split Box */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Side A */}
                    <div className="bg-obsidian border border-line/70 rounded-xl p-3.5 flex flex-col justify-between space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span
                              className={cn(
                                "text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase",
                                SPORTSBOOKS[opp.sideA.book]?.badgeBg || "bg-line border-line text-muted",
                                SPORTSBOOKS[opp.sideA.book]?.color || "text-ink"
                              )}
                            >
                              {opp.sideA.bookName}
                            </span>
                            {opp.sideA.book === "hardrock" && (
                              <span className="text-[9px] font-mono text-emerald-400 font-bold">FL Legal</span>
                            )}
                          </div>
                          <span className="text-sm font-bold text-ink">{opp.sideA.selection}</span>
                        </div>
                        <span className="text-base font-mono font-bold text-primary">
                          {formatAmerican(opp.sideA.price)}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-line/50 flex items-center justify-between text-xs font-mono">
                        <div>
                          <span className="text-[10px] text-muted block uppercase">Optimal Stake</span>
                          <span className="font-bold text-ink">${calc.stakeA.toFixed(2)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-muted block uppercase">Payout</span>
                          <span className="font-bold text-emerald-400">${calc.returnA.toFixed(2)}</span>
                        </div>
                      </div>

                      {opp.sideA.url && (
                        <a
                          href={opp.sideA.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold text-muted hover:text-ink bg-panel border border-line hover:border-primary/40 transition-colors"
                        >
                          <span>Open in {opp.sideA.bookName}</span>
                          <ExternalLink className="size-2.5" />
                        </a>
                      )}
                    </div>

                    {/* Side B */}
                    <div className="bg-obsidian border border-line/70 rounded-xl p-3.5 flex flex-col justify-between space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span
                              className={cn(
                                "text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase",
                                SPORTSBOOKS[opp.sideB.book]?.badgeBg || "bg-line border-line text-muted",
                                SPORTSBOOKS[opp.sideB.book]?.color || "text-ink"
                              )}
                            >
                              {opp.sideB.bookName}
                            </span>
                            {opp.sideB.book === "hardrock" && (
                              <span className="text-[9px] font-mono text-emerald-400 font-bold">FL Legal</span>
                            )}
                          </div>
                          <span className="text-sm font-bold text-ink">{opp.sideB.selection}</span>
                        </div>
                        <span className="text-base font-mono font-bold text-primary">
                          {formatAmerican(opp.sideB.price)}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-line/50 flex items-center justify-between text-xs font-mono">
                        <div>
                          <span className="text-[10px] text-muted block uppercase">Optimal Stake</span>
                          <span className="font-bold text-ink">${calc.stakeB.toFixed(2)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-muted block uppercase">Payout</span>
                          <span className="font-bold text-emerald-400">${calc.returnB.toFixed(2)}</span>
                        </div>
                      </div>

                      {opp.sideB.url && (
                        <a
                          href={opp.sideB.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold text-muted hover:text-ink bg-panel border border-line hover:border-primary/40 transition-colors"
                        >
                          <span>Open in {opp.sideB.bookName}</span>
                          <ExternalLink className="size-2.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Guaranteed Return & Action Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-3">
                      <div className="bg-obsidian border border-line/60 rounded-lg px-3 py-1.5">
                        <span className="text-[9px] uppercase tracking-wider text-muted block">Locked-In Profit</span>
                        <span className="text-sm font-mono font-bold text-emerald-400">
                          +${calc.guaranteedProfit.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-xs text-muted">
                        Total Outlay: <strong className="text-ink font-mono">${totalCapital}</strong>
                        {opp.isMiddle && (
                          <span className="block text-[11px] text-amber-300 font-medium">
                            Middle hits: <strong className="font-mono text-emerald-400">+${(calc.returnA + calc.returnB - totalCapital).toFixed(2)}</strong> double win!
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleLogArb(opp)}
                      disabled={isLogged}
                      className={cn(
                        "flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                        isLogged
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                      )}
                    >
                      {isLogged ? (
                        <>
                          <Check className="size-3.5" />
                          <span>Hedge Logged to Desk</span>
                        </>
                      ) : (
                        <>
                          <Plus className="size-3.5" />
                          <span>Log Hedge Pair to Ledger</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Line Shopping Comparison Matrix */}
      {activeTab === "shopping" && (
        <div className="bg-panel border border-line rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-line bg-obsidian/40 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-ink">Multi-Book Odds Matrix</h2>
              <p className="text-[11px] text-muted">
                Compare prices across books to get the highest payout. Green highlights designate the best available market price.
              </p>
            </div>
            <span className="text-[10px] font-mono text-muted uppercase font-bold">
              {filteredShopping.length} Markets
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-obsidian border-b border-line text-[10px] font-mono uppercase text-muted">
                <tr>
                  <th className="py-2.5 px-3">Selection & Matchup</th>
                  <th className="py-2.5 px-2 text-center text-amber-400 font-bold">Hard Rock (FL)</th>
                  <th className="py-2.5 px-2 text-center">DraftKings</th>
                  <th className="py-2.5 px-2 text-center">FanDuel</th>
                  <th className="py-2.5 px-2 text-center">BetMGM</th>
                  <th className="py-2.5 px-2 text-center text-purple-400">Pinnacle</th>
                  <th className="py-2.5 px-3 text-right">Edge / Spread</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {filteredShopping.map((row) => {
                  const bHardRock = row.books.hardrock;
                  const bDK = row.books.draftkings;
                  const bFD = row.books.fanduel;
                  const bMGM = row.books.betmgm;
                  const bPinn = row.books.pinnacle;

                  const isHrBest = row.bestBook === "hardrock";

                  return (
                    <tr key={row.id} className="hover:bg-line/20 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-ink">{row.selection}</div>
                        <div className="text-[10px] text-muted">
                          {row.eventDescription} · <span className="uppercase">{row.marketType}</span>
                        </div>
                      </td>

                      {/* Hard Rock */}
                      <td className="py-3 px-2 text-center">
                        {bHardRock ? (
                          <div className={cn(
                            "inline-flex flex-col items-center px-2 py-1 rounded font-mono font-bold",
                            isHrBest
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "text-ink"
                          )}>
                            <span>{formatAmerican(bHardRock.price)}</span>
                            {isHrBest && <span className="text-[8px] uppercase">Best</span>}
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      {/* DraftKings */}
                      <td className="py-3 px-2 text-center">
                        {bDK ? (
                          <div className={cn(
                            "inline-flex flex-col items-center px-2 py-1 rounded font-mono font-bold",
                            row.bestBook === "draftkings"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "text-ink"
                          )}>
                            <span>{formatAmerican(bDK.price)}</span>
                            {row.bestBook === "draftkings" && <span className="text-[8px] uppercase">Best</span>}
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      {/* FanDuel */}
                      <td className="py-3 px-2 text-center">
                        {bFD ? (
                          <div className={cn(
                            "inline-flex flex-col items-center px-2 py-1 rounded font-mono font-bold",
                            row.bestBook === "fanduel"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "text-ink"
                          )}>
                            <span>{formatAmerican(bFD.price)}</span>
                            {row.bestBook === "fanduel" && <span className="text-[8px] uppercase">Best</span>}
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      {/* BetMGM */}
                      <td className="py-3 px-2 text-center">
                        {bMGM ? (
                          <div className={cn(
                            "inline-flex flex-col items-center px-2 py-1 rounded font-mono font-bold",
                            row.bestBook === "betmgm"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "text-ink"
                          )}>
                            <span>{formatAmerican(bMGM.price)}</span>
                            {row.bestBook === "betmgm" && <span className="text-[8px] uppercase">Best</span>}
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      {/* Pinnacle */}
                      <td className="py-3 px-2 text-center">
                        {bPinn ? (
                          <div className={cn(
                            "inline-flex flex-col items-center px-2 py-1 rounded font-mono font-bold",
                            row.bestBook === "pinnacle"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "text-purple-300"
                          )}>
                            <span>{formatAmerican(bPinn.price)}</span>
                            {row.bestBook === "pinnacle" && <span className="text-[8px] uppercase">Sharp</span>}
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      {/* Discrepancy */}
                      <td className="py-3 px-3 text-right">
                        <span className="font-mono font-bold text-amber-400">
                          {row.centsDiscrepancy}¢ diff
                        </span>
                        <div className="text-[9px] text-muted">
                          Best: {SPORTSBOOKS[row.bestBook]?.shortName}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
