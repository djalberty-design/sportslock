// @ts-nocheck
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, ShieldCheck, X } from "lucide-react";
import { motion } from "framer-motion";
import { useDeskStore } from "@/lib/desk-store";
import { DEFAULT_WAGER } from "@/lib/market/book-price";
import { paperFromLock, researchAmerican, researchStake, writePredictionLegs } from "@/lib/market/lock-action";
import { matchSnapshotEvent, resolveLegTeam } from "@/lib/market/logos";

function selectionLabel(leg: any, snapshot?: any) {
  const teams = resolveLegTeam(leg, matchSnapshotEvent(snapshot, leg).quote);
  const sel = String(leg?.selection || "").trim();
  if (!sel) return teams.homeName || "Pick";
  if (/^(over|under)\s/i.test(sel) || /\b[ouO]\s?\d/.test(sel)) return sel;
  if (sel.length <= 4 && teams.side === "home" && teams.homeName) return teams.homeName;
  if (sel.length <= 4 && teams.side === "away" && teams.awayName) return teams.awayName;
  return sel;
}

export function FeedLockModal({
  open,
  onClose,
  parlay,
  snapshot,
  americanOdds,
}: {
  open: boolean;
  onClose: () => void;
  parlay: any;
  snapshot?: any;
  americanOdds: string;
}) {
  const placePaperTicket = useDeskStore((s) => s.placePaperTicket);
  const [wager, setWager] = useState(String(DEFAULT_WAGER));
  const [oddsInput, setOddsInput] = useState(americanOdds);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lockErr, setLockErr] = useState<string | null>(null);

  if (!open) return null;

  const pick = parlay;
  const parlayCand = pick?.parlay || pick;
  const legs = parlayCand?.legs || [];
  const first = legs[0];
  const firstTeams = resolveLegTeam(first, matchSnapshotEvent(snapshot, first).quote);

  async function saveToAction() {
    setSaving(true);
    setLockErr(null);
    try {
      const am = researchAmerican(oddsInput || americanOdds, researchAmerican(americanOdds));
      const stake = researchStake(wager);
      const desc = legs.length
        ? legs.map((leg: any) => selectionLabel(leg, snapshot)).join(" + ")
        : (pick?.selection || "Parlay");
      const res = placePaperTicket(paperFromLock({
        description: desc,
        stake,
        price: am,
        chance: pick?.chance ?? parlayCand?.combinedFair,
        gameIds: legs.map((l: any) => String(l.eventId || "")),
        home: firstTeams.homeName || first?.home,
        away: firstTeams.awayName || first?.away,
        start: first?.start || matchSnapshotEvent(snapshot, first).quote?.start || undefined,
        kind: legs.length > 1 ? "parlay" : "main",
      }));
      if (!res.ok) {
        setLockErr(res.error);
        setSaving(false);
        return;
      }
      await writePredictionLegs(legs.map((leg: any) => ({
        eventId: String(leg.eventId || ""),
        selection: String(leg.selection || selectionLabel(leg, snapshot)),
        marketType: String(leg.marketType || "ml"),
        point: leg.point,
        price: Number(leg.price) || am,
        fairProb: Number(leg.fairProb || pick?.chance || 0),
      })));
      setSaved(true);
    } catch (err) {
      console.error(err);
      setLockErr("Could not write the ticket. Try again.");
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-panel border border-line rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-4 border-b border-line flex items-center justify-between">
          <h3 className="font-display font-bold text-lg flex items-center gap-2">
            <ShieldCheck className="text-primary size-5" /> Lock It In
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-obsidian rounded-full transition-colors">
            <X className="size-5 text-muted" />
          </button>
        </div>
        <div className="p-6">
          <p className="text-sm text-muted mb-4">
            Edit to match Hard Rock before it hits My Action. This site never places the bet.
          </p>
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">Final Odds (American)</label>
              <input
                type="text"
                value={oddsInput}
                onChange={(e) => setOddsInput(e.target.value)}
                className="w-full bg-obsidian border border-line rounded-lg px-4 py-3 text-ink font-mono focus:outline-none focus:border-primary"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">Wager Amount ($)</label>
              <input
                type="number"
                value={wager}
                onChange={(e) => setWager(e.target.value)}
                className="w-full bg-obsidian border border-line rounded-lg px-4 py-3 text-ink font-mono focus:outline-none focus:border-primary text-lg"
              />
            </div>
          </div>
          {lockErr ? <p className="mt-3 text-sm text-red-400">{lockErr}</p> : null}
        </div>
        <div className="p-4 bg-obsidian border-t border-line">
          {saved ? (
            <Link
              to="/ticket"
              className="w-full bg-emerald-500 hover:bg-emerald-500/90 text-zinc-950 font-bold py-3.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              On My Action <ChevronRight className="size-4" />
            </Link>
          ) : (
            <button
              onClick={saveToAction}
              disabled={saving}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save to My Action"} <ChevronRight className="size-4" />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
