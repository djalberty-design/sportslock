import { useState, useEffect } from "react";
import { createServerFn } from "@tanstack/react-start";
import { getTuning, updateTuning, TuningConfig } from "@/lib/tuning-api";

const fetchTuning = createServerFn({ method: "GET" }).handler(async () => {
  return await getTuning();
});

const saveTuning = createServerFn({ method: "POST" })
  .validator((data: TuningConfig) => data)
  .handler(async ({ data }) => {
    return await updateTuning(data);
  });

export function TuningPanel() {
  const [config, setConfig] = useState<TuningConfig>({
    minEdge: 2.5,
    kellyMultiplier: 0.25,
    maxLegs: 3,
    activeFeeds: ["espn", "kalshi", "polymarket"],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTuning().then((data) => {
      setConfig(data);
      setIsLoading(false);
    }).catch(err => {
      console.error(err);
      setIsLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveTuning({ data: config });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert("Failed to save tuning: " + e);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-zinc-500 font-mono text-sm">Loading tuning variables...</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl font-mono">
      <div className="bg-zinc-900 border border-zinc-800 rounded-md p-6 space-y-6">
        <h3 className="text-lg font-bold text-white uppercase tracking-wider border-b border-zinc-800 pb-2">
          Algorithmic Tuning
        </h3>
        
        {/* Min Edge Slider */}
        <div className="space-y-4">
          <div className="flex justify-between">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Minimum Edge Floor (%)</label>
            <span className="text-emerald-400 font-bold">{config.minEdge.toFixed(1)}%</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="15.0"
            step="0.1"
            value={config.minEdge}
            onChange={(e) => setConfig({ ...config, minEdge: parseFloat(e.target.value) })}
            className="w-full accent-emerald-500"
          />
          <p className="text-[10px] text-zinc-500">Absolute minimum +EV required for a leg to pass the sanity filter.</p>
        </div>

        <div className="pt-4 border-t border-zinc-800">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/50 rounded-md text-sm font-bold uppercase tracking-wider hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
          >
            {saved ? "✔ Master Engine Updated" : isSaving ? "Locking..." : "Save Variables"}
          </button>
        </div>
      </div>
    </div>
  );
}