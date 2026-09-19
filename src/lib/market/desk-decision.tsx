import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildPlays, scoreOptions } from "./plays";
import {
  DeskDecisionContext,
  overlayConfirmed,
  useBoardQuery,
  type DeskDecision,
} from "./use-board";
import { useDeskStore, selectDailyHalt, selectWeeklyHalt, selectUnit } from "@/lib/desk-store";
import { useAutoGrade, AutoGradeToasts } from "@/lib/auto-grade";
import type { DeskPicks } from "./picks";
import type { ScanBundle } from "./types";
import { oddsFingerprint, rankDesk } from "./rank";
import { DEFAULT_DESK_SETTINGS, rankSettingsOf, type DeskSettings } from "@/lib/desk-settings";
import { readDeskSettings, readHiddenPicks } from "@/lib/desk-public";
import { DESK_VERSION } from "./rules";
import { paperToLedger } from "@/lib/ledger";
import { activateLedgerReliability } from "./ledger-law";

export function DeskDecisionProvider({ children }: { children: ReactNode }) {
  const q = useBoardQuery();
  const liveBankroll = useDeskStore((s) => s.liveBankroll);
  const unitPct = useDeskStore((s) => s.unitPct);
  const stakeDollars = useDeskStore((s) => s.stakeDollars);
  const stake = selectUnit({ liveBankroll, unitPct, stakeDollars });
  const stakePct = liveBankroll > 0 ? stake / liveBankroll : unitPct;
  const entertainmentBudgeted = useDeskStore((s) => s.entertainmentBudgeted);
  const ignoreRibbon = useDeskStore((s) => s.ignoreRibbon);
  const slate = useDeskStore((s) => s.slate);
  const confirmedTickets = useDeskStore((s) => s.confirmedTickets);
  const paperTickets = useDeskStore((s) => s.paperTickets);
  const halt = useDeskStore(selectDailyHalt);
  const weeklyHalt = useDeskStore(selectWeeklyHalt);

  const settingsQuery = useQuery({
    queryKey: ["desk-settings"],
    queryFn: () => readDeskSettings(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const hiddenQuery = useQuery({
    queryKey: ["desk-hidden"],
    queryFn: () => readHiddenPicks(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const settings: DeskSettings = settingsQuery.data ?? DEFAULT_DESK_SETTINGS;
  const remoteHidden = hiddenQuery.data ?? [];

  const snapshot = useMemo(() => overlayConfirmed(q.data, confirmedTickets), [q.data, confirmedTickets]);
  const fingerprint = snapshot ? oddsFingerprint(snapshot) : "";
  const settingsKey = JSON.stringify(rankSettingsOf(settings));

  const [scan, setScan] = useState<ScanBundle | null>(null);
  const [picks, setPicks] = useState<DeskPicks | null>(null);
  const [ranking, setRanking] = useState(false);
  const [rankMs, setRankMs] = useState<number | null>(null);
  const job = useRef(0);
  const workerRef = useRef<Worker | null>(null);
  const lastKey = useRef("");
  const snapshotRef = useRef(snapshot);
  const settingsRef = useRef(settings);
  snapshotRef.current = snapshot;
  settingsRef.current = settings;

  useEffect(() => {
    activateLedgerReliability(paperTickets.map(paperToLedger));
  }, [paperTickets]);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const snap = snapshotRef.current;
    if (!snap || !fingerprint) return;
    const key = `${DESK_VERSION}|${fingerprint}|${halt}|${settingsKey}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    const id = ++job.current;
    setRanking(true);
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    const rankSettings = rankSettingsOf(settingsRef.current);

    const apply = (nextScan: ScanBundle, nextPicks: DeskPicks, ms: number) => {
      if (cancelled || id !== job.current) return;
      setScan(nextScan);
      setPicks(nextPicks);
      setRankMs(ms);
      setRanking(false);
    };

    const runFallback = () => {
      if (cancelled || id !== job.current) return;
      fallbackTimer = setTimeout(() => {
        if (cancelled || id !== job.current) return;
        const t0 = Date.now();
        const ranked = rankDesk(snap, halt, rankSettings);
        apply(ranked.scan, ranked.picks, Date.now() - t0);
      }, 0);
    };

    void (async () => {
      try {
        if (typeof Worker === "undefined") {
          runFallback();
          return;
        }
        let worker = workerRef.current;
        if (!worker) {
          const mod = await import("./rank.worker.ts?worker");
          if (cancelled || id !== job.current) return;
          worker = new mod.default();
          workerRef.current = worker;
        }
        worker.onmessage = (e: MessageEvent) => {
          if (e.data?.id != null && e.data.id !== id) return;
          if (e.data?.error) {
            runFallback();
            return;
          }
          apply(e.data.scan, e.data.picks, e.data.ms);
        };
        worker.onerror = () => {
          workerRef.current?.terminate();
          workerRef.current = null;
          runFallback();
        };
        worker.postMessage({ id, snapshot: snap, halt, settings: rankSettings });
      } catch {
        runFallback();
      }
    })();

    return () => {
      cancelled = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [fingerprint, halt, settingsKey]);

  const board = useMemo(() => {
    if (!snapshot || !scan) return null;
    return buildPlays({
      bankroll: liveBankroll,
      unitPct: stakePct,
      halt,
      weeklyHalt,
      scan,
      snapshot,
      entertainmentBudgeted,
      dfsReady: Boolean(slate?.confirmed && slate.cash),
      ignoreRibbon,
    });
  }, [snapshot, scan, liveBankroll, stakePct, halt, weeklyHalt, entertainmentBudgeted, slate, ignoreRibbon]);

  const options = useMemo(() => {
    if (!board || !scan || !snapshot) return [];
    return scoreOptions(board, {
      bankroll: liveBankroll,
      unitPct: stakePct,
      halt,
      weeklyHalt,
      scan,
      snapshot,
      dfsReady: Boolean(slate?.confirmed && slate.cash),
    });
  }, [board, scan, snapshot, liveBankroll, stakePct, halt, weeklyHalt, slate]);

  const value: DeskDecision = {
    query: q,
    snapshot,
    scan,
    picks,
    board,
    options,
    halt,
    weeklyHalt,
    ranking,
    rankMs,
    settings,
    remoteHidden,
  };

  const { notifications, dismiss } = useAutoGrade(snapshot);

  return (
    <DeskDecisionContext.Provider value={value}>
      {children}
      <AutoGradeToasts notifications={notifications} onDismiss={dismiss} />
    </DeskDecisionContext.Provider>
  );
}
