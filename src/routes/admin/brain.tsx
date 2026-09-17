import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Sliders, Cpu, Save, Check, Loader2 } from "lucide-react";
import { getTuningFn, saveTuningFn } from "@/lib/market/server";

export const Route = createFileRoute("/admin/brain")({ component: EngineBay });

function EngineBay() {
  const [kelly, setKelly] = useState(0.25);
  const [maxLegs, setMaxLegs] = useState(4);
  const [minEdge, setMinEdge] = useState(3.5);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load saved tuning from DB on mount
  useEffect(() => {
    getTuningFn().then((t) => {
      setKelly(t.kelly);
      setMaxLegs(t.maxLegs);
      setMinEdge(t.minEdge);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await saveTuningFn({ data: { kelly, maxLegs, minEdge } });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (e) {
      console.error("Failed to save tuning:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2 text-ink">
          <Cpu className="size-5 text-primary" />
          Engine Tuning
        </h2>
        <button
          onClick={handleSave}
          disabled={saving || !loaded}
          className="flex items-center gap-2 bg-primary text-primary-foreground font-bold px-4 py-2 rounded-lg hover:bg-primary/90 transition-all active:scale-95 shadow-apex-glow disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : saved ? (
            <Check className="size-4" />
          ) : (
            <Save className="size-4" />
          )}
          {saving ? "Saving..." : saved ? "Locked In!" : "Lock in Settings"}
        </button>
      </div>

      <div className="grid gap-8 max-w-2xl">
        {/* Kelly Multiplier */}
        <div className="space-y-4">
          <div className="flex justify-between">
            <label className="font-bold text-ink">Kelly Multiplier (Bankroll Risk)</label>
            <span className="text-primary font-mono font-bold">{kelly.toFixed(2)}x</span>
          </div>
          <input 
            type="range" min="0.05" max="0.5" step="0.05" 
            value={kelly} onChange={(e) => setKelly(parseFloat(e.target.value))}
            className="w-full accent-primary h-2 bg-line rounded-lg appearance-none cursor-pointer"
          />
          <p className="text-xs text-muted">Governs how aggressively the AI scales unit sizes on high-EV bets.</p>
        </div>

        {/* Max Legs */}
        <div className="space-y-4">
          <div className="flex justify-between">
            <label className="font-bold text-ink">Maximum Parlay Legs</label>
            <span className="text-primary font-mono font-bold">{maxLegs} Legs</span>
          </div>
          <input 
            type="range" min="2" max="6" step="1" 
            value={maxLegs} onChange={(e) => setMaxLegs(parseInt(e.target.value))}
            className="w-full accent-primary h-2 bg-line rounded-lg appearance-none cursor-pointer"
          />
          <p className="text-xs text-muted">Limits the structural size of AI-generated parlays (Reduces variance).</p>
        </div>

        {/* Minimum Edge */}
        <div className="space-y-4">
          <div className="flex justify-between">
            <label className="font-bold text-ink">Minimum Required EV Floor</label>
            <span className="text-primary font-mono font-bold">{minEdge.toFixed(1)}%</span>
          </div>
          <input 
            type="range" min="0.5" max="10" step="0.5" 
            value={minEdge} onChange={(e) => setMinEdge(parseFloat(e.target.value))}
            className="w-full accent-primary h-2 bg-line rounded-lg appearance-none cursor-pointer"
          />
          <p className="text-xs text-muted">The AI will discard any bets or combinations with an expected value below this threshold.</p>
        </div>
      </div>

      {!loaded && (
        <p className="text-xs text-muted flex items-center gap-2">
          <Loader2 className="size-3 animate-spin" /> Loading saved settings...
        </p>
      )}
    </div>
  );
}