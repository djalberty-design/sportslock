import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { buildLiveSnapshot } from "@/lib/market/live-board";
import { buildScan } from "@/lib/market/engine";
import { buildDeskPicks } from "@/lib/market/picks";
import { insertLedgerTicket } from "@/lib/ledger-api";

const getOptimalPicks = createServerFn({ method: "GET" }).handler(async () => {
  const snapshot = await buildLiveSnapshot();
  const scan = await buildScan(snapshot, false);
  const bag = buildDeskPicks(scan, snapshot);
  return bag.all;
});

const lockTicket = createServerFn({ method: "POST" })
  .validator((data: { legs: any; combinedOdds: number; trueProb: number; stake: number }) => data)
  .handler(async ({ data }) => {
    await insertLedgerTicket(data);
    return { success: true };
  });

export const Route = createFileRoute("/admin/architect")({
  loader: async () => {
    return getOptimalPicks();
  },
  component: ParlayArchitect,
});

function decimalToAmerican(dec: number): number {
  if (dec <= 1) return -10000;
  if (dec < 2) return Math.round(-100 / (dec - 1));
  return Math.round((dec - 1) * 100);
}

function ParlayArchitect() {
  const picks = Route.useLoaderData() as any[];
  const [isLocking, setIsLocking] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const now = Date.now();
  const withEdge = picks
    .map((p) => {
      const payout = p.decimalPayout || (p.price < 0 ? 100 / Math.abs(p.price) + 1 : p.price / 100 + 1);
      const chance = p.chance || 0;
      return {
        ...p,
        calcPayout: payout,
        calcEdge: chance * payout - 1,
      };
    })
    .filter((p) => {
      if (!p.start) return false;
      const startMs = new Date(p.start).getTime();
      return startMs > now && p.calcEdge > 0.01;
    })
    .sort((a, b) => b.calcEdge - a.calcEdge);

  const uniqueEvents = new Set<string>();
  const top3 = [];
  for (const p of withEdge) {
    if (p.eventId && !uniqueEvents.has(p.eventId)) {
      uniqueEvents.add(p.eventId);
      top3.push(p);
      if (top3.length === 3) break;
    }
  }

  const combinedProb = top3.reduce((acc, p) => acc * p.chance, 1);
  const combinedPayout = top3.reduce((acc, p) => acc * p.calcPayout, 1);
  const parlayEdge = combinedProb * combinedPayout - 1;
  const combinedAmerican = decimalToAmerican(combinedPayout);

  const handleLock = async () => {
    setIsLocking(true);
    await lockTicket({
      data: {
        legs: top3,
        combinedOdds: combinedAmerican,
        trueProb: combinedProb,
        stake: 25 // Default stake
      }
    });
    setIsLocking(false);
    setIsLocked(true);
    setTimeout(() => setIsLocked(false), 2000);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-12 font-mono flex justify-center items-center">
      <div className="max-w-2xl w-full space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <span className="text-emerald-500">⚡</span> Parlay Architect
          </h1>
          <p className="text-zinc-400">
            Autonomous +EV accumulator construction. Exploiting algorithmic edges sequentially.
          </p>
        </header>

        {top3.length > 0 ? (
          <div className="bg-zinc-900 border-2 border-emerald-500/50 rounded-xl p-6 shadow-2xl shadow-emerald-900/20">
            <h2 className="text-lg font-bold text-emerald-400 mb-4 border-b border-zinc-800 pb-2 uppercase tracking-wider">
              Optimal {top3.length}-Leg Slip
            </h2>
            
            <div className="space-y-4 mb-6">
              {top3.map((leg, idx) => (
                <div key={leg.id || idx} className="bg-zinc-950/50 p-4 rounded-lg border border-zinc-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="font-bold text-zinc-100 text-lg">{leg.selection}</h3>
                    <p className="text-sm text-zinc-400 capitalize mt-1">
                      {leg.sport} • {leg.marketType || "Moneyline"}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-white text-lg">
                      {leg.price > 0 ? "+" : ""}{leg.price}
                    </div>
                    <div className="text-xs text-emerald-400 font-bold tracking-wider mt-1">
                      +{(leg.calcEdge * 100).toFixed(2)}% EDGE
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-lg p-5">
              <div className="flex justify-between items-center mb-3">
                <span className="text-zinc-400 text-sm font-bold uppercase tracking-wider">Combined Odds</span>
                <span className="text-2xl font-bold text-white">
                  {combinedAmerican > 0 ? "+" : ""}{combinedAmerican}
                </span>
              </div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-zinc-400 text-sm font-bold uppercase tracking-wider">True Probability</span>
                <span className="text-lg font-bold text-zinc-200">
                  {(combinedProb * 100).toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-emerald-500/20">
                <span className="text-emerald-400 text-sm font-bold uppercase tracking-wider">Parlay Edge</span>
                <span className="text-2xl font-bold text-emerald-400">
                  +{(parlayEdge * 100).toFixed(2)}%
                </span>
              </div>
            </div>
            
            <button
              onClick={handleLock}
              disabled={isLocking || isLocked}
              className={`w-full mt-6 py-4 rounded-lg font-bold uppercase tracking-widest transition-colors shadow-lg shadow-gold/20 flex justify-center items-center gap-2 ${
                isLocked 
                  ? "bg-emerald-600 text-white" 
                  : "bg-gold text-navy-deep hover:bg-[#e6a627]"
              }`}
            >
              {isLocked ? "✔ Locked in Ledger" : isLocking ? "Locking..." : "Lock It In"}
            </button>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center text-zinc-500 border-dashed">
            No strictly +EV picks available on the live board.
          </div>
        )}
      </div>
    </div>
  );
}