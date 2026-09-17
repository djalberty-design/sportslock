import { useState, useEffect } from "react";
import { createServerFn } from "@tanstack/react-start";
import { getTuning, updateTuning, type TuningConfig, DEFAULT_TUNING } from "@/lib/tuning-api";

export const fetchTuningConfig = createServerFn({ method: "GET" }).handler(async () => {
  return await getTuning();
});

export const saveTuningConfig = createServerFn({ method: "POST" })
  .validator((d: TuningConfig) => d)
  .handler(async ({ data }) => {
    return await updateTuning(data);
  });

export function TuningPanel() {
  const [minEdge, setMinEdge] = useState(DEFAULT_TUNING.minEdge);
  const [kellyMultiplier, setKellyMultiplier] = useState(DEFAULT_TUNING.kellyMultiplier);
  const [maxLegs, setMaxLegs] = useState(DEFAULT_TUNING.maxLegs);
  const [activeFeeds, setActiveFeeds] = useState<Record<string, boolean>>(DEFAULT_TUNING.activeFeeds);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    fetchTuningConfig().then((config) => {
      setMinEdge(config.minEdge);
      setKellyMultiplier(config.kellyMultiplier);
      setMaxLegs(config.maxLegs);
      setActiveFeeds(config.activeFeeds);
      setIsLoading(false);
    }).catch(err => {
      console.error("Failed to load tuning config", err);
      setIsLoading(false);
    });
  }, []);

  const toggleFeed = (feed: string) => {
    setActiveFeeds(prev => ({ ...prev, [feed]: !prev[feed] }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveTuningConfig({ data: { minEdge, kellyMultiplier, maxLegs, activeFeeds } });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save tuning config", err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="text-zinc-500 font-mono text-sm p-6">Loading algorithmic parameters...</div>;
  }

  return (
    <div className="rounded-md bg-zinc-900 border border-zinc-800 p-6 font-mono text-sm max-w-2xl">
      <h3 className="mb-6 font-display text-xl text-white">Algorithmic Tuning</h3>
      
      <div className="space-y-8">
        {/* Min Edge */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-zinc-300 font-bold uppercase tracking-wider text-xs">Minimum Edge Floor (%)</label>
            <span className="text-emerald-400 font-bold">{minEdge.toFixed(1)}%</span>
          </div>
          <input 
            type="range" 
            min="0" max="10" step="0.1" 
            value={minEdge} 
            onChange={(e) => setMinEdge(parseFloat(e.target.value))}
            className="w-full accent-emerald-500 cursor-pointer"
          />
          <p className="text-xs text-zinc-500">Propositions below this threshold will be discarded.</p>
        </div>

        {/* Kelly Multiplier */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-zinc-300 font-bold uppercase tracking-wider text-xs">Kelly Multiplier</label>
            <span className="text-emerald-400 font-bold">{kellyMultiplier.toFixed(2)}x</span>
          </div>
          <input 
            type="range" 
            min="0" max="1" step="0.05" 
            value={kellyMultiplier} 
            onChange={(e) => setKellyMultiplier(parseFloat(e.target.value))}
            className="w-full accent-emerald-500 cursor-pointer"
          />
          <p className="text-xs text-zinc-500">Scales the optimal fraction of bankroll to wager.</p>
        </div>

        {/* Max Combo Legs */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-zinc-300 font-bold uppercase tracking-wider text-xs">Max Combo Legs</label>
            <span className="text-emerald-400 font-bold">{maxLegs} Legs</span>
          </div>
          <input 
            type="range" 
            min="1" max="10" step="1" 
            value={maxLegs} 
            onChange={(e) => setMaxLegs(parseInt(e.target.value, 10))}
            className="w-full accent-emerald-500 cursor-pointer"
          />
          <p className="text-xs text-zinc-500">Maximum allowed events grouped into a single parlay slip.</p>
        </div>

        {/* Feeds */}
        <div className="space-y-3 pt-4 border-t border-zinc-800">
          <label className="text-zinc-300 font-bold uppercase tracking-wider text-xs block mb-4">Active Market Feeds</label>
          <div className="flex gap-4">
            {(["MLB", "NFL", "NCAAF"]).map(feed => (
              <button
                key={feed}
                type="button"
                onClick={() => toggleFeed(feed)}
                className={`flex-1 py-3 rounded-md border text-sm font-bold transition-colors cursor-pointer ${
                  activeFeeds[feed] 
                    ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' 
                    : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                }`}
              >
                {feed}
              </button>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-6">
          <button 
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className={`w-full py-3 rounded-md font-bold text-sm transition-all cursor-pointer ${
              isSaved 
                ? 'bg-emerald-500 text-zinc-950' 
                : 'bg-emerald-500 hover:brightness-110 text-zinc-950'
            }`}
          >
            {isSaved ? 'Saved!' : isSaving ? 'Saving...' : 'Save Engine Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}