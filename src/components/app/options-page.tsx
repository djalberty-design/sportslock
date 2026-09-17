import { Link } from "@tanstack/react-router";
import { OPTION_CATALOG } from "@/lib/market/options";
import { useDeskDecision } from "@/lib/market/use-board";
import { STATUS_LABEL } from "@/lib/copy";

export function OptionsPage() {
  const { options } = useDeskDecision();
  return (
    <div className="space-y-6">
      <header className="max-w-2xl">
        <p className="text-sm text-emerald-500">Eight types · one catalog</p>
        <h1 className="font-display mt-2 text-3xl text-ink">What this app will even consider.</h1>
        <p className="mt-3 text-ink/80">
          Each type has a plain-English deep dive: how it works, when it works, when it fails, and what never to do. Status is scored from today's delayed odds — not a 0–100 game grade.
        </p>
      </header>
      <ul className="grid gap-4 md:grid-cols-2">
        {OPTION_CATALOG.map((opt) => {
          const st = options.find((o) => o.kind === opt.kind);
          return (
            <li key={opt.kind}>
              <Link
                to="/option/$kind"
                params={{ kind: opt.kind }}
                className="paper-card block p-5 transition-shadow hover:shadow-[var(--shadow-paper-hover)]"
              >
                <div className="flex items-center justify-between">
                  <span className="stamp text-emerald-500">{opt.symbol}</span>
                  <span className="text-xs uppercase tracking-wider text-emerald-500">
                    {st ? STATUS_LABEL[st.status] : "—"}
                  </span>
                </div>
                <h2 className="font-display mt-2 text-2xl text-ink">{opt.title}</h2>
                <p className="mt-2 text-sm text-ink/80">{opt.promise}</p>
                <p className="mt-3 text-sm text-muted">{st?.note}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
