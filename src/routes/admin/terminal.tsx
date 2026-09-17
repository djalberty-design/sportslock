import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getLedgerTickets } from "@/lib/ledger-api";

const fetchTerminalData = createServerFn({ method: "GET" }).handler(async () => {
  const tickets = await getLedgerTickets();
  return tickets;
});

export const Route = createFileRoute("/admin/terminal")({
  loader: async () => fetchTerminalData(),
  component: TerminalDashboard,
});

function americanToDecimal(american: number): number {
  if (!american) return 0;
  if (american > 0) return (american / 100) + 1;
  return (100 / Math.abs(american)) + 1;
}

function TerminalDashboard() {
  const tickets = Route.useLoaderData() as any[];

  // Math & Aggregations
  const totalTickets = tickets.length;
  const pendingTickets = tickets.filter((t) => t.status === "pending");
  const settledTickets = tickets.filter((t) => t.status === "settled");

  const hits = settledTickets.filter((t) => t.result === "hit");
  const misses = settledTickets.filter((t) => t.result === "miss");

  const hitRate = settledTickets.length > 0 ? ((hits.length / settledTickets.length) * 100).toFixed(1) : "0.0";

  // Financials
  const totalStaked = settledTickets.reduce((acc, t) => acc + Number(t.stake || 0), 0);
  const totalPendingRisk = pendingTickets.reduce((acc, t) => acc + Number(t.stake || 0), 0);

  const grossReturn = hits.reduce((acc, t) => {
    const dec = americanToDecimal(Number(t.combined_odds));
    return acc + (Number(t.stake) * dec);
  }, 0);

  const netProfit = grossReturn - totalStaked;
  const roi = totalStaked > 0 ? ((netProfit / totalStaked) * 100).toFixed(2) : "0.00";
  
  const isProfitable = netProfit >= 0;

  return (
    <div className="space-y-8 p-6 md:p-10 max-w-6xl mx-auto font-mono">
      <header className="space-y-2 mb-8 border-b border-zinc-800 pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <span className="text-emerald-500">📈</span> Macro Terminal
        </h1>
        <p className="text-zinc-400">
          Live quantitative performance and cumulative ROI tracking.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Net Profit */}
        <div className={`p-6 rounded-xl border ${isProfitable ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <div className="text-xs font-bold uppercase tracking-wider mb-2 text-zinc-400">Net Profit (Settled)</div>
          <div className={`text-4xl font-bold ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
            {isProfitable ? '+' : '-'}${Math.abs(netProfit).toFixed(2)}
          </div>
        </div>

        {/* ROI */}
        <div className={`p-6 rounded-xl border ${isProfitable ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <div className="text-xs font-bold uppercase tracking-wider mb-2 text-zinc-400">Yield (ROI)</div>
          <div className={`text-4xl font-bold ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
            {isProfitable ? '+' : ''}{roi}%
          </div>
        </div>

        {/* Win Rate */}
        <div className="p-6 rounded-xl bg-zinc-900 border border-zinc-800">
          <div className="text-xs font-bold uppercase tracking-wider mb-2 text-zinc-400">Hit Rate</div>
          <div className="text-4xl font-bold text-white">{hitRate}%</div>
          <div className="text-xs text-zinc-500 mt-2">{hits.length}W - {misses.length}L</div>
        </div>

        {/* Open Risk */}
        <div className="p-6 rounded-xl bg-zinc-900 border border-zinc-800">
          <div className="text-xs font-bold uppercase tracking-wider mb-2 text-zinc-400">Open Risk (Pending)</div>
          <div className="text-4xl font-bold text-amber-400">${totalPendingRisk.toFixed(2)}</div>
          <div className="text-xs text-zinc-500 mt-2">{pendingTickets.length} active slips</div>
        </div>
      </div>
      
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mt-8">
         <h3 className="text-lg font-bold text-white mb-4">Volume Metrics</h3>
         <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
               <span className="text-zinc-500 block mb-1 uppercase text-xs font-bold">Total Staked (Settled)</span>
               <span className="text-zinc-300">${totalStaked.toFixed(2)}</span>
            </div>
            <div>
               <span className="text-zinc-500 block mb-1 uppercase text-xs font-bold">Total Returned</span>
               <span className="text-zinc-300">${grossReturn.toFixed(2)}</span>
            </div>
            <div>
               <span className="text-zinc-500 block mb-1 uppercase text-xs font-bold">Total Lifetime Tickets</span>
               <span className="text-zinc-300">{totalTickets} generated</span>
            </div>
         </div>
      </div>
    </div>
  );
}

