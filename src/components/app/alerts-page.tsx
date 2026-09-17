import { BRAND } from "@/lib/brand";
import { ALERTS_ET } from "@/lib/market/universe";
import { Button } from "@/components/ui/button";
import { useDeskStore } from "@/lib/desk-store";

export function AlertsPage() {
  const notifyBrowser = useDeskStore((s) => s.notifyBrowser);
  const setNotifyBrowser = useDeskStore((s) => s.setNotifyBrowser);

  async function enableBrowser() {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotifyBrowser(perm === "granted");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-sm text-emerald-500">Plan notes · not a live odds ping</p>
        <h1 className="font-display mt-2 text-3xl text-ink">Three weekday windows. No texts.</h1>
        <p className="mt-3 text-ink/80">
          Optional reminders at noon, 4:10 p.m., and 6:30 p.m. Eastern. Browser notes only fire while this tab is open. The site cannot see Hard Rock Bet.
        </p>
      </header>

      <ul className="space-y-3">
        {ALERTS_ET.map((a) => (
          <li key={a.id} className="paper-card p-5">
            <p className="stamp text-emerald-500">{a.id}</p>
            <h2 className="font-display mt-2 text-xl text-ink">{a.when}</h2>
            <p className="mt-2 text-sm text-ink/90">{a.job}</p>
          </li>
        ))}
      </ul>

      <section className="paper-card p-5">
        <h2 className="font-display text-xl text-ink">Browser permission</h2>
        <p className="mt-2 text-sm text-muted">
          Optional. Only fires while the tab is open. Never a live odds ping.
        </p>
        <Button className="mt-4" variant="outline" onClick={() => void enableBrowser()}>
          {notifyBrowser ? "Browser notes allowed" : "Allow browser notes"}
        </Button>
      </section>

      <section className="paper-card p-5">
        <h2 className="font-display text-xl text-ink">Where bets actually go</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink/90">
          <li>Live sports: {BRAND.venueLive}, 21+, geofenced Florida. This site never logs into it and never files a ticket.</li>
          <li>Fantasy: {BRAND.venueDfs} classic. DraftKings Sportsbook is not a Florida live play.</li>
          <li>Prediction markets: {BRAND.venuePredict} — a different legal bucket. Ignored as today's pick.</li>
          <li>No texts. No cash-out log. No promo tokens on AI Picks.</li>
        </ul>
        <p className="mt-4 text-sm text-muted">
          If play is no longer fun, {BRAND.helpline}. Pause-all-advice is on Log.
        </p>
      </section>
    </div>
  );
}
