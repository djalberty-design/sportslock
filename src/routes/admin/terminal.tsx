import { createFileRoute } from "@tanstack/react-router";
import { Terminal as TermIcon, Activity } from "lucide-react";

export const Route = createFileRoute("/admin/terminal")({ component: Telemetry });

function Telemetry() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2 text-ink">
        <Activity className="size-5 text-primary" />
        Live Engine Telemetry
      </h2>
      
      <div className="font-mono text-sm bg-obsidian border border-line rounded-xl p-4 h-96 overflow-y-auto">
        <div className="text-muted">[{new Date().toISOString()}] System initialized.</div>
        <div className="text-muted">[{new Date().toISOString()}] Connecting to sportsbooks...</div>
        <div className="text-primary mt-2">[{new Date().toISOString()}] Scraping lines from Hard Rock FL.</div>
        <div className="text-ink">[{new Date().toISOString()}] Devigging 14 active markets...</div>
        <div className="text-ink">[{new Date().toISOString()}] Phase 8 Syndication applied to 42 player props.</div>
        <div className="text-primary mt-2">[{new Date().toISOString()}] Combinatorics scanner active.</div>
        <div className="text-muted">[{new Date().toISOString()}] Waiting for websocket broadcast...</div>
      </div>
    </div>
  );
}