import { useState, useEffect } from "react";
import { createServerFn } from "@tanstack/react-start";
import { getLedgerTickets } from "@/lib/ledger-api";
import { runSweeper } from "@/lib/sweeper-api";

export const executeSweep = createServerFn({ method: "POST" }).handler(async () => { return await runSweeper(); });

export const fetchLedgerTickets = createServerFn({ method: "GET" }).handler(async () => {
  return await getLedgerTickets();
});

export function LedgerPanel() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSweeping, setIsSweeping] = useState(false);

  useEffect(() => {
    fetchLedgerTickets().then((data) => {
      setTickets(data);
      setIsLoading(false);
    }).catch(err => {
      console.error(err);
      setIsLoading(false);
    });
  }, []);

  const totalTickets = tickets.length;
  const totalStake = tickets.reduce((acc, t) => acc + Number(t.stake || 0), 0);
  const hits = tickets.filter(t => t.result === 'hit' || t.result === 'win').length;
  const misses = tickets.filter(t => t.result === 'miss' || t.result === 'loss').length;
  const settled = hits + misses;
  const hitRate = settled > 0 ? ((hits / settled) * 100).toFixed(1) + '%' : '--';

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-md">
          <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Tickets</div>
          <div className="text-2xl font-display text-white">{totalTickets}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-md">
          <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Hit Rate</div>
          <div className="text-2xl font-display text-white">{hitRate}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-md">
          <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Hits / Misses</div>
          <div className="text-2xl font-display text-white">{hits} / {misses}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-md">
          <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Stake Logged</div>
          <div className="text-2xl font-display text-white">${totalStake.toFixed(2)}</div>
        </div>
      </div>

            <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-white uppercase tracking-wider">Master Ledger</h3>
        <button 
          onClick={async () => {
            setIsSweeping(true);
            try {
              await executeSweep();
              const fresh = await fetchLedgerTickets({ data: undefined });
              setTickets(fresh);
            } catch(e) {
              alert('Sweep failed: ' + e);
            } finally {
              setIsSweeping(false);
            }
          }}
          disabled={isSweeping}
          className="px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/50 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-emerald-500/20 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {isSweeping ? 'Sweeping Database...' : 'Run Auto-Sweeper'}
        </button>
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
        <div className="grid grid-cols-12 gap-4 p-4 border-b border-zinc-800 text-xs font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950/50">
          <div className="col-span-2">Date</div>
          <div className="col-span-5">Legs</div>
          <div className="col-span-2 text-right">Odds</div>
          <div className="col-span-2 text-center">Status</div>
          <div className="col-span-1 text-right">Stake</div>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-zinc-500 font-mono text-sm">Loading ledger...</div>
        ) : tickets.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 font-mono text-sm">No tickets in the master ledger yet.</div>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {tickets.map((t, i) => (
              <div key={i} className="grid grid-cols-12 gap-4 p-4 items-center text-sm font-mono hover:bg-zinc-800/30 transition-colors">
                <div className="col-span-2 text-zinc-400 text-xs">{new Date(t.created_at).toLocaleDateString()}</div>
                <div className="col-span-5 space-y-1">
                  {(t.legs || []).map((leg: any, idx: number) => (
                    <div key={idx} className="truncate text-zinc-300 text-xs">
                      <span className="text-emerald-500 mr-2">✓</span>
                      {leg.selection}
                    </div>
                  ))}
                </div>
                <div className="col-span-2 text-right text-zinc-300">{t.combined_odds > 0 ? '+' : ''}{t.combined_odds}</div>
                <div className="col-span-2 flex justify-center">
                  {t.status === 'pending' ? (
                    <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
                      Pending
                    </span>
                  ) : (t.result === 'win' || t.result === 'hit') ? (
                    <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Win
                    </span>
                  ) : (t.result === 'loss' || t.result === 'miss') ? (
                    <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
                      Loss
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-400">
                      {t.result || t.status}
                    </span>
                  )}
                </div>
                <div className="col-span-1 text-right text-zinc-300">${Number(t.stake).toFixed(0)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

