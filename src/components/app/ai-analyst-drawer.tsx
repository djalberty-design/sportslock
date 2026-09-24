import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Bot,
  Send,
  X,
  Plus,
  Check,
  Zap,
  TrendingUp,
  Target,
  ShieldAlert,
  Layers,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Scale,
  DollarSign,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useParlaySlip, isLegSelected } from "@/lib/parlay-slip";
import { formatAmerican } from "@/lib/market/hit-pct";
import { useDeskStore } from "@/lib/desk-store";
import { toast } from "sonner";
import type { StructuredBet, CorrelatedParlayAnalysis, AnalystToolCall } from "@/lib/market/ai-analyst";

interface MessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  structuredBets?: StructuredBet[];
  parlaySummary?: CorrelatedParlayAnalysis;
  toolCalls?: AnalystToolCall[];
  suggestedFollowUps?: string[];
  timestamp: string;
}

const QUICK_PROMPTS = [
  "🔥 3-Leg Correlated NBA SGP",
  "📈 High Edge Player Props (>4% Edge)",
  "🛡️ Positive EV Game Lines",
  "📊 Team DVOA & Efficiency Breakdown",
];

export function AiAnalystDrawer({
  isOpen,
  onClose,
  scanRows = [],
}: {
  isOpen: boolean;
  onClose: () => void;
  scanRows?: any[];
}) {
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: "initial_welcome",
      role: "assistant",
      content:
        "Welcome to the **SportsLock Institutional AI Quant Desk**. I am grounded in mathematical axioms:\n\n" +
        "- **No Unhedged Locks**: Calibrated probabilistic edge with irreducible variance.\n" +
        "- **Anti-Chalk Invariant**: Strict prohibition of unhedged plays steeper than -400 (dec < 1.25).\n" +
        "- **Clayton Archimedean Copula**: Exact non-linear same-game tail dependence.\n" +
        "- **Fractional Kelly Sizing**: Bankroll preservation via disciplined compounding.\n\n" +
        "What edge are you looking to exploit today?",
      suggestedFollowUps: [
        "Build me a 3-leg correlated NBA parlay",
        "Find highest EV player props on the board",
        "What are the best spread value plays today?",
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showToolsMap, setShowToolsMap] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { legs: sgpSlip, addLeg } = useParlaySlip();
  const liveBankroll = useDeskStore((s) => s.liveBankroll) || 1000;
  const stakeDollars = useDeskStore((s) => s.stakeDollars) || 25;

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMsg: MessageItem = {
      id: `usr_${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          history: historyPayload,
          context: {
            userBankroll: liveBankroll,
            riskMode: "balanced",
            rows: scanRows,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();

      const assistantMsg: MessageItem = {
        id: `asst_${Date.now()}`,
        role: "assistant",
        content: data.reply || "Analysis completed.",
        structuredBets: data.structuredBets,
        parlaySummary: data.parlaySummary,
        toolCalls: data.toolCalls,
        suggestedFollowUps: data.suggestedFollowUps,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error("AI analyst query failed:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "assistant",
          content:
            "⚠️ **Syndicate Link Timeout**: Unable to reach cloud LLM cluster. Please retry or adjust search constraints.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const addAllParlayLegs = (summary: CorrelatedParlayAnalysis) => {
    let count = 0;
    for (const leg of summary.legs) {
      addLeg({
        eventId: leg.eventId,
        selection: leg.selection,
        marketType: leg.marketType,
        side: leg.side,
        point: leg.point,
        price: leg.price,
        fairProb: leg.fairProb,
        sport: leg.sport,
        player: leg.player,
        home: leg.team,
      });
      count++;
    }
    toast.success(`Locked ${count} legs into Parlay Slip (${formatAmerican(summary.combinedAmericanOdds)})!`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl h-full bg-obsidian border-l border-line flex flex-col shadow-2xl relative animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-4 border-b border-line bg-panel/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shadow-sm shadow-primary/20">
              <Bot className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-display font-bold text-ink">The Lab Quant AI</h3>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold uppercase">
                  Copula 2.5
                </span>
              </div>
              <p className="text-[11px] text-muted">
                Axiomatic Reasoning • Clayton Copula • Anti-Chalk Shield
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-line/40 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Quick Prompts Bar */}
        <div className="px-4 py-2 border-b border-line bg-panel/30 overflow-x-auto no-scrollbar flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold text-muted tracking-wider shrink-0 flex items-center gap-1">
            <Zap className="size-3 text-primary" /> Quick:
          </span>
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleSend(prompt)}
              className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-line/30 hover:bg-primary/20 hover:text-primary hover:border-primary/40 border border-line text-ink transition-colors whitespace-nowrap shrink-0"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Message Log */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m) => {
            const isUser = m.role === "user";
            return (
              <div
                key={m.id}
                className={cn("flex flex-col gap-1.5", isUser ? "items-end" : "items-start")}
              >
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[10px] font-mono text-muted uppercase">
                    {isUser ? "You" : "Quant Analyst"}
                  </span>
                  <span className="text-[10px] text-muted/60">{m.timestamp}</span>
                </div>

                <div
                  className={cn(
                    "max-w-[92%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed",
                    isUser
                      ? "bg-primary text-primary-foreground font-medium rounded-tr-none shadow-md shadow-primary/10"
                      : "bg-panel border border-line text-ink rounded-tl-none space-y-3"
                  )}
                >
                  {/* Markdown text representation */}
                  <div className="whitespace-pre-line text-xs sm:text-sm">
                    {m.content}
                  </div>

                  {/* Tool Audit Toggle */}
                  {m.toolCalls && m.toolCalls.length > 0 && (
                    <div className="pt-2 border-t border-line/40">
                      <button
                        onClick={() =>
                          setShowToolsMap((prev) => ({
                            ...prev,
                            [m.id]: !prev[m.id],
                          }))
                        }
                        className="flex items-center gap-1.5 text-[11px] font-mono text-muted hover:text-ink transition-colors"
                      >
                        <Scale className="size-3 text-primary" />
                        <span>
                          {m.toolCalls.length} Institutional Tool{m.toolCalls.length > 1 ? "s" : ""} Executed
                        </span>
                        {showToolsMap[m.id] ? (
                          <ChevronUp className="size-3" />
                        ) : (
                          <ChevronDown className="size-3" />
                        )}
                      </button>

                      {showToolsMap[m.id] && (
                        <div className="mt-2 space-y-1.5 p-2 rounded-lg bg-obsidian border border-line text-[11px] font-mono">
                          {m.toolCalls.map((t, idx) => (
                            <div key={idx} className="border-b border-line/30 last:border-b-0 pb-1 last:pb-0">
                              <span className="text-primary font-bold">{t.tool}</span>:{" "}
                              <span className="text-muted">{t.outputSummary}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Structured Parlay Card */}
                  {m.parlaySummary && m.parlaySummary.legs.length > 0 && (
                    <div className="mt-3 p-3 rounded-xl bg-primary/5 border border-primary/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Flame className="size-4 text-primary animate-pulse" />
                          <span className="font-display font-bold text-xs uppercase tracking-wider text-primary">
                            Copula Correlated Ticket
                          </span>
                        </div>
                        <span className="font-mono font-bold text-sm text-ink px-2 py-0.5 rounded bg-primary/20 border border-primary/30">
                          {formatAmerican(m.parlaySummary.combinedAmericanOdds)}
                        </span>
                      </div>

                      {/* Probabilities Comparison */}
                      <div className="grid grid-cols-2 gap-2 text-center text-[11px] font-mono">
                        <div className="p-2 rounded-lg bg-obsidian border border-line">
                          <div className="text-muted text-[10px]">Copula Joint Hit %</div>
                          <div className="text-emerald-400 font-bold text-sm">
                            {(m.parlaySummary.copulaJointProb * 100).toFixed(1)}%
                          </div>
                          <div className="text-[9px] text-muted">
                            {m.parlaySummary.correlationBoostPct >= 0 ? "+" : ""}
                            {m.parlaySummary.correlationBoostPct.toFixed(1)}% tail boost
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-obsidian border border-line">
                          <div className="text-muted text-[10px]">Expected Value</div>
                          <div className="text-cyan-400 font-bold text-sm">
                            +{m.parlaySummary.jointEvPct.toFixed(1)}% EV
                          </div>
                          <div className="text-[9px] text-muted">
                            Kelly: {m.parlaySummary.recommendedKellyUnits}U
                          </div>
                        </div>
                      </div>

                      {/* Legs List */}
                      <div className="space-y-1.5 pt-1">
                        {m.parlaySummary.legs.map((leg, lIdx) => {
                          const inSlip = isLegSelected(sgpSlip, leg.selection, leg.marketType);
                          return (
                            <div
                              key={lIdx}
                              className="flex items-center justify-between p-2 rounded-lg bg-obsidian/70 border border-line text-xs"
                            >
                              <div className="flex flex-col">
                                <span className="font-medium text-ink">{leg.selection}</span>
                                <span className="text-[10px] text-muted">
                                  {leg.sport} • {formatAmerican(leg.price)} • {(leg.fairProb * 100).toFixed(1)}% fair
                                </span>
                              </div>
                              <button
                                onClick={() =>
                                  addLeg({
                                    eventId: leg.eventId,
                                    selection: leg.selection,
                                    marketType: leg.marketType,
                                    side: leg.side,
                                    point: leg.point,
                                    price: leg.price,
                                    fairProb: leg.fairProb,
                                    sport: leg.sport,
                                    player: leg.player,
                                    home: leg.team,
                                  })
                                }
                                disabled={inSlip}
                                className={cn(
                                  "px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 border transition-colors",
                                  inSlip
                                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 cursor-default"
                                    : "bg-primary text-primary-foreground hover:bg-primary/90 border-transparent"
                                )}
                              >
                                {inSlip ? <Check className="size-3" /> : <Plus className="size-3" />}
                                {inSlip ? "Added" : "Add"}
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* Add All Button */}
                      <button
                        onClick={() => addAllParlayLegs(m.parlaySummary!)}
                        className="w-full py-2 px-3 rounded-lg bg-primary text-primary-foreground font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
                      >
                        <Zap className="size-4" /> Add All {m.parlaySummary.legs.length} Legs to Parlay Slip
                      </button>
                    </div>
                  )}

                  {/* Structured Individual Bets */}
                  {(!m.parlaySummary || m.parlaySummary.legs.length === 0) &&
                    m.structuredBets &&
                    m.structuredBets.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                          <Target className="size-3 text-primary" /> Verified Model Plays
                        </div>
                        {m.structuredBets.map((bet, bIdx) => {
                          const inSlip = isLegSelected(sgpSlip, bet.selection, bet.marketType);
                          return (
                            <div
                              key={bIdx}
                              className="p-2.5 rounded-xl bg-obsidian border border-line flex flex-col gap-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-xs text-ink">{bet.selection}</span>
                                    <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-line/40 text-muted">
                                      {bet.sport}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-muted">
                                    Fair: {(bet.fairProb * 100).toFixed(1)}% vs Implied:{" "}
                                    {(
                                      (bet.waterfall?.marketAnchorProb ?? 0.5) * 100
                                    ).toFixed(1)}
                                    %
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="font-mono font-bold text-xs text-ink">
                                    {formatAmerican(bet.price)}
                                  </span>
                                  <button
                                    onClick={() =>
                                      addLeg({
                                        eventId: bet.eventId,
                                        selection: bet.selection,
                                        marketType: bet.marketType,
                                        side: bet.side,
                                        point: bet.point,
                                        price: bet.price,
                                        fairProb: bet.fairProb,
                                        sport: bet.sport,
                                        player: bet.player,
                                        home: bet.team,
                                      })
                                    }
                                    disabled={inSlip}
                                    className={cn(
                                      "px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 border transition-colors",
                                      inSlip
                                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 cursor-default"
                                        : "bg-primary text-primary-foreground hover:bg-primary/90 border-transparent"
                                    )}
                                  >
                                    {inSlip ? <Check className="size-3" /> : <Plus className="size-3" />}
                                    {inSlip ? "Added" : "Add"}
                                  </button>
                                </div>
                              </div>

                              {/* Mini Waterfall Factors */}
                              {bet.waterfall && (
                                <div className="grid grid-cols-3 gap-1 pt-1 border-t border-line/30 text-[9px] font-mono text-center">
                                  <div className="bg-panel p-1 rounded">
                                    <div className="text-muted">Edge</div>
                                    <div className="text-emerald-400 font-bold">+{bet.edgePct}%</div>
                                  </div>
                                  <div className="bg-panel p-1 rounded">
                                    <div className="text-muted">EV</div>
                                    <div className="text-cyan-400 font-bold">+{bet.evPct}%</div>
                                  </div>
                                  <div className="bg-panel p-1 rounded">
                                    <div className="text-muted">Smart $</div>
                                    <div className="text-primary font-bold">+{bet.waterfall.smartMoneyBp}bp</div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                </div>

                {/* Suggested follow-up prompt chips */}
                {m.suggestedFollowUps && m.suggestedFollowUps.length > 0 && !loading && (
                  <div className="flex flex-wrap gap-1.5 mt-1 px-1">
                    {m.suggestedFollowUps.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => handleSend(prompt)}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-panel hover:bg-line/40 border border-line text-muted hover:text-ink transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-panel border border-line text-xs text-muted w-fit animate-pulse">
              <RefreshCw className="size-4 animate-spin text-primary" />
              <span>Simulating 10,000 Monte Carlo paths & Clayton Copula dependence...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Footer */}
        <div className="p-3 border-t border-line bg-panel/60">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the Quant Desk (e.g. 'Build me a 3-leg NBA parlay under +400')..."
              className="flex-1 bg-obsidian border border-line rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:border-primary transition-colors"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="size-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-primary/20 shrink-0"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
