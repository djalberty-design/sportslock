import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { buildLiveSnapshot } from '@/lib/market/live-board';
import { buildScan } from '@/lib/market/engine';
import { buildDeskPicks } from '@/lib/market/picks';

const getBrainData = createServerFn({ method: 'GET' }).handler(async () => {
  const snapshot = await buildLiveSnapshot();
  const scan = buildScan(snapshot, false);
  const bag = buildDeskPicks(scan, snapshot);
  return bag.all;
});

export const Route = createFileRoute('/admin/brain')({
  loader: async () => getBrainData(),
  component: BrainTelemetry,
});

function BrainTelemetry() {
  const picks = Route.useLoaderData() as any[];

  function escapeCsv(val: any) {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function downloadCSV() {
    const headers = ['ID', 'Event', 'Sport', 'Selection', 'Market', 'Price', 'True Prob', 'Calc Edge'];
    const rows = picks.map(p => [
      escapeCsv(p.id),
      escapeCsv(p.event),
      escapeCsv(p.sport),
      escapeCsv(p.selection),
      escapeCsv(p.market),
      escapeCsv(p.price),
      escapeCsv(p.trueProb),
      escapeCsv(p.edge)
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'brain_telemetry.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-display text-ink">Brain Telemetry</h2>
        <button type="button" onClick={downloadCSV} className="rounded-md bg-gold px-4 py-2 text-sm font-bold text-navy-deep hover:brightness-110 transition-all cursor-pointer">
          Download Raw CSV
        </button>
      </div>

      <div className="rounded-md bg-zinc-900 border border-zinc-800 p-4 font-mono text-sm">
        <h3 className="mb-4 font-display text-lg text-white">Live System Diagnostics</h3>
        <ul className="space-y-3">
          {['Initialize Global Market Snapshot', 'Ingest ESPN Public Odds Pipeline', 'Ingest Kalshi Prediction Feed', 'Ingest Polymarket Prediction Feed', 'Parse OCR Hard Rock Bet Slips', 'Normalize Cross-Platform Team Nomenclature', 'Filter Expired & Active Live Events', 'Convert American Odds to Decimal Payouts', 'Calculate True Probability via Market Shares', 'Execute Quantitative Edge Formula', 'Filter Strictly Positive EV Propositions', 'Sort Global Board by Maximum Mathematical Edge', 'De-duplicate Same-Game Parlay Constraints', 'Compound Top-3 Leg Probabilities', 'Calculate Final Accumulator Edge', 'Validate Admin Allowlist Authorization', 'Ping Master Postgres Ledger', 'Generate Optimal Hard Rock Slip'].map((node, i) => (
            <li key={i} className="flex items-center justify-between border-b border-zinc-800/50 pb-3 last:border-0 last:pb-0">
              <span className="text-zinc-300">{node}</span>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-emerald-500 font-bold tracking-wider text-xs">OPERATIONAL</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-md bg-zinc-950 p-4 overflow-auto max-h-[70vh]">
        <pre className="text-xs text-zinc-300">
          <code>{JSON.stringify(picks, null, 2)}</code>
        </pre>
      </div>
    </div>
  );
}