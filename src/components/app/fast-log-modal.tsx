import * as React from "react";
import { createPortal } from "react-dom";
import { useDeskStore } from "@/lib/desk-store";
import { useDeskDecision } from "@/lib/market/use-board";
import { logPrediction } from "@/lib/market/ledger";
import { payoutMultiple } from "@/lib/market/engine";

export function FastLogModal({
  item,
  onClose,
}: {
  item: any;
  onClose: () => void;
}) {
  const placePaperTicket = useDeskStore((s) => s.placePaperTicket);
  const { snapshot } = useDeskDecision();
  const [stake, setStake] = React.useState(5);
  const [price, setPrice] = React.useState(item.price ?? item.row?.price ?? -110);

  const odds = Number(price);
  const multi = odds > 0 ? (odds / 100) + 1 : (100 / Math.abs(odds)) + 1;
  const toWin = stake * (multi - 1);
  
  const sport = item.sport ?? item.row?.sport ?? "SPORTS";
  const marketType = item.marketType ?? item.row?.marketType ?? "moneyline";
  const selection = item.selection ?? item.title ?? "Selection";

  const handleLock = () => {
    placePaperTicket({
      kind: "main",
      description: `${selection} ${marketType.toUpperCase()} (${price > 0 ? '+' + price : price})`,
      stake,
      price,
      status: "open",
      fastLog: true,
      legs: item.eventId ? [
        {
          eventId: item.eventId,
          sport: item.sport,
          start: item.start,
          home: item.home,
          away: item.away,
          marketType: item.marketType,
          selection: item.selection,
          side: item.side,
          price: price,
          status: "open"
        }
      ] : undefined
    });
    
    // Log to Immutable Ledger
    if (item.eventId) {
      logPrediction({
        eventId: item.eventId,
        sport: item.sport,
        start: item.start,
        home: item.home,
        away: item.away,
        marketType: item.marketType,
        selection: item.selection,
        side: item.side,
        price: price,
        fairProb: item.fairProb ?? item.row?.fairProb ?? 0,
        point: item.line ?? item.row?.line ?? null
      } as any, snapshot).catch(console.error);
    }
    
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-xl bg-panel p-6 shadow-2xl border border-panel-border text-ink">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-display font-bold uppercase tracking-wide text-neon">Fast Log Ticket</h2>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        
        <div className="space-y-4 mb-8">
          <div className="flex justify-between items-end border-b border-panel-border pb-2">
            <div>
              <p className="text-xs text-muted font-bold uppercase">{sport} • {marketType}</p>
              <p className="text-lg font-bold">{selection}</p>
            </div>
            <div className="text-right">
              {/* No longer a static text display, moving price to an input below */}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-xs text-muted font-bold uppercase">Wager</label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
                <input 
                  type="number" 
                  value={stake} 
                  onChange={(e) => setStake(Number(e.target.value))}
                  className="w-full rounded-md bg-obsidian border border-panel-border py-2 pl-7 pr-3 font-mono-numbers text-ink focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon"
                />
              </div>
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted font-bold uppercase">Odds</label>
              <div className="relative mt-1">
                <input 
                  type="number" 
                  value={price} 
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full rounded-md bg-obsidian border border-panel-border py-2 px-3 font-mono-numbers text-neon focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon text-right"
                />
              </div>
            </div>
          </div>
          
          <div className="pt-2 border-t border-panel-border flex justify-between items-center">
            <p className="text-sm text-muted font-bold uppercase">To Win</p>
            <p className="text-xl font-mono-numbers text-ink">${toWin.toFixed(2)}</p>
          </div>
        </div>

        <button 
          onClick={handleLock}
          className="w-full flex min-h-12 items-center justify-center rounded-lg bg-neon text-obsidian font-bold text-lg hover:bg-neon/90 transition-colors shadow-[0_0_15px_rgba(57,255,20,0.4)]"
        >
          Lock It
        </button>
      </div>
    </div>,
    document.body
  );
}
