import { useEffect, useState } from "react";
import { useDeskStore, selectUnit } from "@/lib/desk-store";
import { formatBetUsd, profitOnStake } from "@/lib/copy";
import { coreFunSplit } from "@/lib/market/engine";
import { Input } from "@/components/ui/input";
import { formatAmerican } from "@/lib/utils";
import { useDeskDecision } from "@/lib/market/use-board";

export function BankrollBar() {
  const liveBankroll = useDeskStore((s) => s.liveBankroll);
  const stakeDollars = useDeskStore((s) => s.stakeDollars);
  const weekLossDollars = useDeskStore((s) => s.weekLossDollars);
  const goalTarget = useDeskStore((s) => s.goalTarget);
  const weekAnchor = useDeskStore((s) => s.weekAnchorBankroll);
  const paperTickets = useDeskStore((s) => s.paperTickets);
  const setLiveBankroll = useDeskStore((s) => s.setLiveBankroll);
  const setStakeDollars = useDeskStore((s) => s.setStakeDollars);
  const setWeekLossDollars = useDeskStore((s) => s.setWeekLossDollars);
  const setGoalTarget = useDeskStore((s) => s.setGoalTarget);
  const unitPct = useDeskStore((s) => s.unitPct);
  const bet = selectUnit({ liveBankroll, unitPct, stakeDollars });
  const split = coreFunSplit(liveBankroll);
  const { board } = useDeskDecision();
  const rec = board ? board[board.recommended] : null;
  const payout = rec?.price != null ? profitOnStake(bet, rec.price) : null;
  const weekPnl = liveBankroll - weekAnchor;
  const paperPnl = paperTickets.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

  return (
    <section className="paper-card p-5 md:p-6">
      <h2 className="font-display text-xl text-ink">Your money</h2>
      <p className="mt-1 text-sm text-muted">Type real dollars. Nothing here is hidden.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md bg-wash-gold/70 px-4 py-3">
          <p className="stamp text-emerald-500">Core · 85%</p>
          <p className="font-display mt-1 text-2xl tabular-nums text-ink">{formatBetUsd(split.core)}</p>
          <p className="mt-1 text-xs text-muted">
            1% of core is {formatBetUsd(split.coreTicket)} on a single or 2-pick combo. Steady bankroll building.
          </p>
        </div>
        <div className="rounded-md bg-wash px-4 py-3">
          <p className="stamp text-emerald-500">Fun / lotto · 15%</p>
          <p className="font-display mt-1 text-2xl tabular-nums text-ink">{formatBetUsd(split.fun)}</p>
          <p className="mt-1 text-xs text-muted">
            {formatBetUsd(split.funTicket)} flyers on 3-pick and 4-pick combos. Recreational dollars stay in this bucket.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <DollarField
          label="Money I can play with"
          hint="How much you have set aside to bet. Not rent. Not groceries."
          value={liveBankroll}
          onCommit={setLiveBankroll}
        />
        <DollarField
          label="This ticket"
          hint="How much you put on the next ticket. $2 on $200 is a quiet start. You can type $10."
          value={bet}
          onCommit={setStakeDollars}
        />
        <DollarField
          label="Most I can lose this week"
          hint="A note to yourself. This app never auto-stops you."
          value={weekLossDollars || Math.round(liveBankroll * 0.1 * 100) / 100}
          onCommit={setWeekLossDollars}
        />
        <DollarField
          label="Profit I hope for this week"
          hint="Extra dollars you hope to finish the week with."
          value={goalTarget}
          onCommit={setGoalTarget}
        />
      </div>

      {payout && rec?.price != null ? (
        <div className="mt-4 rounded-md bg-wash-gold/70 px-4 py-3">
          <p className="stamp text-emerald-500">If this ticket hits</p>
          <p className="mt-2 text-sm text-ink">
            If this ticket is {formatBetUsd(bet)} at {formatAmerican(rec.price)} and it hits, you get about{" "}
            {formatBetUsd(payout.total)} back ({formatBetUsd(payout.profit)} profit). If it misses, you are out{" "}
            {formatBetUsd(bet)}.
          </p>
        </div>
      ) : (
        <div className="mt-4 rounded-md bg-wash px-4 py-3">
          <p className="text-sm text-ink">
            If this ticket is $2 at +124 and it hits, you get about $4.48 back ($2.48 profit). If it misses, you are out
            $2.
          </p>
        </div>
      )}

      <p className="mt-3 text-sm text-ink">
        This week so far:{" "}
        <span className={weekPnl >= 0 ? "text-up" : "text-down"}>{formatBetUsd(weekPnl)}</span>
        {paperTickets.length ? ` · logged tickets ${formatBetUsd(paperPnl)}` : ""}. Goal is {formatBetUsd(goalTarget)}{" "}
        profit.
      </p>
    </section>
  );
}

function DollarField({
  label,
  hint,
  value,
  onCommit,
}: {
  label: string;
  hint: string;
  value: number;
  onCommit: (n: number) => void;
}) {
  const [text, setText] = useState(formatInput(value));
  useEffect(() => {
    setText(formatInput(value));
  }, [value]);

  return (
    <label className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      <span className="mt-1.5 flex items-center gap-1">
        <span className="text-emerald-500">$</span>
        <Input
          inputMode="decimal"
          className="font-mono"
          value={text}
          onChange={(e) => setText(e.target.value.replace(/[^0-9.]/g, ""))}
          onBlur={() => {
            const n = Number(text);
            if (Number.isFinite(n) && n >= 0) onCommit(n);
            else setText(formatInput(value));
          }}
          aria-label={label}
        />
      </span>
      <span className="mt-1.5 block text-xs text-muted">{hint}</span>
    </label>
  );
}

function formatInput(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

export function ConnectAppsNote() {
  return (
    <section className="paper-card p-5">
      <p className="stamp text-emerald-500">Hard Rock Bet Florida</p>
      <h2 className="font-display mt-2 text-xl text-ink">Can we plug into the book?</h2>
      <p className="mt-2 text-sm text-ink/90">
        No. Hard Rock Bet does not let another site log into your account or read your bets live. There is no official
        hookup, and we will not fake one.
      </p>
      <p className="mt-2 text-sm text-muted">
        Photograph a Hard Rock Bet Florida ticket to lock the live price. Fantasy lives in More — not a Florida
        sportsbook fill.
      </p>
    </section>
  );
}
