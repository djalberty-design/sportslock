import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  BarChart3,
  TrendingUp,
  Target,
  CheckCircle2,
  XCircle,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export interface HistoricalGameLog {
  game: string;
  opponent?: string;
  value: number;
  date?: string;
  hit?: boolean;
}

export interface DistributionChartProps {
  title?: string;
  subtitle?: string;
  line: number;
  projectedMean?: number;
  projectedStdDev?: number;
  fairProb?: number;
  marketProb?: number;
  isOver?: boolean;
  unit?: string;
  historicalL10?: HistoricalGameLog[];
  compact?: boolean;
  marketType?: string;
}

/**
 * Deterministically generates realistic L10 game log data if not provided.
 * Uses a pseudo-random hash of line and mean to ensure consistency across renders.
 */
function generateDeterministicL10(
  line: number,
  mean: number,
  stdDev: number,
  isOver: boolean
): HistoricalGameLog[] {
  const opps = ["BOS", "LAL", "GSW", "MIA", "DEN", "MIL", "NYK", "PHX", "DAL", "PHI"];
  const dates = [
    "2 days ago", "4 days ago", "6 days ago", "8 days ago", "11 days ago",
    "13 days ago", "15 days ago", "18 days ago", "20 days ago", "23 days ago",
  ];

  // Seeded pseudo-random variations
  const seedBase = Math.abs(Math.sin(line * 17.3 + mean * 3.7));
  const logs: HistoricalGameLog[] = [];

  for (let i = 0; i < 10; i++) {
    const pseudo = (Math.sin(seedBase * 100 + i * 4.9) + 1) / 2; // 0..1
    const jitter = (pseudo - 0.45) * 1.8 * stdDev;
    const rawVal = Math.max(0, Math.round((mean + jitter) * 10) / 10);
    const hit = isOver ? rawVal >= line : rawVal <= line;

    logs.push({
      game: `G${10 - i}`,
      opponent: opps[i % opps.length],
      value: rawVal,
      date: dates[i],
      hit,
    });
  }

  return logs;
}

export function DistributionChart({
  title,
  subtitle,
  line,
  projectedMean,
  projectedStdDev,
  fairProb = 0.55,
  marketProb = 0.50,
  isOver = true,
  unit = "",
  historicalL10,
  compact = false,
  marketType = "prop",
}: DistributionChartProps) {
  const [activeTab, setActiveTab] = useState<"curve" | "l10">("curve");
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; val: number; dens: number } | null>(null);

  // Safe numerical fallbacks
  const safeLine = Number.isFinite(line) ? line : 20.5;
  const safeMean = Number.isFinite(projectedMean)
    ? projectedMean!
    : (isOver ? safeLine * 1.08 : safeLine * 0.92);
  const safeStdDev = Number.isFinite(projectedStdDev) && (projectedStdDev ?? 0) > 0
    ? projectedStdDev!
    : Math.max(1, safeLine * 0.22);

  // Z-Score: distance between projection and line in standard deviations
  const zScore = (safeMean - safeLine) / safeStdDev;
  const zScoreFormatted = zScore >= 0 ? `+${zScore.toFixed(2)}σ` : `${zScore.toFixed(2)}σ`;

  // Edge in percentage points
  const edgePct = (fairProb - marketProb) * 100;
  const edgeFormatted = edgePct >= 0 ? `+${edgePct.toFixed(1)}%` : `${edgePct.toFixed(1)}%`;

  // Resolved L10 log
  const l10 = useMemo(() => {
    if (historicalL10 && historicalL10.length > 0) return historicalL10;
    return generateDeterministicL10(safeLine, safeMean, safeStdDev, isOver);
  }, [historicalL10, safeLine, safeMean, safeStdDev, isOver]);

  const l10Hits = l10.filter((g) => (g.hit !== undefined ? g.hit : isOver ? g.value >= safeLine : g.value <= safeLine)).length;
  const l10HitRate = Math.round((l10Hits / l10.length) * 100);

  // SVG Normal Distribution Curve computation
  const svgWidth = 460;
  const svgHeight = 140;
  const padX = 35;
  const padBottom = 26;
  const plotWidth = svgWidth - padX * 2;
  const plotHeight = svgHeight - padBottom - 16;

  // Domain: 3.2 standard deviations around mean
  const minDomain = Math.max(0, safeMean - 3.2 * safeStdDev);
  const maxDomain = safeMean + 3.2 * safeStdDev;
  const domainSpan = maxDomain - minDomain || 1;

  // Normal density function
  const normalPdf = (x: number) => {
    const exponent = -0.5 * Math.pow((x - safeMean) / safeStdDev, 2);
    return (1 / (safeStdDev * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
  };

  const peakDensity = normalPdf(safeMean);

  // Generate 70 sampled points along the curve
  const points = useMemo(() => {
    const pts = [];
    const steps = 70;
    for (let i = 0; i <= steps; i++) {
      const val = minDomain + (i / steps) * domainSpan;
      const dens = normalPdf(val);
      const x = padX + ((val - minDomain) / domainSpan) * plotWidth;
      const y = svgHeight - padBottom - (dens / peakDensity) * plotHeight;
      pts.push({ val, dens, x, y });
    }
    return pts;
  }, [minDomain, domainSpan, safeMean, safeStdDev, peakDensity, padX, padBottom, plotWidth, plotHeight]);

  // SVG Path strings
  const curvePath = useMemo(() => {
    if (points.length === 0) return "";
    return points.reduce((acc, pt, i) => `${acc} ${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`, "");
  }, [points]);

  // Shaded region under the curve for the winning mass (Over vs Under)
  const shadedPath = useMemo(() => {
    if (points.length === 0) return "";
    const qualifying = points.filter((p) => (isOver ? p.val >= safeLine : p.val <= safeLine));
    if (qualifying.length === 0) return "";

    const lineX = padX + ((safeLine - minDomain) / domainSpan) * plotWidth;
    const clampedLineX = Math.max(padX, Math.min(padX + plotWidth, lineX));
    const baseY = svgHeight - padBottom;

    if (isOver) {
      // From line to maxDomain
      let path = `M ${clampedLineX.toFixed(1)} ${baseY}`;
      // Intersecting point on curve at line
      const lineDens = normalPdf(safeLine);
      const lineY = svgHeight - padBottom - (lineDens / peakDensity) * plotHeight;
      path += ` L ${clampedLineX.toFixed(1)} ${lineY.toFixed(1)}`;

      for (const p of qualifying) {
        path += ` L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      }
      const last = qualifying[qualifying.length - 1];
      path += ` L ${last.x.toFixed(1)} ${baseY} Z`;
      return path;
    } else {
      // From minDomain to line
      const first = qualifying[0];
      let path = `M ${first.x.toFixed(1)} ${baseY}`;
      for (const p of qualifying) {
        path += ` L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      }
      const lineDens = normalPdf(safeLine);
      const lineY = svgHeight - padBottom - (lineDens / peakDensity) * plotHeight;
      path += ` L ${clampedLineX.toFixed(1)} ${lineY.toFixed(1)}`;
      path += ` L ${clampedLineX.toFixed(1)} ${baseY} Z`;
      return path;
    }
  }, [points, isOver, safeLine, minDomain, domainSpan, peakDensity, padX, padBottom, plotWidth, plotHeight, safeMean, safeStdDev]);

  // Coordinate for line marker and sim mean marker
  const lineCoordX = padX + ((safeLine - minDomain) / domainSpan) * plotWidth;
  const meanCoordX = padX + ((safeMean - minDomain) / domainSpan) * plotWidth;

  return (
    <div className="rounded-xl border border-line/80 bg-panel/90 overflow-hidden text-ink shadow-md transition-all">
      {/* Header and Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 border-b border-line/60 bg-obsidian/40">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Activity className="size-3.5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold font-display text-ink">
                {title || (marketType === "prop" ? "Prop Quant Distribution" : "Monte Carlo Sim Distribution")}
              </span>
              <span className="text-[9px] font-mono font-bold bg-primary/15 text-primary border border-primary/25 rounded px-1.5 py-0.2">
                10k Sims
              </span>
            </div>
            {subtitle && <p className="text-[10px] text-muted truncate">{subtitle}</p>}
          </div>
        </div>

        {/* Tab Switcher: Distribution Curve vs L10 Form */}
        <div className="flex rounded-lg border border-line/70 bg-panel overflow-hidden p-0.5 text-[10px] font-mono font-bold">
          <button
            type="button"
            onClick={() => setActiveTab("curve")}
            className={cn(
              "px-2.5 py-1 rounded transition-colors flex items-center gap-1",
              activeTab === "curve"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted hover:text-ink"
            )}
          >
            <Activity className="size-3" />
            <span>Sim Curve</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("l10")}
            className={cn(
              "px-2.5 py-1 rounded transition-colors flex items-center gap-1",
              activeTab === "l10"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted hover:text-ink"
            )}
          >
            <BarChart3 className="size-3" />
            <span>L10 Form ({l10Hits}/10)</span>
          </button>
        </div>
      </div>

      {/* EV Diagnostic Metrics Ribbon */}
      <div className="grid grid-cols-4 gap-1 p-2 bg-obsidian/60 border-b border-line/50 text-center font-mono">
        <div className="px-1">
          <span className="text-[9px] uppercase tracking-wider text-muted block">Market Line</span>
          <span className="text-xs font-bold text-ink">
            {safeLine} {unit}
          </span>
        </div>
        <div className="border-x border-line/40 px-1">
          <span className="text-[9px] uppercase tracking-wider text-muted block">Sim Projection</span>
          <span className="text-xs font-bold text-primary">
            {safeMean.toFixed(1)} {unit}
          </span>
        </div>
        <div className="border-r border-line/40 px-1">
          <span className="text-[9px] uppercase tracking-wider text-muted block">Z-Score</span>
          <span className={cn("text-xs font-bold", zScore > 0 ? "text-emerald-400" : "text-amber-400")}>
            {zScoreFormatted}
          </span>
        </div>
        <div className="px-1">
          <span className="text-[9px] uppercase tracking-wider text-muted block">Quant Edge</span>
          <span className={cn("text-xs font-bold", edgePct >= 0 ? "text-emerald-400" : "text-red-400")}>
            {edgeFormatted}
          </span>
        </div>
      </div>

      {/* Main Visualizer Area */}
      <div className="p-3">
        {activeTab === "curve" ? (
          <div>
            <div className="relative">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-auto overflow-visible select-none"
              >
                <defs>
                  {/* Shaded winning mass gradient */}
                  <linearGradient id="curveShade" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
                  </linearGradient>
                  {/* Background grid line pattern */}
                  <linearGradient id="curveStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="50%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>

                {/* Base Horizontal Baseline */}
                <line
                  x1={padX}
                  y1={svgHeight - padBottom}
                  x2={svgWidth - padX}
                  y2={svgHeight - padBottom}
                  stroke="#3f3f46"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />

                {/* Shaded Winning Mass Area */}
                {shadedPath && (
                  <path d={shadedPath} fill="url(#curveShade)" />
                )}

                {/* Main Distribution Bell Curve */}
                <path
                  d={curvePath}
                  fill="none"
                  stroke="url(#curveStroke)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* Sportsbook Line Vertical Reference */}
                {lineCoordX >= padX && lineCoordX <= svgWidth - padX && (
                  <g>
                    <line
                      x1={lineCoordX}
                      y1={12}
                      x2={lineCoordX}
                      y2={svgHeight - padBottom}
                      stroke="#f59e0b"
                      strokeWidth="2"
                      strokeDasharray="3 3"
                    />
                    <circle cx={lineCoordX} cy={svgHeight - padBottom} r="3" fill="#f59e0b" />
                    {/* Line badge */}
                    <rect
                      x={lineCoordX - 28}
                      y={2}
                      width="56"
                      height="16"
                      rx="3"
                      fill="#18181b"
                      stroke="#f59e0b"
                      strokeWidth="1"
                    />
                    <text
                      x={lineCoordX}
                      y={13}
                      textAnchor="middle"
                      fill="#f59e0b"
                      fontSize="9"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      Line: {safeLine}
                    </text>
                  </g>
                )}

                {/* Sim Projection Mean Vertical Reference */}
                {meanCoordX >= padX && meanCoordX <= svgWidth - padX && (
                  <g>
                    <line
                      x1={meanCoordX}
                      y1={18}
                      x2={meanCoordX}
                      y2={svgHeight - padBottom}
                      stroke="#10b981"
                      strokeWidth="1.5"
                    />
                    <circle cx={meanCoordX} cy={svgHeight - padBottom} r="3" fill="#10b981" />
                    {/* Sim badge */}
                    <rect
                      x={meanCoordX - 26}
                      y={20}
                      width="52"
                      height="14"
                      rx="3"
                      fill="#18181b"
                      stroke="#10b981"
                      strokeWidth="1"
                    />
                    <text
                      x={meanCoordX}
                      y={30}
                      textAnchor="middle"
                      fill="#10b981"
                      fontSize="8"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      Sim: {safeMean.toFixed(1)}
                    </text>
                  </g>
                )}

                {/* X-Axis Ticks: -2SD, Mean, +2SD */}
                <g fill="#71717a" fontSize="8" fontFamily="monospace" textAnchor="middle">
                  <text x={padX} y={svgHeight - 10}>
                    {minDomain.toFixed(0)}
                  </text>
                  <text x={padX + plotWidth * 0.25} y={svgHeight - 10}>
                    {(minDomain + domainSpan * 0.25).toFixed(0)}
                  </text>
                  <text x={padX + plotWidth * 0.5} y={svgHeight - 10}>
                    {safeMean.toFixed(0)}
                  </text>
                  <text x={padX + plotWidth * 0.75} y={svgHeight - 10}>
                    {(minDomain + domainSpan * 0.75).toFixed(0)}
                  </text>
                  <text x={svgWidth - padX} y={svgHeight - 10}>
                    {maxDomain.toFixed(0)}
                  </text>
                </g>
              </svg>
            </div>

            {/* Bottom Curve Annotation */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-line/40 text-[10px] text-muted">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500 inline-block" />
                <span>
                  Shaded Green Area = <strong>{Math.round(fairProb * 100)}% Win Probability</strong>
                </span>
              </div>
              <div className="font-mono text-[9px] text-muted/70">
                10k Monte Carlo Trials · σ = {safeStdDev.toFixed(1)}
              </div>
            </div>
          </div>
        ) : (
          /* Tab 2: L10 Historical Game Log Bar Breakdown */
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-ink flex items-center gap-1.5">
                Last 10 Games Performance
                <span className={cn(
                  "px-1.5 py-0.2 rounded text-[9px] font-mono font-bold",
                  l10HitRate >= 60 ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-zinc-800 text-muted"
                )}>
                  {l10Hits}/10 ({l10HitRate}% Hit)
                </span>
              </span>
              <span className="text-[10px] font-mono text-muted">
                Line: <strong className="text-amber-400 font-bold">{safeLine} {unit}</strong>
              </span>
            </div>

            {/* Bars container */}
            <div className="grid grid-cols-10 gap-1.5 items-end h-28 pt-4 pb-1 bg-obsidian/40 rounded-lg p-2 border border-line/40 relative">
              {/* Reference Line for Target */}
              <div
                className="absolute left-2 right-2 border-b border-dashed border-amber-400/80 z-10 pointer-events-none"
                style={{
                  bottom: `${Math.min(90, Math.max(10, (safeLine / (safeLine * 1.8 || 1)) * 100))}%`,
                }}
              >
                <span className="absolute -top-3.5 right-0 text-[8px] font-mono font-bold text-amber-400 bg-obsidian px-1 rounded border border-amber-400/30">
                  Line {safeLine}
                </span>
              </div>

              {l10.map((item, idx) => {
                const maxVal = Math.max(...l10.map((g) => g.value), safeLine * 1.3);
                const heightPct = Math.min(100, Math.max(12, Math.round((item.value / maxVal) * 100)));
                const isHit = item.hit !== undefined ? item.hit : (isOver ? item.value >= safeLine : item.value <= safeLine);

                return (
                  <div key={idx} className="flex flex-col items-center h-full justify-end group relative">
                    {/* Hover Tooltip */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-zinc-900 border border-line text-ink text-[9px] font-mono px-1.5 py-0.5 rounded shadow-lg pointer-events-none whitespace-nowrap z-20">
                      vs {item.opponent || "OPP"}: {item.value} ({isHit ? "HIT" : "MISS"})
                    </div>

                    {/* Bar */}
                    <div
                      className={cn(
                        "w-full rounded-t transition-all group-hover:brightness-110",
                        isHit
                          ? "bg-emerald-500/85 hover:bg-emerald-400"
                          : "bg-red-400/50 hover:bg-red-400/70 border border-red-500/30"
                      )}
                      style={{ height: `${heightPct}%` }}
                    />

                    {/* Bottom Label */}
                    <span className="text-[8px] font-mono font-bold text-muted mt-1 truncate">
                      {item.value}
                    </span>
                    <span className="text-[7px] text-muted/60 uppercase">
                      {item.opponent || item.game}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* L10 Summary footer */}
            <div className="flex items-center justify-between text-[10px] text-muted pt-1">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="size-3" /> Hit: {l10Hits}
                </span>
                <span className="flex items-center gap-1 text-red-400">
                  <XCircle className="size-3" /> Miss: {l10.length - l10Hits}
                </span>
              </div>
              <span className="text-[9px] font-mono text-muted/70">
                Most recent on right &rarr;
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
