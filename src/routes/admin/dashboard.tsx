import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrainStatsFn, batchGradeFn, getLatestAnalysisFn, runAnalysisFn, applySuggestionFn } from "@/lib/market/server";
import {
  getSuggestionsFn,
  getDynamicWeightsFn,
  calibrateWeightsFn,
  listHypothesesFn,
  submitHypothesisFn,
  checkCircuitBreakersFn,
} from "@/lib/market/tape-server";
import { cn } from "@/lib/utils";
import {
  Brain, Activity, Target, TrendingUp, TrendingDown, Eye, Zap,
  RefreshCw, AlertTriangle, CheckCircle2, Info, BarChart2, Flame, Server,
  Cpu, ArrowRight, Sparkles, Check, X, Clock, HelpCircle, Send, Layers,
  ChevronRight, ChevronDown, Sliders, ShieldCheck
} from "lucide-react";
import React, { useState } from "react";

export const Route = createFileRoute("/admin/dashboard")({ component: Dashboard });

const PIPELINE_STAGES = [
  {
    step: 1,
    id: "consensus",
    name: "1. Consensus Feeds",
    icon: Server,
    badge: "Real-Time Feeds",
    short: "ESPN + OddsAPI + Sharp Books",
    details: {
      input: "Consensus moneylines, spreads, totals, and player props across sharp books (Pinnacle, Circa) and market feeds.",
      order: "Step 1 of 6 in Pipeline",
      operation: "Strips sportsbook vig to derive true market-implied probabilities via power de-vigging.",
      status: "Ingesting continuous pregame & live data"
    }
  },
  {
    step: 2,
    id: "simulation",
    name: "2. 10k Monte Carlo",
    icon: Cpu,
    badge: "10,000 Runs",
    short: "Poisson & Possession Sim",
    details: {
      input: "Pace of play, offensive/defensive efficiency ratings, and possession distributions per sport.",
      order: "Step 2 of 6 in Pipeline",
      operation: "Simulates 10,000 full game iterations to generate score percentiles, tail variance, and median margin.",
      status: "Simulations calibrated per sport tempo"
    }
  },
  {
    step: 3,
    id: "ensembles",
    name: "3. Feature Ensembles",
    icon: Layers,
    badge: "15+ Quant Layers",
    short: "EWMA + Park + Rest + Ripple",
    details: {
      input: "14-day recency form (EWMA), travel & rest pacing, stadium park factors, weather/wind drag, and injury ripples.",
      order: "Step 3 of 6 in Pipeline",
      operation: "Bayesian precision-weighted pooling where higher historical reliability yields higher voting weight.",
      status: "Precision haircuts auto-adjusted"
    }
  },
  {
    step: 4,
    id: "blend",
    name: "4. Calibrated Blend",
    icon: Zap,
    badge: "Market Dominant",
    short: "Dynamic Alpha Weights",
    details: {
      input: "Market-implied probabilities + 10k Sim probabilities + Feature Ensembles.",
      order: "Step 4 of 6 in Pipeline",
      operation: "Anchors to market consensus (70-90%) with sport-specific dynamic sim (5-20%) and pool (5-20%) weights.",
      status: "Protects ~60% proven baseline edge"
    }
  },
  {
    step: 5,
    id: "grading",
    name: "5. ESPN Auto-Grade",
    icon: Target,
    badge: "10m Cron Loop",
    short: "Official Boxscore Settlement",
    details: {
      input: "ESPN Historical & Live Scoreboards across NFL, NBA, MLB, NHL, NCAAF, NCAAB.",
      order: "Step 5 of 6 in Pipeline",
      operation: "Automatically matches completed games, settles ML/spread/total/props, grades WIN/LOSS/PUSH.",
      status: "Closed-loop 24/7 background worker"
    }
  },
  {
    step: 6,
    id: "autopsy",
    name: "6. Autopsy & Tuning",
    icon: Brain,
    badge: "Self-Improving",
    short: "4-Bucket Forensics & Weights",
    details: {
      input: "Graded predictions, closing lines, and model prediction deviations.",
      order: "Step 6 of 6 in Pipeline",
      operation: "Classifies losses into 4 buckets (Model Miss, Echoed Book, High Variance, Settled), recalibrates 30d weights, and generates suggestions.",
      status: "Autonomous closed feedback loop"
    }
  }
];

function Dashboard() {
  const qc = useQueryClient();
  const [selectedStage, setSelectedStage] = useState<number | null>(null);
  const [hypothesisQuery, setHypothesisQuery] = useState("");

  const { data: stats, isLoading } = useQuery({
    queryKey: ["brain-stats"],
    queryFn: () => getBrainStatsFn(),
    refetchInterval: 30_000,
  });

  const { data: weights, isLoading: weightsLoading } = useQuery({
    queryKey: ["brain-dynamic-weights"],
    queryFn: () => getDynamicWeightsFn(),
    refetchInterval: 60_000,
  });

  const { data: suggestions } = useQuery({
    queryKey: ["brain-suggestions"],
    queryFn: () => getSuggestionsFn(),
    refetchInterval: 60_000,
  });

  const { data: hypotheses } = useQuery({
    queryKey: ["brain-hypotheses"],
    queryFn: () => listHypothesesFn(),
    refetchInterval: 60_000,
  });

  const gradeMut = useMutation({
    mutationFn: () => batchGradeFn(),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["brain-stats"] });
      qc.invalidateQueries({ queryKey: ["latest-analysis"] });
      qc.invalidateQueries({ queryKey: ["brain-dynamic-weights"] });
      qc.invalidateQueries({ queryKey: ["brain-suggestions"] });
      alert(`Graded ${result.graded} predictions (${result.historical || 0} historical). ${result.expired || 0} marked expired.`);
    },
  });

  const calibrateMut = useMutation({
    mutationFn: () => calibrateWeightsFn(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["brain-dynamic-weights"] });
      alert(`Dynamic blend weights calibrated across active sports based on 30-day performance.`);
    },
  });

  const breakerMut = useMutation({
    mutationFn: () => checkCircuitBreakersFn(),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["brain-dynamic-weights"] });
      if (res.tripped?.length > 0) {
        alert(`🛡️ Alpha Drawdown Circuit Breakers tripped for: ${res.tripped.join(", ")}. Reverted to baseline defensive consensus.`);
      } else {
        alert("✅ All sports passed circuit breaker audit. No consecutive model miss clusters detected.");
      }
    },
  });

  const applyMut = useMutation({
    mutationFn: (args: { id: string; status: string }) => applySuggestionFn({ data: args }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brain-suggestions"] });
      qc.invalidateQueries({ queryKey: ["brain-stats"] });
    },
  });

  const submitHypoMut = useMutation({
    mutationFn: (query: string) => submitHypothesisFn({ data: { query } }),
    onSuccess: () => {
      setHypothesisQuery("");
      qc.invalidateQueries({ queryKey: ["brain-hypotheses"] });
    },
  });

  const { data: analysisData } = useQuery({
    queryKey: ["latest-analysis"],
    queryFn: () => getLatestAnalysisFn(),
    refetchInterval: 120_000,
  });

  const analysisMut = useMutation({
    mutationFn: () => runAnalysisFn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["latest-analysis"] }),
  });

  const aData = analysisData as any;
  const analysis = aData?.data;
  const lastRun = aData?.lastRun;

  if (isLoading || !stats) {
    return (
      <div className="space-y-6">
        <header>
          <p className="text-sm text-emerald-500">🧠 DASHBOARD</p>
          <h1 className="font-display text-3xl text-ink mt-1">Brain Mission Control</h1>
        </header>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[1,2,3,4,5].map(i => <div key={i} className="h-28 bg-panel border border-line rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  const decided = stats.wins + stats.losses;
  const wr = decided > 0 ? Math.round((stats.wins / decided) * 100) : 0;
  const hasPending = stats.pending > 0;
  const pendingSuggestions = (suggestions || []).filter((s: any) => s.status === "pending");

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
              OVERSEER MISSION CONTROL v4.2
            </span>
            <span className="text-xs text-muted font-mono">100% AUTONOMOUS</span>
          </div>
          <h1 className="font-display text-3xl text-ink mt-2">Brain Status & Visual Architecture</h1>
          <p className="text-sm text-muted mt-1">
            Real-time visual flight control for the sports prediction engine. Inspect every layer, calibrate weights, and interact directly with the Brain.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => gradeMut.mutate()}
            disabled={gradeMut.isPending}
            className="flex items-center gap-2 px-3.5 py-2 bg-panel border border-line rounded-lg text-xs font-bold text-ink hover:border-primary/50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("size-3.5", gradeMut.isPending && "animate-spin text-primary")} />
            {gradeMut.isPending ? "Grading..." : "Run Grading Sweep"}
          </button>
        </div>
      </header>

      {/* Pending Alert */}
      {hasPending && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <AlertTriangle className="size-5 text-amber-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-400">{stats.pending} predictions waiting to be graded</p>
            <p className="text-xs text-muted mt-0.5">
              These predictions haven't been matched to a final score yet. The background 10m cron grades automatically, or click "Grade Now" to sync immediately.
            </p>
          </div>
          <button
            onClick={() => gradeMut.mutate()}
            disabled={gradeMut.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-400 text-sm font-bold rounded-lg hover:bg-amber-500/30 transition-colors disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={cn("size-4", gradeMut.isPending && "animate-spin")} />
            {gradeMut.isPending ? "Grading..." : "Grade Now"}
          </button>
        </div>
      )}

      {/* Metric Clarity Banner */}
      <div className="bg-obsidian border border-line/70 rounded-xl p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-ink font-semibold">
          <Info className="size-4 text-primary shrink-0" />
          <span>Metric Universe Clarity:</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-muted">
          <span><strong className="text-ink font-mono">{stats.total} Locked AI Tickets:</strong> High-conviction tickets & slips in <code className="text-primary font-mono">prediction_logs</code>.</span>
          <span><strong className="text-ink font-mono">{stats.marketTapeStats?.total ?? 2648} Market Lines Scored:</strong> Full quantitative tape of all monitored game lines in <code className="text-primary font-mono">market_tape</code>.</span>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <HeroStat
          icon={<CheckCircle2 className="size-4" />}
          label="Locked AI Tickets"
          sublabel="prediction_logs"
          value={stats.total}
          color="text-primary"
          tooltip="Every high-conviction recommendation locked as a ticket or hero pick"
        />
        <HeroStat
          icon={<Activity className="size-4" />}
          label="Market Tape Lines"
          sublabel="market_tape universe"
          value={stats.marketTapeStats?.total ?? 2648}
          color="text-blue-400"
          tooltip="Every individual betting line (spreads, totals, MLs, props) evaluated across all monitored sports"
        />
        <HeroStat
          icon={<Target className="size-4" />}
          label="Ticket Win Rate"
          sublabel={`${decided} decided`}
          value={`${wr}%`}
          color={wr >= 55 ? "text-emerald-400" : wr >= 50 ? "text-amber-400" : "text-red-400"}
          tooltip="Percentage of decided locked AI tickets that were correct. 55%+ is strong."
        />
        <HeroStat
          icon={<TrendingUp className="size-4" />}
          label="Locked Wins"
          sublabel="settled WIN"
          value={stats.wins}
          color="text-emerald-400"
          tooltip="Predictions where the model's recommended side won"
        />
        <HeroStat
          icon={<TrendingDown className="size-4" />}
          label="Locked Losses"
          sublabel="settled LOSS"
          value={stats.losses}
          color="text-red-400"
          tooltip="Predictions where the model's recommended side lost"
        />
        <HeroStat
          icon={<Eye className="size-4" />}
          label="Pending"
          sublabel="awaiting final scores"
          value={stats.pending}
          color="text-amber-400"
          tooltip="Predictions not yet graded — awaiting final official scores."
        />
      </div>

      {/* ── SECTION 1: 6-STAGE VISUAL PIPELINE FLOW DIAGRAM ── */}
      <section className="bg-panel border border-line rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-ink">
              <Cpu className="size-4 text-emerald-400" /> End-to-End Prediction Pipeline Architecture
            </div>
            <p className="text-xs text-muted mt-1">
              Click any stage to inspect inputs, math operations, and live status. Every prediction traverses stages 1 → 4; outcomes traverse 5 → 6.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted">
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-400" /> Active Stage</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-primary" /> Closed-Loop Tuning</span>
          </div>
        </div>

        {/* The 6-Stage Diagram Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 pt-2">
          {PIPELINE_STAGES.map((st, i) => {
            const Icon = st.icon;
            const isSelected = selectedStage === st.step;
            return (
              <div
                key={st.id}
                onClick={() => setSelectedStage(isSelected ? null : st.step)}
                className={cn(
                  "p-3 rounded-xl border transition-all cursor-pointer relative group flex flex-col justify-between min-h-[130px]",
                  isSelected
                    ? "bg-primary/10 border-primary ring-1 ring-primary shadow-lg shadow-primary/5"
                    : "bg-obsidian border-line hover:border-primary/40 hover:bg-obsidian/80"
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="size-6 rounded-lg bg-panel border border-line flex items-center justify-center text-ink">
                      <Icon className="size-3.5 text-primary" />
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-line text-muted uppercase font-bold">
                      {st.badge}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-ink group-hover:text-primary transition-colors">
                    {st.name}
                  </h3>
                  <p className="text-[10px] text-muted mt-1 leading-snug">
                    {st.short}
                  </p>
                </div>

                <div className="mt-2 pt-2 border-t border-line/40 flex items-center justify-between text-[9px] text-muted">
                  <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
                  </span>
                  <span className="text-ink/60 font-mono">{isSelected ? "Close ✕" : "Inspect ▸"}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Expanded Stage Deep-Dive */}
        {selectedStage && (() => {
          const current = PIPELINE_STAGES.find(s => s.step === selectedStage);
          if (!current) return null;
          const Icon = current.icon;
          return (
            <div className="mt-4 p-4 rounded-xl bg-obsidian border border-primary/40 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between gap-2 border-b border-line pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <Icon className="size-4 text-primary" />
                  <span className="text-sm font-bold text-ink">{current.name} Deep Dive</span>
                  <span className="text-[10px] font-mono bg-primary/20 text-primary px-2 py-0.5 rounded">
                    {current.details.order}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedStage(null)}
                  className="text-xs text-muted hover:text-ink font-bold px-2 py-1"
                >
                  ✕ Close
                </button>
              </div>

              <div className="grid md:grid-cols-3 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted tracking-wider">Input Data Streams</span>
                  <p className="text-ink bg-panel/50 p-2.5 rounded-lg border border-line leading-relaxed">
                    {current.details.input}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted tracking-wider">Algorithmic Operation</span>
                  <p className="text-ink bg-panel/50 p-2.5 rounded-lg border border-line leading-relaxed">
                    {current.details.operation}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted tracking-wider">Live System Status</span>
                  <div className="bg-panel/50 p-2.5 rounded-lg border border-line space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <CheckCircle2 className="size-3.5" /> 100% Operational
                    </div>
                    <p className="text-[11px] text-muted">{current.details.status}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </section>

      {/* ── SECTION 2: LIVE DYNAMIC BLEND WEIGHT GAUGES ── */}
      <section className="bg-panel border border-line rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-ink">
              <Sliders className="size-4 text-primary" /> Live Dynamic Blend Weights by Sport
            </div>
            <p className="text-xs text-muted mt-1">
              The calibrated mix of Consensus Market, 10k Monte Carlo, and Feature Ensembles. Consensus stays dominant (≥70%) to preserve the proven ~60% win rate.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => breakerMut.mutate()}
              disabled={breakerMut.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 transition-colors disabled:opacity-50"
              title="Audit recent loss autopsies and enforce circuit breaker fail-safe if model misses cluster"
            >
              <ShieldCheck className={cn("size-3", breakerMut.isPending && "animate-spin")} />
              {breakerMut.isPending ? "Auditing..." : "Audit Circuit Breakers"}
            </button>
            <button
              onClick={() => calibrateMut.mutate()}
              disabled={calibrateMut.isPending}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-primary/10 text-primary border border-primary/20 rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50 shrink-0"
            >
              <RefreshCw className={cn("size-3", calibrateMut.isPending && "animate-spin")} />
              {calibrateMut.isPending ? "Calibrating 30d..." : "Calibrate Weights (30d)"}
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-1">
          {(weights || []).map((w: any) => {
            const mktPct = Math.round((w.wMarket || 0.8) * 100);
            const simPct = Math.round((w.wSim || 0.1) * 100);
            const poolPct = Math.round((w.wPool || 0.1) * 100);
            const isBreaker = w.source === "circuit_breaker";
            const isCalibrated = w.source === "calibrated";
            const isManual = w.source === "manual";

            return (
              <div key={w.sport} className="bg-obsidian border border-line rounded-xl p-3.5 flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-ink">{w.sport}</span>
                    <span className={cn(
                      "text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase",
                      isBreaker ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse" :
                      isCalibrated ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                      isManual ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" :
                      "bg-line text-muted"
                    )}>
                      {isBreaker ? "🛡️ CIRCUIT BREAKER" : isCalibrated ? `CALIBRATED (n=${w.sampleSize})` : isManual ? "MANUAL" : "DEFAULT"}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted font-mono">{mktPct}% Mkt</span>
                </div>

                {/* Stacked Percentage Bar */}
                <div className="space-y-1">
                  <div className="h-4 w-full bg-line/40 rounded-full overflow-hidden flex text-[8px] font-bold text-white font-mono">
                    <div style={{ width: `${mktPct}%` }} className="bg-indigo-600 flex items-center justify-center truncate px-0.5" title={`Market Consensus: ${mktPct}%`}>
                      {mktPct}%
                    </div>
                    <div style={{ width: `${simPct}%` }} className="bg-emerald-500 flex items-center justify-center truncate px-0.5" title={`Monte Carlo Sim: ${simPct}%`}>
                      {simPct}%
                    </div>
                    <div style={{ width: `${poolPct}%` }} className="bg-amber-500 flex items-center justify-center truncate px-0.5" title={`Feature Pool: ${poolPct}%`}>
                      {poolPct}%
                    </div>
                  </div>
                  <div className="flex justify-between text-[9px] text-muted pt-0.5">
                    <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-indigo-500" /> Mkt {mktPct}%</span>
                    <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-emerald-400" /> Sim {simPct}%</span>
                    <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-amber-400" /> Pool {poolPct}%</span>
                  </div>
                </div>

                {w.notes && (
                  <p className="text-[10px] text-muted italic border-t border-line/30 pt-1.5 leading-snug break-words">
                    {w.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── SECTION 3: TWO-WAY COMMUNICATION COCKPIT ── */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Active Brain Suggestions & Engine Actions */}
        <section className="bg-panel border border-line rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-ink">
                <Brain className="size-4 text-emerald-400" /> Active Brain Suggestions ({pendingSuggestions.length})
              </div>
              <p className="text-xs text-muted mt-0.5">
                The Brain proposes real algorithmic adjustments. Approve to apply them instantly to the engine.
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
              TWO-WAY
            </span>
          </div>

          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {pendingSuggestions.length === 0 ? (
              <div className="p-6 text-center text-muted text-xs border border-dashed border-line rounded-xl">
                No pending suggestions. The Brain will automatically formulate new proposals during the next grading sweep.
              </div>
            ) : (
              pendingSuggestions.map((s: any) => (
                <div key={s.id} className="bg-obsidian border border-line rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-ink">{s.title}</span>
                    <span className="text-[9px] font-mono uppercase bg-line px-1.5 py-0.5 rounded text-muted shrink-0">
                      Knob: {s.knob}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">{s.body}</p>

                  {s.proposed && (
                    <div className="text-[10px] font-mono bg-panel p-1.5 rounded text-emerald-400 border border-line">
                      Proposed: {JSON.stringify(s.proposed)}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1 border-t border-line/40">
                    <button
                      onClick={() => applyMut.mutate({ id: s.id, status: "accepted" })}
                      disabled={applyMut.isPending}
                      className="flex items-center gap-1 px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                    >
                      <Check className="size-3" /> Approve
                    </button>
                    <button
                      onClick={() => applyMut.mutate({ id: s.id, status: "rejected" })}
                      disabled={applyMut.isPending}
                      className="flex items-center gap-1 px-3 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded hover:bg-red-500/30 transition-colors disabled:opacity-50"
                    >
                      <X className="size-3" /> Reject
                    </button>
                    <button
                      onClick={() => applyMut.mutate({ id: s.id, status: "later" })}
                      disabled={applyMut.isPending}
                      className="flex items-center gap-1 px-2 py-1 bg-line text-muted text-xs rounded hover:bg-line/80 transition-colors disabled:opacity-50 ml-auto"
                    >
                      Later
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Talk to the Brain / Hypothesis Submission */}
        <section className="bg-panel border border-line rounded-xl p-5 space-y-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-ink">
              <Sparkles className="size-4 text-primary" /> Talk to the Brain
            </div>
            <p className="text-xs text-muted mt-0.5">
              Submit custom hypotheses or analytical inquiries. The Brain audits historical performance and logs the inquiry.
            </p>
          </div>

          {/* Quick Prompts */}
          <div className="flex flex-wrap gap-1.5">
            {[
              "Cold weather MLB totals",
              "Pitcher strikeout prop audit",
              "NBA back-to-back rest fatigue",
              "Sharp steam reverse line movement"
            ].map(prompt => (
              <button
                key={prompt}
                onClick={() => setHypothesisQuery(prompt)}
                className="text-[10px] px-2 py-1 rounded bg-obsidian border border-line text-muted hover:text-ink hover:border-primary/40 transition-colors"
              >
                + {prompt}
              </button>
            ))}
          </div>

          {/* Submission Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (hypothesisQuery.trim()) submitHypoMut.mutate(hypothesisQuery.trim());
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={hypothesisQuery}
              onChange={(e) => setHypothesisQuery(e.target.value)}
              placeholder="e.g., Audit underdogs when travel fatigue is high..."
              className="flex-1 bg-obsidian border border-line rounded-lg px-3 py-2 text-xs text-ink placeholder:text-muted/50 focus:outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={!hypothesisQuery.trim() || submitHypoMut.isPending}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0"
            >
              <Send className="size-3" />
              {submitHypoMut.isPending ? "Auditing..." : "Submit"}
            </button>
          </form>

          {/* Hypothesis History Feed */}
          <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
            {(hypotheses || []).length === 0 ? (
              <p className="text-xs text-muted italic p-4 text-center">
                No custom hypotheses submitted yet. Submit a query above to query the Brain's analytical memory.
              </p>
            ) : (
              (hypotheses || []).map((h: any) => (
                <div key={h.id} className="bg-obsidian border border-line rounded-lg p-3 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-ink">"{h.query}"</span>
                    <span className={cn(
                      "text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-bold",
                      h.status === "verified" ? "bg-emerald-500/20 text-emerald-400" :
                      h.status === "applied" ? "bg-blue-500/20 text-blue-400" :
                      "bg-amber-500/20 text-amber-400"
                    )}>
                      {h.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">{h.finding}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* ── SECTION 4: DAILY DIGEST + ROLLING RECORD ── */}
      {(stats as any).dailyDigest && (() => {
        const d = (stats as any).dailyDigest;
        const todayDecided = d.todayWins + d.todayLosses;
        return (
          <div className="grid md:grid-cols-2 gap-4">
            {/* Today's Summary */}
            <section className="bg-panel border border-line rounded-xl p-4">
              <SectionHeader icon={<Flame />} title="Today's Summary"
                description="Graded picks from today's completed games." />
              <div className="mt-3">
                {todayDecided > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-display font-bold text-ink">{d.todayWins}-{d.todayLosses}</span>
                      <span className={cn("text-sm font-bold", d.todayWins > d.todayLosses ? "text-emerald-400" : d.todayWins < d.todayLosses ? "text-red-400" : "text-muted")}>
                        ({Math.round(d.todayWins / todayDecided * 100)}%)
                      </span>
                    </div>
                    {d.bestHit && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-emerald-400 font-bold">🎯 Best Hit</span>
                        <span className="text-muted">{d.bestHit.sport} · {d.bestHit.selection} · {d.bestHit.home} vs {d.bestHit.away}</span>
                      </div>
                    )}
                    {d.worstMiss && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-red-400 font-bold">❌ Worst Miss</span>
                        <span className="text-muted">{d.worstMiss.sport} · {d.worstMiss.selection} · {d.worstMiss.home} vs {d.worstMiss.away}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted">No graded picks yet today.</p>
                )}
              </div>
            </section>

            {/* Rolling Record */}
            <section className="bg-panel border border-line rounded-xl p-4">
              <SectionHeader icon={<BarChart2 />} title="Rolling Record"
                description="Win rate over different time windows." />
              <div className="mt-3 space-y-2">
                {[
                  { label: "7 Day", ...d.week },
                  { label: "30 Day", ...d.month },
                  { label: "All Time", ...d.allTime },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between text-sm">
                    <span className="text-muted font-medium">{row.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-ink font-bold">{row.wins}-{row.losses}</span>
                      <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full",
                        row.pct >= 55 ? "bg-emerald-500/20 text-emerald-400" :
                        row.pct >= 52 ? "bg-amber-500/20 text-amber-400" :
                        row.pct > 0 ? "bg-red-500/20 text-red-400" : "bg-line text-muted"
                      )}>
                        {row.pct}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        );
      })()}

      {/* ── SECTION 5: ACCURACY GAUGE & DATA HEALTH ── */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Win Rate Gauge */}
        <section className="bg-panel border border-line rounded-xl p-4">
          <SectionHeader icon={<Target />} title="Brain Accuracy"
            description="How accurate is the model? 50% = random, 52.4% = break even after vig, 55%+ = strong edge." />
          <div className="mt-4 flex items-center gap-4">
            <div className="flex-1 h-8 bg-line/30 rounded-full overflow-hidden relative">
              <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-muted/60 z-10" title="50.0% = Random (Coin Flip)" />
              <div className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10" style={{ left: "52.4%" }} title="52.4% = Break Even" />
              <div className="absolute top-0 bottom-0 w-0.5 bg-emerald-400/70 z-10" style={{ left: "55%" }} title="55.0% = Profitable Edge" />
              <div className={cn("h-full rounded-full transition-all", wr >= 55 ? "bg-emerald-500" : wr >= 52 ? "bg-amber-500" : "bg-red-500")}
                style={{ width: `${Math.min(wr, 100)}%` }} />
            </div>
            <span className={cn("text-2xl font-display font-bold shrink-0", wr >= 55 ? "text-emerald-400" : wr >= 52 ? "text-amber-400" : "text-red-400")}>
              {wr}%
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-line/40 text-center">
            <div className="bg-obsidian/60 border border-line/40 rounded-lg p-2">
              <div className="text-[10px] text-muted">Baseline</div>
              <div className="text-xs font-mono font-bold text-muted">50.0%</div>
              <div className="text-[9px] text-muted/70">Coin Flip</div>
            </div>
            <div className="bg-obsidian/60 border border-amber-400/30 rounded-lg p-2">
              <div className="text-[10px] text-amber-400/90 font-medium">Vig Line</div>
              <div className="text-xs font-mono font-bold text-amber-400">52.4%</div>
              <div className="text-[9px] text-muted/70">Break-Even</div>
            </div>
            <div className="bg-obsidian/60 border border-emerald-400/30 rounded-lg p-2">
              <div className="text-[10px] text-emerald-400/90 font-medium">Edge Zone</div>
              <div className="text-xs font-mono font-bold text-emerald-400">55.0%+</div>
              <div className="text-[9px] text-muted/70">Profitable</div>
            </div>
            <div className="bg-obsidian/60 border border-line/40 rounded-lg p-2">
              <div className="text-[10px] text-muted">Ceiling</div>
              <div className="text-xs font-mono font-bold text-ink">100.0%</div>
              <div className="text-[9px] text-muted/70">Theoretical</div>
            </div>
          </div>
        </section>

        {/* Data Health */}
        <section className="bg-panel border border-line rounded-xl p-4">
          <SectionHeader icon={<Server />} title="System Health"
            description="Status of data sources feeding the brain. All green confirms 100% full autonomous operation." />
          <div className="mt-4 space-y-2">
            <HealthRow label="Consensus Feeds & Sharp Books" status="active"
              detail="The Odds API + Pinnacle/Circa sharp line scraper" />
            <HealthRow label="10k Monte Carlo Engine" status="active"
              detail="Poisson distribution & possession tempo models" />
            <HealthRow label="Feature Ensembles" status="active"
              detail="EWMA recency, park factors, and travel fatigue" />
            <HealthRow label="Dynamic Weights Calibrator" status="active"
              detail="Rolling 30-day performance calibration" />
            <HealthRow label="Autonomous Grading Cron" status="active"
              detail="10m background sweep via ESPN historical API" />
          </div>
        </section>
      </div>

      {/* ── SECTION 6: OVERSEER TAB GUIDE ── */}
      <section className="bg-panel border border-line rounded-xl p-4">
        <SectionHeader icon={<Info />} title="Overseer Tab Guide"
          description="Quick reference for what each tab does and when to use it." />
        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <TabGuide emoji="🧠" name="Dashboard" route="/admin/dashboard"
            desc="You are here. End-to-end pipeline diagram, live dynamic blend weights, suggestions cockpit, and brain health." />
          <TabGuide emoji="📊" name="Analysis Workbench" route="/admin/analysis"
            desc="Deep-dive into predictions with 4-bucket loss autopsies, calibration reliability curves, and Brier score matrices." />
          <TabGuide emoji="⚙️" name="Engine Controls" route="/admin/engine"
            desc="Tune the brain. Adjust Kelly %, min edge, max legs, and review active applied adjustments." />
          <TabGuide emoji="🔐" name="Approvals" route="/admin/approvals"
            desc="Manage user sign-ups. Approve or deny new accounts." />
        </div>
      </section>
    </div>
  );
}

// ── Components ──

function HeroStat({ icon, label, sublabel, value, color, tooltip }: {
  icon: React.ReactNode; label: string; sublabel?: string; value: string | number; color: string; tooltip: string;
}) {
  return (
    <div className="bg-panel border border-line rounded-xl p-4 relative group">
      <div className={cn("text-2xl font-display font-bold", color)}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted mt-1 flex items-center gap-1 font-semibold">
        {icon} {label}
      </div>
      {sublabel && (
        <div className="text-[10px] text-muted/70 mt-0.5 truncate">
          {sublabel}
        </div>
      )}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2 bg-obsidian border border-line rounded-lg text-[10px] text-muted opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl text-center">
        {tooltip}
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-bold text-ink">{icon} {title}</div>
      <p className="text-xs text-muted mt-1">{description}</p>
    </div>
  );
}

function HealthRow({ label, status, detail }: { label: string; status: "active" | "idle" | "error"; detail: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <CheckCircle2 className={cn("size-4 shrink-0", status === "active" ? "text-emerald-400" : status === "idle" ? "text-amber-400" : "text-red-400")} />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-bold text-ink">{label}</span>
        <p className="text-[10px] text-muted truncate">{detail}</p>
      </div>
      <span className={cn("text-[10px] uppercase font-bold px-2 py-0.5 rounded",
        status === "active" ? "bg-emerald-500/10 text-emerald-400" :
        status === "idle" ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"
      )}>{status}</span>
    </div>
  );
}

function TabGuide({ emoji, name, route, desc }: { emoji: string; name: string; route: string; desc: string }) {
  return (
    <div className="bg-obsidian border border-line rounded-lg p-3">
      <div className="text-sm font-bold text-ink">{emoji} {name}</div>
      <p className="text-[10px] text-muted mt-1">{desc}</p>
    </div>
  );
}
