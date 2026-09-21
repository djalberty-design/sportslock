import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { applySuggestionFn, getTuningFn } from "@/lib/market/server";
import { getSuggestionsFn } from "@/lib/market/tape-server";
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { cn } from "@/lib/utils";
import {
  Settings, Brain, Zap, AlertTriangle, CheckCircle2, XCircle, Clock,
  ChevronDown, ChevronRight, Info, Sliders, MessageSquare, Shield
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/admin/engine")({ component: EngineControls });

const listOverridesFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const { listOverrides } = await import("@/lib/market/overrides");
    return listOverrides();
  });

function EngineControls() {
  const qc = useQueryClient();
  const [showApplied, setShowApplied] = useState(false);

  const { data: suggestions } = useQuery({
    queryKey: ["brain-suggestions"],
    queryFn: () => getSuggestionsFn(),
    refetchInterval: 60_000,
  });

  const { data: tuning } = useQuery({
    queryKey: ["desk-tuning"],
    queryFn: () => getTuningFn(),
  });

  const { data: overrides } = useQuery({
    queryKey: ["brain-overrides"],
    queryFn: () => listOverridesFn(),
  });

  const applyMut = useMutation({
    mutationFn: (args: { id: string; status: string }) => applySuggestionFn({ data: args }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brain-suggestions"] });
      qc.invalidateQueries({ queryKey: ["desk-tuning"] });
    },
  });

  const pending = (suggestions || []).filter((s: any) => s.status === "pending");
  const applied = (suggestions || []).filter((s: any) => s.status === "accepted" || s.status === "auto_applied");
  const rejected = (suggestions || []).filter((s: any) => s.status === "rejected");

  return (
    <div className="space-y-8">
      {/* Header */}
      <header>
        <p className="text-sm text-emerald-500 flex items-center gap-1.5">
          <Settings className="size-4" /> ENGINE CONTROLS
        </p>
        <h1 className="font-display text-3xl text-ink mt-1">Tune the Brain</h1>
        <p className="text-sm text-muted mt-1">
          Review AI suggestions, adjust engine settings, and see exactly what changes are active. Every accepted suggestion actually modifies the prediction engine.
        </p>
      </header>

      {/* Current Engine Settings */}
      <section className="bg-panel border border-line rounded-xl p-4 sm:p-6">
        <SectionHeader icon={<Sliders />} title="Engine Settings"
          description="Core tuning knobs that control the brain's behavior. Changes take effect on the next prediction cycle." />
        <div className="mt-4 grid sm:grid-cols-3 gap-4">
          <TuningKnob
            label="Kelly %"
            value={tuning?.kelly != null ? `${Math.round(tuning.kelly * 100)}%` : "25%"}
            description="How aggressive the bet sizing recommendation is. 100% = full Kelly (aggressive, high variance). 25% = quarter-Kelly (conservative, recommended for most bettors). Lower = safer but slower bankroll growth."
          />
          <TuningKnob
            label="Max Parlay Legs"
            value={tuning?.maxLegs ?? 3}
            description="Maximum number of legs the AI will include in a generated parlay. More legs = higher payout but lower hit rate. 2-3 is recommended for value betting."
          />
          <TuningKnob
            label="Min Edge %"
            value={tuning?.minEdge != null ? `${tuning.minEdge}%` : "2.5%"}
            description="Minimum edge (model probability minus book implied probability) required before the AI recommends a bet. Higher = fewer but more confident picks. 2.5% is a good starting point."
          />
        </div>
      </section>

      {/* Active Suggestions */}
      <section className="bg-panel border border-line rounded-xl p-4 sm:p-6">
        <SectionHeader icon={<Brain />} title={`Active Suggestions (${pending.length} pending)`}
          description="The brain analyzes its own performance and suggests improvements. When you Accept a suggestion, it ACTUALLY changes the engine. Reject if you disagree. Each suggestion explains what it found and what it proposes to change." />
        
        {pending.length === 0 ? (
          <p className="text-sm text-muted mt-4 italic">No pending suggestions. The brain will generate new ones after the next grading sweep.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {pending.map((s: any) => (
              <SuggestionCard key={s.id} suggestion={s} onDecide={(status) => applyMut.mutate({ id: s.id, status })} isPending={applyMut.isPending} />
            ))}
          </div>
        )}
      </section>

      {/* Applied History */}
      <section className="bg-panel border border-line rounded-xl p-4 sm:p-6">
        <button onClick={() => setShowApplied(!showApplied)} className="flex items-center gap-2 w-full">
          <SectionHeader icon={<CheckCircle2 />} title={`Applied Adjustments (${applied.length})`}
            description="Every suggestion you've accepted, with what changed. Click to expand." />
          {showApplied ? <ChevronDown className="size-4 text-muted ml-auto" /> : <ChevronRight className="size-4 text-muted ml-auto" />}
        </button>
        {showApplied && (
          <div className="mt-4 space-y-2">
            {applied.length === 0 ? (
              <p className="text-sm text-muted italic">No suggestions have been applied yet.</p>
            ) : (
              applied.map((s: any) => (
                <div key={s.id} className="bg-obsidian border border-line rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-400" />
                    <span className="text-sm font-bold text-ink">{s.title}</span>
                    <span className="text-[10px] text-muted ml-auto">{s.decidedAt ? new Date(s.decidedAt).toLocaleDateString() : ""}</span>
                  </div>
                  <p className="text-xs text-muted mt-1">{s.body}</p>
                  {s.proposed && (
                    <p className="text-[10px] text-emerald-400 mt-1 font-mono">Applied: {JSON.stringify(s.proposed)}</p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </section>

      {/* Rejected History */}
      {rejected.length > 0 && (
        <section className="bg-panel border border-line rounded-xl p-4">
          <SectionHeader icon={<XCircle />} title={`Rejected (${rejected.length})`}
            description="Suggestions you rejected. They won't be re-proposed for 14 days." />
          <div className="mt-3 space-y-1">
            {rejected.slice(0, 5).map((s: any) => (
              <div key={s.id} className="text-xs text-muted py-1 border-b border-line/30">
                <span className="text-red-400">✕</span> {s.title} — {s.decidedAt ? new Date(s.decidedAt).toLocaleDateString() : ""}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Manual Overrides */}
      <section className="bg-panel border border-line rounded-xl p-4">
        <SectionHeader icon={<Shield />} title="Manual Overrides"
          description="Event-specific chance adjustments you've made. These override the model's probability for specific games/markets." />
        {(overrides || []).length === 0 ? (
          <p className="text-sm text-muted mt-3 italic">No active overrides. You can add overrides from the old Overrides tab or from individual game tickets.</p>
        ) : (
          <div className="mt-3 space-y-1">
            {(overrides || []).map((o: any, i: number) => (
              <div key={i} className="text-xs bg-obsidian border border-line rounded p-2">
                <span className="font-bold text-ink">{o.eventId || o.selection}</span>
                <span className="text-muted ml-2">{o.marketType} → {o.adjustedChance ? `${Math.round(o.adjustedChance * 100)}%` : "custom"}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* How The Brain Works */}
      <section className="bg-panel border border-line rounded-xl p-4 sm:p-6">
        <SectionHeader icon={<Info />} title="How The Prediction Engine Works"
          description="The brain combines ~15 weighted data layers using Bayesian precision-weighted averaging. Each layer gets a 'precision score' (how reliable that source is). Higher precision = more influence on the final prediction." />
        <div className="mt-4 space-y-2">
          {LAYERS.map((layer) => (
            <div key={layer.id} className="flex items-center gap-3 py-1.5 border-b border-line/30 last:border-0">
              <div className={cn("w-2 h-2 rounded-full shrink-0", layer.weightClass === "high" ? "bg-emerald-400" : layer.weightClass === "medium" ? "bg-amber-400" : "bg-zinc-500")} />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-bold text-ink">{layer.name}</span>
                <span className="text-[10px] text-muted ml-2 uppercase">{layer.weightClass} weight</span>
              </div>
              <p className="text-[10px] text-muted max-w-xs hidden md:block">{layer.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ── Components ──

function SectionHeader({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-bold text-ink">{icon} {title}</div>
      <p className="text-xs text-muted mt-1">{description}</p>
    </div>
  );
}

function TuningKnob({ label, value, description }: { label: string; value: string | number; description: string }) {
  return (
    <div className="bg-obsidian border border-line rounded-lg p-4">
      <div className="text-xl font-display font-bold text-ink">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted mt-1 font-bold">{label}</div>
      <p className="text-[10px] text-muted mt-2 leading-relaxed">{description}</p>
    </div>
  );
}

function SuggestionCard({ suggestion: s, onDecide, isPending }: {
  suggestion: any; onDecide: (status: string) => void; isPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  // Plain English explanations for common suggestion types
  const explanation = explainSuggestion(s);

  return (
    <div className="bg-obsidian border border-line rounded-xl p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="size-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-ink">{s.title}</h3>
          {explanation && <p className="text-xs text-amber-300/80 mt-1 italic">{explanation}</p>}
          <button onClick={() => setExpanded(!expanded)} className="text-[10px] text-primary mt-2 hover:underline">
            {expanded ? "Hide details" : "Show details"}
          </button>
          {expanded && (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-muted">{s.body}</p>
              {s.proposed && (
                <div className="bg-panel border border-line rounded p-2">
                  <p className="text-[10px] text-muted font-bold uppercase">If you accept, this will change:</p>
                  <pre className="text-[10px] text-emerald-400 mt-1 font-mono">{JSON.stringify(s.proposed, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-3 ml-8">
        <button onClick={() => onDecide("accepted")} disabled={isPending}
          className="px-3 py-1.5 text-xs font-bold bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors disabled:opacity-50">
          ✓ Accept & Apply
        </button>
        <button onClick={() => onDecide("rejected")} disabled={isPending}
          className="px-3 py-1.5 text-xs font-bold bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50">
          ✕ Reject
        </button>
        <button onClick={() => onDecide("later")} disabled={isPending}
          className="px-3 py-1.5 text-xs font-bold bg-zinc-500/10 text-zinc-400 rounded-lg hover:bg-zinc-500/20 transition-colors disabled:opacity-50">
          Later
        </button>
      </div>
    </div>
  );
}

function explainSuggestion(s: any): string | null {
  const title = String(s.title || "").toLowerCase();
  if (title.includes("echoing the book")) {
    return "The model's probability is very close to the sportsbook's implied odds. No unique edge is being found — the AI is just agreeing with the book. Consider not betting markets where the model can't find an edge.";
  }
  if (title.includes("too confident") || title.includes("overconfident")) {
    return "The model's predicted win chance is higher than the actual win rate. It's being too optimistic. Accepting this applies a haircut to bring predictions closer to reality.";
  }
  if (title.includes("miscalibrated")) {
    return "The model performs differently on this segment than expected. Accepting the suggested haircut will adjust the model's probabilities to better match historical results.";
  }
  if (title.includes("cold streak") || title.includes("losing")) {
    return "The model is on a losing streak. This may be temporary variance or a real signal. The suggestion proposes a temporary adjustment.";
  }
  return null;
}

const LAYERS = [
  { id: "market", name: "Market Odds (Sportsbook)", weightClass: "high", description: "The sportsbook's implied probability after removing vig. The market is the strongest single signal." },
  { id: "opening", name: "Opening Line", weightClass: "medium", description: "Where the line opened. Big moves from open → current suggest sharp money." },
  { id: "clv", name: "Closing Line Movement", weightClass: "medium", description: "How the line moved from open to close. CLV is the #1 predictor of long-term betting profitability." },
  { id: "espn", name: "ESPN Power Index", weightClass: "medium", description: "ESPN's FPI (football) / BPI (basketball) model. Independent power rating." },
  { id: "kalshi", name: "Kalshi Markets", weightClass: "low", description: "Prediction market odds. Different bettor pool than sportsbooks." },
  { id: "poly", name: "Polymarket", weightClass: "low", description: "Crypto prediction market odds. Another independent signal." },
  { id: "pyth", name: "Pythagorean Win %", weightClass: "medium", description: "Points For / Points Against → expected win rate. Removes luck from W/L record." },
  { id: "form", name: "Form / Streaks", weightClass: "low", description: "Recent W/L trend, EWMA-weighted. Captures momentum but can overfit small samples." },
  { id: "home", name: "Home Field Advantage", weightClass: "low", description: "Sport-specific home advantage. NFL ~2.5 pts, NBA ~3 pts, MLB ~54% win rate." },
  { id: "weather", name: "Weather", weightClass: "low", description: "Wind, temperature, dome. Affects scoring in outdoor sports." },
  { id: "rest", name: "Rest Days", weightClass: "low", description: "Short rest (back-to-back) disadvantage. Bigger effect in NBA/NHL than NFL." },
  { id: "officials", name: "Officials / Umpires", weightClass: "low", description: "Historical tendencies of assigned officials. Small but measurable effect." },
  { id: "splits", name: "Splits", weightClass: "low", description: "Home/away record splits, conference performance, time-of-day." },
  { id: "h2h", name: "Head-to-Head History", weightClass: "low", description: "How these specific teams perform against each other historically." },
  { id: "injuries", name: "Injuries / Availability", weightClass: "medium", description: "Key player injuries significantly shift win probability." },
] as const;
