import { createContext, useContext, useMemo } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getLiveBoardSnapshot } from "./board-snapshot";
import { overlaySnapshot } from "./research";
import type { DeskSnapshot, OptionStatus, ParsedTicket, PlayBoard, ScanBundle } from "./types";
import type { DeskPicks } from "./picks";
import { DEFAULT_DESK_SETTINGS, type DeskSettings } from "@/lib/desk-settings";

export type DeskDecision = {
  query: UseQueryResult<DeskSnapshot, Error>;
  snapshot: DeskSnapshot | undefined;
  scan: ScanBundle | null;
  picks: DeskPicks | null;
  board: PlayBoard | null;
  options: OptionStatus[];
  halt: boolean;
  weeklyHalt: boolean;
  ranking: boolean;
  rankMs: number | null;
  settings: DeskSettings;
  remoteHidden: string[];
};

export const DeskDecisionContext = createContext<DeskDecision | null>(null);

export function useBoardQuery() {
  return useQuery({
    queryKey: ["board"],
    queryFn: () => getLiveBoardSnapshot(),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function mergeSnapshot(base: DeskSnapshot | undefined, extras: DeskSnapshot["quotes"]): DeskSnapshot | undefined {
  if (!base) return undefined;
  const extra = extras.filter((q) => q.confirmed);
  if (!extra.length) return base;
  return { ...base, quotes: [...extra, ...base.quotes] };
}

export function overlayConfirmed(base: DeskSnapshot | undefined, tickets: ParsedTicket[]) {
  return overlaySnapshot(base, tickets) as DeskSnapshot | undefined;
}

const EMPTY_QUERY = {
  isError: false,
  isPending: true,
  isFetching: false,
  data: undefined,
  error: null,
} as unknown as UseQueryResult<DeskSnapshot, Error>;

const EMPTY: DeskDecision = {
  query: EMPTY_QUERY,
  snapshot: undefined,
  scan: null,
  picks: null,
  board: null,
  options: [],
  halt: false,
  weeklyHalt: false,
  ranking: false,
  rankMs: null,
  settings: DEFAULT_DESK_SETTINGS,
  remoteHidden: [],
};

export function useDeskDecision(): DeskDecision {
  return useContext(DeskDecisionContext) ?? EMPTY;
}

export function useOverlaySnapshot(data: DeskSnapshot | undefined, confirmed: ParsedTicket[]) {
  return useMemo(() => overlayConfirmed(data, confirmed), [data, confirmed]);
}
