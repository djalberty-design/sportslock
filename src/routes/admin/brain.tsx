import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { buildLiveSnapshot } from "@/lib/market/live-board";
import { buildScan } from "@/lib/market/engine";
import { buildDeskPicks } from "@/lib/market/picks";

const getBrainData = createServerFn({ method: "GET" }).handler(async () => {
  const snapshot = await buildLiveSnapshot();
  const scan = buildScan(snapshot, false);
  const bag = buildDeskPicks(scan, snapshot);
  return bag.all;
});

export const Route = createFileRoute("/admin/brain")({
  loader: async () => getBrainData(),
  component: BrainTelemetry,
});

function BrainTelemetry() {
  const picks = Route.useLoaderData() as any[];

  function downloadCSV() {
    const headers = ["ID", "Event", "Sport", "Selection", "Market", "Price", "True Prob", "Calc Edge"];
    const rows = picks.map(p => [
      p.id,
      " + (p.event || "").replace(/"/g, '""') + ",
      p.sport,
      " + (p.selection || "").replace(/"/g, '""') + ",
      p.market,
      p.price,
      p.trueProb,
      p.edge
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = rain_telemetry.csv;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-display text-ink">Brain Telemetry</h2>
        <button
          type="button"
          onClick={downloadCSV}
          className="rounded-md bg-gold px-4 py-2 text-sm font-bold text-navy-deep hover:brightness-110 transition-all cursor-pointer"
        >
          Download Raw CSV
        </button>
      </div>
      <div className="rounded-md bg-zinc-950 p-4 overflow-auto max-h-[70vh]">
        <pre className="text-xs text-zinc-300">
          <code>{JSON.stringify(picks, null, 2)}</code>
        </pre>
      </div>
    </div>
  );
}