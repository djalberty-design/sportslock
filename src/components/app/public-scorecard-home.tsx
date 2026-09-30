import { useEffect, useState } from "react";
import { getPublicScorecardFn } from "@/lib/market/scorecard-server";
import { buildPublicScorecard, type PublicScorecard } from "@/lib/market/scorecard";
import { cn } from "@/lib/utils";

export function PublicScorecardHome() {
  const [card, setCard] = useState<PublicScorecard>(() => buildPublicScorecard([]));
  useEffect(() => {
    let alive = true;
    const load = () => {
      getPublicScorecardFn()
        .then((res) => {
          if (alive && res.card) setCard(res.card);
        })
        .catch(() => {});
    };
    load();
    const id = window.setInterval(load, 60_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);
  return (
    <section className="paper-card p-4" data-testid="public-scorecard">
      <p className="stamp text-neon">Public scorecard</p>
      <div className="mt-2 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <div className="bg-panel border border-line/60 rounded-xl p-3">
          <p className="text-muted text-xs font-bold uppercase tracking-wider">Total graded</p>
          <p className="font-mono text-ink text-xl font-bold mt-0.5">{card.n} picks</p>
          <p className="text-[10px] text-muted mt-0.5">Spreads, moneylines, and over/unders</p>
        </div>
        <div className="bg-panel border border-line/60 rounded-xl p-3" title={card.clvBeatRate === 0 && (card.clvSample ?? 0) > 0 ? "Not enough closing line data yet." : undefined}>
          <p className="text-muted text-xs font-bold uppercase tracking-wider">Beat closing odds</p>
          <p className="font-mono text-ink text-xl font-bold mt-0.5">
            {card.clvBeatRate == null || (card.clvBeatRate === 0 && (card.clvSample ?? 0) > 0) ? "\u2014" : `${card.clvBeatRate}%`}
          </p>
          <p className="text-[10px] text-muted mt-0.5">
            {card.clvBeatRate === 0 && (card.clvSample ?? 0) > 0 ? "Not enough closing line data yet." : "Only when we stored a real kickoff/close price"}
          </p>
        </div>
        <div className="bg-panel border border-line/60 rounded-xl p-3">
          <p className="text-muted text-xs font-bold uppercase tracking-wider">Model accuracy</p>
          <p className="font-mono text-ink text-xl font-bold mt-0.5">{card.brierDelta == null ? "\u2014" : card.brierDelta}</p>
          <p className="text-[10px] text-muted mt-0.5">Negative = more accurate than sportsbook closing odds</p>
        </div>
        <div className="bg-panel border border-line/60 rounded-xl p-3">
          <p className="text-muted text-xs font-bold uppercase tracking-wider">Last 30</p>
          <p className={cn("font-mono text-xl font-bold mt-0.5", card.last30Units >= 0 ? "text-emerald-400" : "text-amber-400")}>
            {card.last30Units >= 0 ? `+${card.last30Units}u` : `${card.last30Units}u`}
          </p>
          <p className="text-[10px] text-muted mt-0.5">Flat 1-unit profit/loss</p>
        </div>
      </div>
      {card.losingStretch > 0 ? (
        <p className="mt-2 text-xs text-muted">Current losing streak: {card.losingStretch} games</p>
      ) : null}
      <p className="mt-2 text-xs text-muted">{card.caveat}</p>
    </section>
  );
}
