import { useState, type ReactNode } from "react";

/**
 * Honest extras drawer. The face of the card stays pick / price / edge / Kelly.
 * Waterfall, chips, and prose live here so they do not compete with the lock line.
 */
export function WhyDrawer({
  title = "Why this pick",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 border-t border-line/60 pt-2">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex w-full items-center justify-between rounded-md px-1 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted hover:text-ink"
        aria-expanded={open}
      >
        <span>{title}</span>
        <span className="tabular-nums">{open ? "Hide" : "Open"}</span>
      </button>
      {open ? <div className="pb-1 text-sm text-ink/90">{children}</div> : null}
      <p className="px-1 pb-1 text-[10px] text-muted">
        Grade is U until the public scorecard exists. Copula correlation is provisional.
      </p>
    </div>
  );
}
