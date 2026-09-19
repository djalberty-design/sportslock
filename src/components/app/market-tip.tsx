import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const MARKET_TIPS: Record<string, { label: string; tip: string }> = {
  ml: { label: "ML", tip: "Pick who wins the game. No point spread needed." },
  moneyline: { label: "ML", tip: "Pick who wins the game. No point spread needed." },
  spread: { label: "Spread", tip: "Team must win by this many points (or lose by fewer)." },
  total: { label: "Total", tip: "Combined final score goes over or under this number." },
  "over/under": { label: "O/U", tip: "Combined final score goes over or under this number." },
  props: { label: "Props", tip: "Bet on a specific player's stats (yards, points, rebounds, etc.)" },
  "player props": { label: "Props", tip: "Bet on a specific player's stats (yards, points, rebounds, etc.)" },
  h2h: { label: "ML", tip: "Pick who wins the game. No point spread needed." },
  default: { label: "", tip: "A market offered by the sportsbook for this game." },
};

function lookup(type?: string | null) {
  if (!type) return MARKET_TIPS.default;
  const key = type.toLowerCase().replace(/_/g, " ");
  return MARKET_TIPS[key] ?? MARKET_TIPS.default;
}

/**
 * Small (?) tooltip next to a market type label.
 * Shows a one-line explanation on hover/tap.
 */
export function MarketTip({ type, className }: { type?: string | null; className?: string }) {
  const [show, setShow] = useState(false);
  const info = lookup(type);
  if (!info.tip) return null;

  return (
    <span className={cn("relative inline-flex items-center", className)}>
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={(e) => { e.stopPropagation(); setShow(!show); }}
        className="text-muted hover:text-primary transition-colors"
        aria-label={`What is ${type}?`}
      >
        <HelpCircle className="size-3" />
      </button>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 w-52 rounded-lg bg-obsidian border border-line px-3 py-2 text-[10px] text-ink shadow-xl animate-in fade-in zoom-in-95 duration-150">
          <span className="font-bold text-primary">{info.label || type}</span>
          <br />
          {info.tip}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-obsidian" />
        </span>
      )}
    </span>
  );
}
