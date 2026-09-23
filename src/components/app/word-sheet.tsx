// @ts-nocheck
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { CHIP_LINE, type ChipId } from "@/lib/plain-words";

export function WordSheet({
  id,
  onClose,
}: {
  id: ChipId | null;
  onClose: () => void;
}) {
  if (!id) return null;
  const row = CHIP_LINE[id];
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="word-sheet-title">
      <button type="button" className="absolute inset-0 bg-navy-deep/70" aria-label="Close" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 rounded-t-lg bg-card p-5 shadow-[var(--shadow-stamp)] md:inset-auto md:bottom-auto md:left-1/2 md:top-1/3 md:w-[28rem] md:-translate-x-1/2 md:rounded-md">
        <div className="flex items-start justify-between gap-3">
          <h2 id="word-sheet-title" className="font-display text-xl text-ink">
            {row.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid size-11 shrink-0 place-items-center rounded-md text-muted hover:bg-wash hover:text-ink"
            aria-label="Close"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>
        <p className="mt-3 text-base text-ink/90">{row.line}</p>
        <Link
          to="/more"
          hash="words"
          onClick={onClose}
          className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-emerald-500 underline-offset-4 hover:underline"
        >
          More words
        </Link>
      </div>
    </div>
  );
}
