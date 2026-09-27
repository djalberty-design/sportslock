import { buildPublicScorecard, type ScorecardPick } from "@/lib/market/scorecard";

export function ScorecardStrip({ picks }: { picks: ScorecardPick[] }) {
  const card = buildPublicScorecard(picks);
  return (
    <section className="paper-card mb-4 p-4" data-testid="public-scorecard">
      <p className="stamp text-neon">Public scorecard</p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
        <div>
          <p className="text-muted">n</p>
          <p className="font-mono text-ink">{card.n}</p>
        </div>
        <div>
          <p className="text-muted">CLV beat</p>
          <p className="font-mono text-ink">{card.clvBeatRate == null ? "—" : `${card.clvBeatRate}%`}</p>
        </div>
        <div>
          <p className="text-muted">Brier vs book</p>
          <p className="font-mono text-ink">{card.brierDelta == null ? "—" : card.brierDelta}</p>
        </div>
        <div>
          <p className="text-muted">Last 30u</p>
          <p className="font-mono text-ink">{card.last30Units >= 0 ? `+${card.last30Units}` : card.last30Units}</p>
        </div>
      </div>
      {card.losingStretch > 0 ? (
        <p className="mt-2 text-xs text-red-400">Current losing stretch: {card.losingStretch}</p>
      ) : null}
      <p className="mt-2 text-xs text-muted">{card.caveat}</p>
    </section>
  );
}
