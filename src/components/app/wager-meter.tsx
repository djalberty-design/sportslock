import { formatBetUsd, formatChancePct } from "@/lib/copy";
import { americanToDecimal } from "@/lib/market/engine";
import { useDeskStore, selectUnit } from "@/lib/desk-store";
import { cn, formatAmerican } from "@/lib/utils";

export function getEdgeTone(chance?: number | null, decimalPayout?: number | null, price?: number | null): "high" | "medium" | "low" {
  const dec = decimalPayout != null ? decimalPayout : (price != null ? americanToDecimal(price) : null);
  if (chance == null || dec == null) return "low";
  const edge = (chance * dec) - 1;
  if (edge >= 0.05) return "high";
  if (edge >= 0.01) return "medium";
  return "low";
}

export function ticketMath(chance?: number | null, price?: number | null, stake = 0) {
  const pctLabel = formatChancePct(chance);
  const decimal =
    price != null && Number.isFinite(price) && price !== 0 ? americanToDecimal(price) : null;
  const hit = decimal != null && decimal > 1 && stake > 0 ? stake * decimal : null;
  const profit = hit != null ? hit - stake : null;
  return { hasChance: pctLabel != null, pctLabel, decimal, hit, profit };
}

/** Compact always-on readout for Hard Rock cells and dense lists. Percent is the number. */
export function HitReadout({
  chance,
  price,
  className,
  hero = false,
  align = "center",
  heatTone,
}: {
  chance?: number | null;
  price?: number | null;
  className?: string;
  hero?: boolean;
  align?: "center" | "left";
  heatTone?: "high" | "medium" | "low";
}) {
  const stake = useDeskStore(selectUnit);
  const { pctLabel, hit } = ticketMath(chance, price, stake);
  if (!pctLabel && hit == null) return null;
  return (
    <div className={cn("w-full min-w-0", align === "left" ? "text-left" : "text-center", className)}>
      {pctLabel ? (
        <p
          className={cn(
            "font-display leading-none tabular-nums",
            heatTone === "high" ? "text-neon" : heatTone === "medium" ? "text-ink" : heatTone === "low" ? "text-muted" : "text-neon",
            hero ? "text-2xl" : "text-xl",
          )}
        >
          {pctLabel}
        </p>
      ) : (
        <p className="text-xs text-muted">—</p>
      )}
      {hit != null ? (
        <p className="mt-0.5 truncate text-xs leading-tight text-neon">
          <span className="font-medium">Hit</span> {formatBetUsd(hit)}
        </p>
      ) : (
        <p className="mt-0.5 text-xs leading-tight text-muted">Set This bet</p>
      )}
    </div>
  );
}

export function WagerMeter({
  chance,
  price,
  decimalPayout,
  size = "md",
  label = "% to hit",
  className,
  heatTone,
}: {
  chance?: number | null;
  price?: number | null;
  decimalPayout?: number | null;
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
  heatTone?: "high" | "medium" | "low";
}) {
  const stake = useDeskStore(selectUnit);
  const pctLabel = formatChancePct(chance);
  const hasChance = pctLabel != null;
  const decimal =
    decimalPayout != null && Number.isFinite(decimalPayout) && decimalPayout > 1
      ? decimalPayout
      : price != null && Number.isFinite(price)
        ? americanToDecimal(price)
        : null;
  if (!hasChance && decimal == null) return null;

  const pct = hasChance && chance != null ? Math.max(0, Math.min(100, chance * 100)) : 0;
  const total = decimal != null && stake > 0 ? stake * decimal : null;
  const profit = total != null ? total - stake : null;

  const pctClass =
    size === "lg" ? "text-5xl md:text-6xl" : size === "sm" ? "text-3xl" : "text-4xl";

  // Beginner-friendly explanation based on percentage
  const pctNum = Math.round(pct);
  const hitExplain = pctNum >= 70 ? "Strong favorite — wins most of the time"
    : pctNum >= 55 ? "Slight edge — better than a coin flip"
    : pctNum >= 45 ? "Close to a toss-up — could go either way"
    : pctNum >= 30 ? "Underdog — lower chance, bigger payout"
    : "Long shot — risky but high reward";

  // Bar color
  const barColor = heatTone === "high" ? "bg-neon" : heatTone === "medium" ? "bg-ink" : heatTone === "low" ? "bg-muted" : "bg-neon";
  const textColor = heatTone === "high" ? "text-neon" : heatTone === "medium" ? "text-ink" : heatTone === "low" ? "text-muted" : "text-neon";

  return (
    <div className={cn("rounded-md bg-panel px-3 py-3", className)}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("font-display leading-none tabular-nums", textColor, pctClass)}>
            {pctLabel ?? "—"}
          </p>
          <p className="mt-1 truncate text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
        </div>
        {total != null && profit != null ? (
          <div className="shrink-0 text-right">
            <p className="text-sm font-medium text-neon">
              <span className="stamp mr-1">Hit</span>
              {formatBetUsd(total)}
            </p>
            <p className="text-sm text-muted">
              <span className="stamp mr-1 text-faint">Miss</span>
              −{formatBetUsd(stake)}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              On your {formatBetUsd(stake)}
              {profit > 0 ? ` · +${formatBetUsd(profit)}` : ""}
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted">Set This bet on Start to see dollars.</p>
        )}
      </div>
      {hasChance ? (
        <>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <div className={cn("h-full rounded-full transition-all duration-500", barColor)} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-[10px] text-muted italic">{hitExplain}</p>
        </>
      ) : null}
      {price != null && Number.isFinite(price) ? (
        <p className="mt-2 font-mono text-xs text-muted">Hard Rock would show {formatAmerican(price)}</p>
      ) : null}
    </div>
  );
}
