import { GLOSSARY } from "@/lib/glossary";

export function GlossaryPanel({
  compact = false,
  ids,
}: {
  compact?: boolean;
  ids?: string[];
}) {
  const terms = ids ? GLOSSARY.filter((t) => ids.includes(t.id)) : GLOSSARY;
  return (
    <section>
      <h2 className="font-display mb-2 text-2xl text-ink">{compact ? "Tap a word" : "Words you'll see"}</h2>
      <p className="mb-3 text-sm text-muted">
        ML means moneyline — pick who wins the game. Plus numbers pay you more. Minus numbers cost extra.
      </p>
      <div className="flex flex-wrap gap-2">
        {terms.map((t) => (
          <details key={t.id} className="paper-card px-3 py-2 text-sm">
            <summary className="cursor-pointer font-medium text-emerald-500">
              {t.word}
              {t.also ? <span className="ml-1 text-xs text-muted">({t.also})</span> : null}
            </summary>
            <p className="mt-1 max-w-sm text-ink/90">{t.meaning}</p>
            <p className="mt-1 max-w-sm text-xs text-muted">{t.example}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
