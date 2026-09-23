// @ts-nocheck
import { useState, type ReactNode } from "react";
import { Camera, ImageUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseTicketImage } from "@/lib/market/server";
import { useDeskStore, selectUnit } from "@/lib/desk-store";
import type { ContestOffer, MarketType, PaperTicket, ParsedTicket } from "@/lib/market/types";
import { formatBetUsd } from "@/lib/copy";
import { enrichParlayPicks, matchParsedToRows } from "@/lib/market/research";
import { useDeskDecision } from "@/lib/market/use-board";
import { TicketReview, LockedStamp, buildLockPayload } from "./ticket-lock";
import { compressScreenshot, dataUrlToBytes } from "@/lib/screenshot";
import { cn } from "@/lib/utils";
import { readSlipOnDevice } from "@/lib/market/slip-ocr-browser";

const EMPTY: ParsedTicket = {
  sport: "NFL",
  home: "",
  away: "",
  marketType: "ml",
  side: "home",
  selection: "",
  price: -110,
  confidence: 0,
  confirmed: false,
};

export function ScreenshotIngest({
  kind = "ticket",
  heading,
  embedded = false,
}: {
  kind?: "ticket" | "slate" | "contest" | "auto";
  heading?: string;
  embedded?: boolean;
}) {
  const confirmParsed = useDeskStore((s) => s.confirmParsed);
  const place = useDeskStore((s) => s.placePaperTicket);
  const setParlayLegs = useDeskStore((s) => s.setParlayLegs);
  const confirmSlateFromTable = useDeskStore((s) => s.confirmSlateFromTable);
  const setContests = useDeskStore((s) => s.setContests);
  const liveBankroll = useDeskStore((s) => s.liveBankroll);
  const unitPct = useDeskStore((s) => s.unitPct);
  const stakeDollars = useDeskStore((s) => s.stakeDollars);
  const unit = selectUnit({ liveBankroll, unitPct, stakeDollars });
  const { scan, snapshot } = useDeskDecision();
  const [draft, setDraft] = useState<ParsedTicket>(EMPTY);
  const [legs, setLegs] = useState<ParsedTicket[]>([]);
  const [note, setNote] = useState(
    kind === "slate" || kind === "contest" || kind === "auto"
      ? "Photograph the DraftKings Fantasy screen. We read salaries and buy-ins. Fantasy is 18+ — not a Hard Rock ticket."
      : "Photograph the Hard Rock Bet Florida screen. We read the live price. Then you confirm it on Log.",
  );
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [slateTable, setSlateTable] = useState("");
  const [sport, setSport] = useState("NFL");
  const [contests, setLocalContests] = useState<ContestOffer[]>([]);
  const [mode, setMode] = useState<"ticket" | "slate" | "contest">(
    kind === "slate" || kind === "contest" ? kind : "ticket",
  );
  const [locked, setLocked] = useState<PaperTicket | null>(null);
  const [lockError, setLockError] = useState<string | null>(null);
  const [editFields, setEditFields] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setLocked(null);
    setLockError(null);
    try {
      let b64: string;
      let mime = file.type || "image/jpeg";
      try {
        const dataUrl = await compressScreenshot(file);
        setPreview(dataUrl);
        const conv = dataUrlToBytes(dataUrl);
        b64 = conv.b64;
        mime = conv.mime || "image/jpeg";
      } catch {
        const url = URL.createObjectURL(file);
        setPreview(url);
        const buf = await file.arrayBuffer();
        b64 = bytesToB64(new Uint8Array(buf));
      }
      const res = await parseTicketImage({ data: { image: b64, mime, kind } });
      if (!res.ok) {
        // Tier 2: client-side Tesseract OCR when xAI is unavailable (BIBLE §OCR fallback)
        setNote("Server OCR unavailable — trying on-device text read…");
        try {
          const deviceParsed = await readSlipOnDevice(file);
          if (deviceParsed && deviceParsed.selection) {
            setLegs([]);
            setDraft({ ...deviceParsed, confirmed: false });
            setEditFields(true);
            setNote("On-device OCR. Check every field — fix anything it missed, then save to Log.");
            return;
          }
        } catch {
          // Tesseract unavailable — fall through to manual
        }
        setNote(res.error);
        setEditFields(true);
        return;
      }
      if (res.kind === "slate") {
        setMode("slate");
        setSlateTable(res.table);
        setNote(res.note);
        return;
      }
      if (res.kind === "contest") {
        setMode("contest");
        setLocalContests(res.contests);
        setNote(res.note);
        return;
      }
      setMode("ticket");
      const first = res.fields[0];
      if (res.fields.length > 1) {
        setLegs(res.fields.map((f) => ({ ...f, confirmed: false })));
        setDraft(EMPTY);
        setEditFields(true);
        setNote(`${res.fields.length} games on this slip. Fix any field, then confirm the live price.`);
      } else if (first && first.confidence >= 0.4) {
        setLegs([]);
        setDraft({ ...first, confirmed: false });
        setEditFields(true);
        setNote("Check the line and the side. Fix anything the photo missed, then save it to Log.");
      } else if (first) {
        setLegs([]);
        setDraft({ ...first, confirmed: false });
        setEditFields(true);
        setNote("Low confidence. Fix any field, then check the live payout below.");
      } else {
        setEditFields(true);
        setNote(res.note);
      }
    } catch {
      setEditFields(true);
      setNote("Could not read the photo. Enter the fields by hand, then check the live payout.");
    } finally {
      setBusy(false);
    }
  }

  function confirmTicket() {
    lockItems([draft]);
  }

  function confirmParlayPhoto() {
    const ready = legs.filter((l) => l.selection && l.home && Number.isFinite(l.price));
    if (ready.length < 2) {
      setNote("Need at least two complete games to grade a parlay.");
      return;
    }
    if (scan?.rows.length) {
      const matched = matchParsedToRows(ready, scan.rows);
      setParlayLegs(enrichParlayPicks(matched, scan.rows, snapshot?.briefs, snapshot?.predict));
    }
    lockItems(ready);
  }

  function lockItems(items: ParsedTicket[]) {
    if (!preview) {
      setLockError("Upload the screenshot first. That's how we get the live number.");
      return;
    }
    const ready = items.filter((l) => l.selection && l.home && Number.isFinite(l.price));
    if (!ready.length) {
      setLockError("Need the pick, the teams, and the live odds before we lock it.");
      return;
    }
    ready.forEach((l) => confirmParsed({ ...l, confirmed: true, confidence: Math.max(l.confidence, 1) }));
    const payload = buildLockPayload(ready, scan?.rows ?? [], unit);
    const r = place(payload);
    if (!r.ok) {
      setLockError(r.error);
      return;
    }
    setLocked(r.ticket);
    setLockError(null);
    setNote("Locked in. This ticket is open on Log until you mark win or loss.");
    setDraft(EMPTY);
    setLegs([]);
    setEditFields(false);
  }

  function confirmSlate() {
    if (!slateTable.trim()) {
      setNote("No player list yet. Upload a screenshot of the DraftKings salary screen.");
      return;
    }
    const n = confirmSlateFromTable(slateTable, sport);
    setNote(
      n > 0
        ? `Confirmed ${n} players. Built Safer, High-Ceiling, and Showdown lineups. Check salary-shift alerts above.`
        : "Nothing parsed. Need name, position, team, salary.",
    );
  }

  function confirmContests() {
    if (!contests.length) {
      setNote("No contests yet. Upload a screenshot of the DraftKings lobby so we can read the buy-ins.");
      return;
    }
    setContests(contests.map((c) => ({ ...c, confirmed: true })));
    setNote(`Confirmed ${contests.length} contests. Buy-in recommendation now uses this list.`);
  }

  function resetLock() {
    setLocked(null);
    setPreview(null);
    setDraft(EMPTY);
    setLegs([]);
    setLockError(null);
    setEditFields(false);
    setNote("Photograph the Hard Rock Bet Florida screen. We read the live price. Then you confirm it on Log.");
  }

  const title =
    heading ??
    (kind === "slate"
      ? "Confirm with DraftKings Photo — salary list"
      : kind === "contest"
        ? "Confirm with DraftKings Photo — contest lobby"
        : kind === "auto"
          ? "Confirm with DraftKings Photo — salary list or contest lobby"
          : "Upload a Hard Rock Bet Florida screenshot — required before we confirm");

  const showReview = mode === "ticket" && !locked && Boolean(preview) && (Boolean(draft.selection) || legs.length > 1);
  const dkFlow = kind === "slate" || kind === "contest" || kind === "auto";

  return (
    <section id="lock-in" className={cn(embedded ? "mt-5 space-y-4" : "paper-card p-5 md:p-6")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="stamp text-emerald-500">Photo</p>
          <h2 className="font-display mt-1 text-xl text-ink">{title}</h2>
          <p className="mt-1 text-sm text-muted">{note}</p>
        </div>
      </div>

      {!preview && !locked && mode === "ticket" && !dkFlow ? (
        <ol className="mt-4 grid gap-2 text-sm text-ink sm:grid-cols-3">
          <li>
            <p className="stamp text-emerald-500">01</p>
            <p className="mt-1">Take a photo or pick from your library. Confirm the line before Log.</p>
          </li>
          <li>
            <p className="stamp text-emerald-500">02</p>
            <p className="mt-1">We show the live price and Hit / Miss dollars. Not on Log yet.</p>
          </li>
          <li>
            <p className="stamp text-emerald-500">03</p>
            <p className="mt-1">Save it. It waits on Log.</p>
          </li>
        </ol>
      ) : null}

      {!locked ? (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 text-zinc-950">
              <Camera className="size-5" strokeWidth={1.75} />
              <span className="text-base font-medium">
                {busy ? "Reading…" : dkFlow ? "Confirm with DraftKings Photo" : "Take photo"}
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  void onFile(file);
                }}
              />
            </label>
            <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-lg bg-wash px-4 text-emerald-500">
              <ImageUp className="size-5" strokeWidth={1.75} />
              <span className="text-base font-medium">{preview ? "Different photo" : "Photo library"}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/heic,image/heif"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  void onFile(file);
                }}
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-muted">
            Camera and library. Confirm the line before Log. You can edit what we read.
          </p>
        </>
      ) : null}

      {preview && !locked ? (
        <img
          src={preview}
          alt="Uploaded ticket, contest, or slate"
          className="mt-3 max-h-48 w-full rounded-md object-contain outline outline-1 -outline-offset-1 outline-gold/20"
        />
      ) : null}

      {locked ? (
        <div className="mt-5 space-y-3">
          <LockedStamp ticket={locked} />
          <Button variant="ghost" className="w-full" onClick={resetLock}>
            Lock another ticket
          </Button>
        </div>
      ) : null}

      {mode === "slate" ? (
        <div className="mt-4 space-y-3">
          <label className="text-sm">
            Sport{" "}
            <select
              className="ml-2 h-11 rounded-md bg-wash px-3 text-ink shadow-[var(--shadow-paper)]"
              value={sport}
              onChange={(e) => setSport(e.target.value)}
            >
              {["NFL", "NBA", "MLB", "NHL", "NCAAF", "NCAAB"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <textarea
            value={slateTable}
            onChange={(e) => setSlateTable(e.target.value)}
            rows={7}
            className="w-full rounded-md bg-wash p-3 font-mono text-sm text-ink shadow-[var(--shadow-paper)]"
            placeholder={"Mahomes,QB,KC,7800,24"}
          />
          <Button onClick={confirmSlate}>Confirm lineup from this list</Button>
        </div>
      ) : null}

      {mode === "contest" ? (
        <div className="mt-4 space-y-3">
          {contests.length ? (
            <ul className="divide-y divide-line text-sm">
              {contests.map((c, i) => (
                <li key={`${c.name}-${i}`} className="flex justify-between py-2">
                  <span>
                    {c.name}
                    <span className="ml-2 text-xs uppercase text-muted">{c.kind}</span>
                  </span>
                  <span className="font-mono">{formatBetUsd(c.buyIn)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No buy-ins read yet.</p>
          )}
          <Button onClick={confirmContests} disabled={!contests.length}>
            Use these buy-ins
          </Button>
        </div>
      ) : null}

      {mode === "ticket" && !locked && legs.length > 1 ? (
        <div className="mt-4 space-y-3">
          {editFields
            ? legs.map((leg, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 rounded-md bg-wash p-3 md:grid-cols-4">
                  <Labeled label={`Game ${i + 1} pick`}>
                    <Input value={leg.selection} onChange={(e) => setLegs(editLeg(legs, i, { selection: e.target.value }))} />
                  </Labeled>
                  <Labeled label="Away">
                    <Input value={leg.away} onChange={(e) => setLegs(editLeg(legs, i, { away: e.target.value }))} />
                  </Labeled>
                  <Labeled label="Home">
                    <Input value={leg.home} onChange={(e) => setLegs(editLeg(legs, i, { home: e.target.value }))} />
                  </Labeled>
                  <Labeled label="Odds">
                    <Input
                      inputMode="numeric"
                      value={leg.price}
                      onChange={(e) => setLegs(editLeg(legs, i, { price: Number(e.target.value) }))}
                    />
                  </Labeled>
                  <Labeled label="Player (if a player bet)">
                    <Input value={leg.player ?? ""} onChange={(e) => setLegs(editLeg(legs, i, { player: e.target.value }))} />
                  </Labeled>
                  <Labeled label="Line">
                    <Input
                      inputMode="decimal"
                      value={leg.point ?? ""}
                      onChange={(e) =>
                        setLegs(editLeg(legs, i, { point: e.target.value === "" ? undefined : Number(e.target.value) }))
                      }
                    />
                  </Labeled>
                </div>
              ))
            : null}
          {preview && !editFields ? (
            <Button variant="ghost" onClick={() => setEditFields(true)}>
              Fix a field
            </Button>
          ) : null}
          {editFields && preview ? (
            <Button variant="ghost" onClick={() => setEditFields(false)}>
              Hide fields
            </Button>
          ) : null}
          {showReview ? (
            <TicketReview legs={legs} rows={scan?.rows ?? []} onLock={confirmParlayPhoto} error={lockError} />
          ) : null}
        </div>
      ) : null}

      {mode === "ticket" && !locked && legs.length <= 1 ? (
        <>
          {editFields ? (
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
              <Labeled label="Sport">
                <Input value={draft.sport} onChange={(e) => setDraft({ ...draft, sport: e.target.value })} />
              </Labeled>
              <Labeled label="Home">
                <Input value={draft.home} onChange={(e) => setDraft({ ...draft, home: e.target.value })} />
              </Labeled>
              <Labeled label="Away">
                <Input value={draft.away} onChange={(e) => setDraft({ ...draft, away: e.target.value })} />
              </Labeled>
              <Labeled label="Type (who wins / spread / over-under)">
                <Input
                  value={draft.marketType}
                  onChange={(e) => setDraft({ ...draft, marketType: e.target.value as MarketType })}
                />
              </Labeled>
              <Labeled label="Side">
                <Input value={draft.side} onChange={(e) => setDraft({ ...draft, side: e.target.value })} />
              </Labeled>
              <Labeled label="Odds (example −110 or +160)">
                <Input
                  inputMode="numeric"
                  value={draft.price}
                  onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
                />
              </Labeled>
              <Labeled label="The pick (example: Baltimore to win, or Mahomes over 249.5 passing yards)" className="col-span-2 md:col-span-3">
                <Input
                  value={draft.selection}
                  onChange={(e) => setDraft({ ...draft, selection: e.target.value })}
                  placeholder="Mahomes over 249.5 passing yards"
                />
              </Labeled>
              <Labeled label="Player (if this is a player bet)">
                <Input
                  value={draft.player ?? ""}
                  onChange={(e) => setDraft({ ...draft, player: e.target.value })}
                  placeholder="Patrick Mahomes"
                />
              </Labeled>
              <Labeled label="Line (example 249.5)">
                <Input
                  inputMode="decimal"
                  value={draft.point ?? ""}
                  onChange={(e) => setDraft({ ...draft, point: e.target.value === "" ? undefined : Number(e.target.value) })}
                  placeholder="249.5"
                />
              </Labeled>
            </div>
          ) : null}
          {preview && !editFields ? (
            <div className="mt-3">
              <Button variant="ghost" onClick={() => setEditFields(true)}>
                Fix a field
              </Button>
            </div>
          ) : null}
          {editFields && preview ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setEditFields(false)}>
                Hide fields
              </Button>
              <Button variant="ghost" onClick={() => setDraft(EMPTY)}>
                Clear
              </Button>
            </div>
          ) : null}
          {showReview ? (
            <TicketReview
              draft={draft.selection ? draft : undefined}
              rows={scan?.rows ?? []}
              onLock={confirmTicket}
              error={lockError}
            />
          ) : preview && !draft.selection && !busy ? (
            <p className="mt-4 text-sm text-emerald-500">We could not read a pick. Tap Fix a field and type it, then lock.</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function Labeled({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-xs uppercase tracking-[0.12em] text-muted ${className ?? ""}`}>
      {label}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

export function PhotoFirstNote({ venue }: { venue?: string }) {
  const target = venue ?? "Hard Rock Bet Florida";
  const fantasy = /draftkings|fantasy/i.test(target);
  return (
    <p className="rounded-md bg-wash-gold px-4 py-3 text-sm text-emerald-500">
      {fantasy
        ? `Confirm with a DraftKings Fantasy photo. We read live salaries and flag $200+ shifts. 18+ Florida DFS — not a Hard Rock Bet Florida ticket.`
        : `Photograph the Hard Rock Bet Florida screen. We read the live price. Then you confirm it on Log.`}
    </p>
  );
}

function editLeg(legs: ParsedTicket[], i: number, patch: Partial<ParsedTicket>): ParsedTicket[] {
  return legs.map((l, idx) => (idx === i ? { ...l, ...patch } : l));
}

function bytesToB64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
