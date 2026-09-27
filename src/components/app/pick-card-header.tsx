import { formatAmerican, formatLineAge, type PickCardView } from "@/lib/market/pick-card-contract";

export function PickCardHeader({ card }: { card: PickCardView }) {
  return (
    <>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-muted">
        <span>Grade {card.confidenceGrade}</span>
        <span>{formatLineAge(card.lineAgeSeconds)}</span>
      </div>
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md bg-panel px-2 py-2">
          <p className="stamp text-muted">Hard Rock</p>
          <p className="font-display mt-1 text-lg tabular-nums text-ink">{formatAmerican(card.price)}</p>
        </div>
        <div className="rounded-md bg-panel px-2 py-2">
          <p className="stamp text-muted">Edge</p>
          <p className="font-display mt-1 text-lg tabular-nums text-neon">
            {card.edgePct == null ? "—" : `${card.edgePct > 0 ? "+" : ""}${card.edgePct}%`}
          </p>
        </div>
        <div className="rounded-md bg-panel px-2 py-2">
          <p className="stamp text-muted">Kelly</p>
          <p className="font-display mt-1 text-lg tabular-nums text-ink">
            {card.kellyStake == null ? "Sign in" : `$${card.kellyStake.toFixed(0)}`}
          </p>
        </div>
      </div>
    </>
  );
}
