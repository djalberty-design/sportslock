import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Activity, CheckCircle2, XCircle, Clock, Wifi } from "lucide-react";
import { getOddsQuotaFn } from "@/lib/market/server";
import { useDeskDecision } from "@/lib/market/use-board";

export const Route = createFileRoute("/admin/terminal")({ component: LiveStatus });

type FeedStatus = {
  name: string;
  status: "connected" | "disabled" | "unknown";
  detail: string;
};

function LiveStatus() {
  const { snapshot } = useDeskDecision();
  const [quota, setQuota] = useState<number | null>(null);
  const [lastRefresh] = useState(new Date().toISOString());

  useEffect(() => {
    getOddsQuotaFn().then(setQuota).catch(() => {});
  }, []);

  // Derive connection status from the live snapshot
  const quoteCount = snapshot?.quotes?.length ?? 0;
  const briefCount = snapshot?.briefs?.length ?? 0;
  const sports = [...new Set(snapshot?.quotes?.map((q: any) => q.sport) || [])];
  const sourceNote = snapshot?.sourceNote || "";

  const feeds: FeedStatus[] = [
    {
      name: "The Odds API",
      status: quoteCount > 0 ? "connected" : "unknown",
      detail: quoteCount > 0
        ? `${quoteCount} quotes across ${sports.join(", ")}. Quota: ${quota ?? "?"} / 500`
        : "No quotes loaded yet",
    },
    {
      name: "ESPN Scoreboard",
      status: "disabled",
      detail: "Disabled per admin request. Re-enable in live-board.ts line 739.",
    },
    {
      name: "Kalshi Markets",
      status: snapshot?.predictions?.some((p: any) => p.kalshiHome != null) ? "connected" : "unknown",
      detail: snapshot?.predictions?.filter((p: any) => p.kalshiHome != null).length
        ? `${snapshot?.predictions?.filter((p: any) => p.kalshiHome != null).length} events with Kalshi data`
        : "No Kalshi contracts matched to events",
    },
    {
      name: "Polymarket",
      status: snapshot?.predictions?.some((p: any) => p.polyHome != null) ? "connected" : "unknown",
      detail: snapshot?.predictions?.filter((p: any) => p.polyHome != null).length
        ? `${snapshot?.predictions?.filter((p: any) => p.polyHome != null).length} events with Polymarket data`
        : "No Polymarket contracts matched to events",
    },
    {
      name: "Action Network Tape",
      status: sourceNote.includes("tape") ? "connected" : "unknown",
      detail: sourceNote.includes("tape")
        ? sourceNote.split("tape")[0]?.trim()?.split(".").pop()?.trim() || "Tape data present"
        : "No public ticket/handle tape",
    },
    {
      name: "Postgres Database",
      status: quoteCount > 0 ? "connected" : "unknown",
      detail: quoteCount > 0 ? "Connected — odds cache operational" : "Checking...",
    },
  ];

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "connected") return <CheckCircle2 className="size-5 text-emerald-400" />;
    if (status === "disabled") return <XCircle className="size-5 text-red-400" />;
    return <Clock className="size-5 text-amber-400" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2 text-ink">
          <Wifi className="size-5 text-primary" />
          Live Brain Connections
        </h2>
        <span className="text-xs font-mono text-muted">
          Refreshed {new Date(lastRefresh).toLocaleTimeString()}
        </span>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-obsidian rounded-xl border border-line p-4 text-center">
          <div className="text-2xl font-mono font-bold text-primary">{briefCount}</div>
          <div className="text-xs text-muted mt-1">Events Tracked</div>
        </div>
        <div className="bg-obsidian rounded-xl border border-line p-4 text-center">
          <div className="text-2xl font-mono font-bold text-primary">{quoteCount}</div>
          <div className="text-xs text-muted mt-1">Market Quotes</div>
        </div>
        <div className="bg-obsidian rounded-xl border border-line p-4 text-center">
          <div className="text-2xl font-mono font-bold text-primary">{sports.length}</div>
          <div className="text-xs text-muted mt-1">Active Sports</div>
        </div>
      </div>

      {/* Feed status list */}
      <div className="space-y-3">
        {feeds.map((feed) => (
          <div key={feed.name} className="flex items-center gap-4 bg-obsidian rounded-xl border border-line p-4">
            <StatusIcon status={feed.status} />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-ink text-sm">{feed.name}</div>
              <div className="text-xs text-muted truncate">{feed.detail}</div>
            </div>
            <span className={`text-xs font-mono px-2 py-1 rounded-md ${
              feed.status === "connected" ? "bg-emerald-500/10 text-emerald-400" :
              feed.status === "disabled" ? "bg-red-500/10 text-red-400" :
              "bg-amber-500/10 text-amber-400"
            }`}>
              {feed.status === "connected" ? "LIVE" : feed.status === "disabled" ? "OFF" : "IDLE"}
            </span>
          </div>
        ))}
      </div>

      {/* Source note */}
      {sourceNote && (
        <div className="font-mono text-xs bg-obsidian border border-line rounded-xl p-4 text-muted whitespace-pre-wrap">
          {sourceNote}
        </div>
      )}
    </div>
  );
}