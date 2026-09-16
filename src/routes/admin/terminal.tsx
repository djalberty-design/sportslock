import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { getPredictionLogs } from "@/lib/market/server";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export const Route = createFileRoute("/admin/terminal")({
  loader: async () => {
    return getPredictionLogs();
  },
  component: QuantitativeTerminal,
});

function QuantitativeTerminal() {
  const logs = Route.useLoaderData() as any[];
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const chronologicalLogs = [...logs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  
  let cumulativeProfit = 0;
  const cumulativeData = chronologicalLogs.map(log => {
    let pnl = 0;
    if (log.status === "WIN") {
      pnl = log.price < 0 ? (100 / Math.abs(log.price)) : (log.price / 100);
    } else if (log.status === "LOSS") {
      pnl = -1;
    }
    cumulativeProfit += pnl;
    return {
      date: new Date(log.created_at).toLocaleDateString(),
      profit: parseFloat(cumulativeProfit.toFixed(2)),
    };
  });

  const marketStats: Record<string, { wins: number, total: number }> = {};
  for (const log of logs) {
    if (log.status === "PENDING" || log.status === "PUSH") continue;
    const mType = log.market_type || "moneyline";
    if (!marketStats[mType]) marketStats[mType] = { wins: 0, total: 0 };
    
    marketStats[mType].total++;
    if (log.status === "WIN") {
      marketStats[mType].wins++;
    }
  }

  const marketData = Object.entries(marketStats).map(([name, stats]) => ({
    name: name.toUpperCase(),
    winRate: parseFloat(((stats.wins / stats.total) * 100).toFixed(1)),
  }));

  const totalROI = cumulativeProfit;
  const totalGraded = logs.filter(l => l.status === "WIN" || l.status === "LOSS").length;
  const totalWins = logs.filter(l => l.status === "WIN").length;
  const overallWinRate = totalGraded > 0 ? ((totalWins / totalGraded) * 100).toFixed(1) : 0;
  const activeSweeperVolume = logs.filter(l => l.snapshot?.isPaperTrade).length;

  async function handleGenerateReport() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/strategy');
      const data = await res.json();
      setReport(data.report);
    } catch (err) {
      console.error(err);
      setReport("[ERROR] Failed to fetch strategy report.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-12 font-mono">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <span className="text-blue-500">◆</span> Quantitative Admin Terminal
            </h1>
            <p className="text-zinc-400 mt-2">
              Macro algorithmic performance and portfolio telemetry.
            </p>
          </div>
          <button 
            onClick={handleGenerateReport} 
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md font-bold text-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Generating..." : "Generate AI Strategy Report"}
          </button>
        </header>

        {/* AI Strategy Report Block */}
        {report && (
          <div className="bg-indigo-950/20 border border-indigo-500/30 p-6 rounded-xl text-indigo-100 whitespace-pre-wrap mt-6">
            <h2 className="text-lg font-bold text-indigo-400 mb-4 flex items-center gap-2">
              <span>✦</span> CHIEF RISK OFFICER REPORT
            </h2>
            <div className="prose prose-invert prose-indigo max-w-none text-sm leading-relaxed">
              {report}
            </div>
          </div>
        )}

        {/* Top Row: Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="text-sm text-zinc-500 font-bold uppercase tracking-wider mb-2">Total ROI (Units)</div>
            <div className={`text-4xl font-bold ${totalROI >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {totalROI > 0 ? '+' : ''}{totalROI.toFixed(2)}U
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="text-sm text-zinc-500 font-bold uppercase tracking-wider mb-2">Overall Win Rate</div>
            <div className="text-4xl font-bold text-zinc-100">
              {overallWinRate}%
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="text-sm text-zinc-500 font-bold uppercase tracking-wider mb-2">Sweeper Volume</div>
            <div className="text-4xl font-bold text-indigo-400">
              {activeSweeperVolume} <span className="text-lg text-zinc-600">trades</span>
            </div>
          </div>
        </div>

        {/* Middle Row: Recharts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Cumulative P&L */}
          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-zinc-400 font-bold tracking-wider uppercase text-sm mb-6">Cumulative P&L (Units)</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cumulativeData}>
                  <XAxis dataKey="date" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val > 0 ? '+' : ''}${val}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#f4f4f5' }}
                    itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="profit" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6, fill: '#10b981' }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Win Rate by Market */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-zinc-400 font-bold tracking-wider uppercase text-sm mb-6">Win Rate by Market</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={marketData} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis dataKey="name" type="category" stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{ fill: '#27272a' }}
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#f4f4f5' }}
                    formatter={(value: number) => [`${value}%`, 'Win Rate']}
                  />
                  <Bar dataKey="winRate" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}