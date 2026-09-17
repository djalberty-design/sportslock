import { useMemo } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDeskStore } from "@/lib/desk-store";
import { PATH_HONESTY, drawdownOdds, lotteryCopy, pathTable, bankrollAfterUnits } from "@/lib/market/path";
import { SLEEVE_RATES } from "@/lib/market/universe";
import { formatPct, formatUsd } from "@/lib/utils";
import { BankrollBar } from "./bankroll-bar";

export function PathPage() {
  const liveBankroll = useDeskStore((s) => s.liveBankroll);
  const unitPct = useDeskStore((s) => s.unitPct);
  const goalTarget = useDeskStore((s) => s.goalTarget);
  const table = pathTable(liveBankroll, unitPct);
  const lottery = lotteryCopy(liveBankroll, goalTarget);

  const dd = useMemo(
    () =>
      [0.01, 0.02, 0.05].map((u) => ({
        u,
        p: drawdownOdds({
          start: liveBankroll,
          unitPct: u,
          ev: -0.04,
          steps: 500,
          drawdown: 0.5,
          paths: 4000,
        }),
      })),
    [liveBankroll],
  );

  const chart = Array.from({ length: 21 }, (_, i) => {
    const bets = i * 25;
    return {
      bets,
      neg4: bankrollAfterUnits(liveBankroll, unitPct, -0.04, bets),
      zero: bankrollAfterUnits(liveBankroll, unitPct, 0, bets),
      pos2: bankrollAfterUnits(liveBankroll, unitPct, 0.02, bets),
    };
  });

  return (
    <div className="space-y-6">
      <header className="max-w-2xl">
        <p className="text-sm text-emerald-500">Long-term math · not a forecast</p>
        <h1 className="font-display mt-2 text-3xl text-ink">A betting bankroll is not an index fund.</h1>
        <p className="mt-3 rounded-md bg-wash-gold px-4 py-3 text-sm text-emerald-500">{PATH_HONESTY}</p>
      </header>

      <BankrollBar />

      <section className="paper-card p-5">
        <h2 className="font-display text-xl text-ink">Your money after this many bets</h2>
        <p className="mt-1 text-sm text-muted">Each bet is the dollar amount you set in Your money (starts at 1%).</p>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart}>
              <XAxis dataKey="bets" stroke="var(--color-faint)" fontSize={12} />
              <YAxis stroke="var(--color-faint)" fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="neg4" stroke="var(--color-down)" dot={false} strokeWidth={2} name="−4% edge" />
              <Line type="monotone" dataKey="zero" stroke="var(--color-gold)" dot={false} strokeWidth={2} name="Break even" />
              <Line type="monotone" dataKey="pos2" stroke="var(--color-up)" dot={false} strokeWidth={2} name="+2% edge" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2">Bets</th>
                <th>−4% edge</th>
                <th>Break even</th>
                <th>+2% edge</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {table.map((r) => (
                <tr key={r.units} className="border-t border-line">
                  <td className="py-2">{r.units}</td>
                  <td>{formatUsd(r.evNeg4)}</td>
                  <td>{formatUsd(r.ev0)}</td>
                  <td>{formatUsd(r.evPos2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="paper-card p-5">
        <h2 className="font-display text-xl text-ink">Odds of cutting the bankroll in half (500 bets, −4% edge)</h2>
        <ul className="mt-3 grid gap-3 md:grid-cols-3">
          {dd.map((d) => (
            <li key={d.u} className="rounded-md bg-wash p-4">
              <p className="stamp text-muted">{(d.u * 100).toFixed(0)}% of your money per bet</p>
              <p className="mt-2 font-display text-2xl text-ink tabular-nums">{formatPct(d.p, 0)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="paper-card p-5">
        <h2 className="font-display text-xl text-ink">Lottery row</h2>
        <p className="mt-2 text-sm text-muted">
          Hit-rate needed on {lottery.tickets} fun-money tickets a year at decimal {lottery.payout} ({formatUsd(liveBankroll)} bankroll, 1% per bet). No skill assumed.
        </p>
        <dl className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-md bg-wash p-4">
            <dt className="text-sm text-muted">Hit-rate to {formatUsd(goalTarget, 0)}</dt>
            <dd className="font-display text-2xl text-ink tabular-nums">{formatPct(lottery.toGoal, 1)}</dd>
          </div>
          <div className="rounded-md bg-wash p-4">
            <dt className="text-sm text-muted">Hit-rate to $1,000,000</dt>
            <dd className="font-display text-2xl text-ink tabular-nums">{formatPct(lottery.toMillion, 1)}</dd>
          </div>
        </dl>
      </section>

      <section className="paper-card p-5">
        <h2 className="font-display text-xl text-ink">Illustrative styles</h2>
        <ul className="mt-3 divide-y divide-line">
          {Object.values(SLEEVE_RATES).map((s) => (
            <li key={s.id} className={s.id === "hero" ? "bg-wash-gold/60 py-3 opacity-80" : "py-3"}>
              <div className="flex items-center justify-between gap-3">
                <span>
                  <span className="stamp mr-2 text-muted">{s.symbol}</span>
                  {s.label}
                </span>
                <span className="font-mono text-sm tabular-nums">
                  {s.id === "hero" ? "disclaimer only" : formatPct(s.annual, 0) + " / cycle-ish"}
                </span>
              </div>
              {s.id === "hero" ? (
                <p className="mt-1 text-xs text-muted">Hindsight exists to disclaim miracle parlays, not as a recommendation.</p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
