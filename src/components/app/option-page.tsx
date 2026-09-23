// @ts-nocheck
import { Link } from "@tanstack/react-router";
import { optionByKind } from "@/lib/market/options";
import { useDeskDecision } from "@/lib/market/use-board";
import { STATUS_LABEL } from "@/lib/copy";

export function OptionPage({ kind }: { kind: string }) {
  const meta = optionByKind(kind);
  const { options } = useDeskDecision();
  const st = options.find((o) => o.kind === kind);

  if (!meta) {
    return (
      <div className="paper-card p-6">
        <p className="text-ink">Unknown bet type.</p>
        <Link to="/options" className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-emerald-500 underline">
          Back to bet types
        </Link>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-2xl space-y-5">
      <p className="stamp text-emerald-500">{meta.symbol}</p>
      <h1 className="font-display text-3xl text-ink">{meta.title}</h1>
      <p className="rounded-md bg-wash px-4 py-3 text-sm text-ink">
        Live status: <span className="font-medium uppercase text-emerald-500">{st ? STATUS_LABEL[st.status] : "—"}</span>
        {st?.note ? ` · ${st.note}` : ""}
      </p>
      <p className="text-lg text-ink/90">{meta.promise}</p>
      <section className="paper-card p-5">
        <h2 className="font-display text-xl text-ink">How it works</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
          {meta.howItWorks.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="paper-card p-5">
          <h2 className="font-display text-xl text-ink">When it works</h2>
          <p className="mt-2 text-sm">{meta.whenItWins}</p>
        </div>
        <div className="paper-card p-5">
          <h2 className="font-display text-xl text-ink">When it fails</h2>
          <p className="mt-2 text-sm">{meta.whenItFails}</p>
        </div>
      </section>
      <section className="paper-card p-5">
        <h2 className="font-display text-xl text-down">Never</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
          {meta.never.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </section>
      <Link to="/options" className="inline-flex min-h-11 items-center text-sm font-medium text-emerald-500 underline-offset-4 hover:underline">
        All bet types
      </Link>
    </article>
  );
}
