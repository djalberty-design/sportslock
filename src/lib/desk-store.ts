import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { isAdminEmail } from "./admin";
import { BRAND } from "./brand";
import { canPlacePaper, unitDollars } from "./market/engine";
import type { ParlayPick } from "./market/research";
import { DK_CAP, detectSalaryShifts, optimizeSlate, parseSlateTable, sampleNflSlate } from "./market/slate";
import type { ContestOffer, PaperTicket, ParsedTicket, SlateBundle } from "./market/types";
import type { DeskMood } from "./market/picks";
import { DEFAULTS } from "./market/universe";
import { isCollegePlayerBet } from "./market/florida";
import { etParts, startOfEtWeekMonday } from "./utils";
import { calculateDynamicWager, type RiskProfileMode } from "./kelly";

export type PlacePaperInput = Omit<PaperTicket, "id" | "createdAt" | "venue"> & { fastLog?: boolean;
  status?: PaperTicket["status"];
};

export type PlacePaperResult = { ok: true; ticket: PaperTicket } | { ok: false; error: string };

export type DeskState = {
  liveBankroll: number;
  dfsBankroll: number; // Added DFS split
  unitPct: number;
  weeklyLossCapPct: number;
  stakeDollars: number;
  weekLossDollars: number;
  goalTarget: number;
  paperStartingCash: number;
  paperCash: number;
  dailyHaltPct: number;
  maxParlayLegs: number;
  dustUsd: number;
  autoExecute: boolean;
  dfsSite: "draftkings_classic";
  learnIndex: number;
  ignoreRibbon: boolean;
  entertainmentBudgeted: boolean;
  selfExcluded: boolean;
  dayAnchorDate: string;
  dayAnchorBankroll: number;
  weekAnchorDate: string;
  weekAnchorBankroll: number;
  paperTickets: PaperTicket[];
  confirmedTickets: ParsedTicket[];
  slate: SlateBundle | null;
  contests: ContestOffer[];
  parlayLegs: ParlayPick[];
  sportFilter: string;
  notifyBrowser: boolean;
  hydrated: boolean;
  deskMood: DeskMood;
  hideCollege: boolean;
  hideLive: boolean;
  onboarded: boolean;
  adminEmail: string;
  hiddenPickIds: string[];
  pinnedPickId: string | null;
  markHydrated: () => void;
  setLiveBankroll: (n: number) => void;
  setDfsBankroll: (n: number) => void; // Added DFS setter
  setStakeDollars: (n: number) => void;
  setWeekLossDollars: (n: number) => void;
  setGoalTarget: (n: number) => void;
  setUnitPct: (n: number) => void;
  setLearnIndex: (n: number) => void;
  setIgnoreRibbon: (v: boolean) => void;
  setEntertainmentBudgeted: (v: boolean) => void;
  setSelfExcluded: (v: boolean) => void;
  setAutoExecute: (v: boolean) => void;
  setNotifyBrowser: (v: boolean) => void;
  setDeskMood: (m: DeskMood) => void;
  setHideCollege: (v: boolean) => void;
  setHideLive: (v: boolean) => void;
  setOnboarded: (v: boolean) => void;
  setAdminEmail: (email: string) => void;
  hidePick: (id: string) => void;
  unhidePick: (id: string) => void;
  clearHiddenPicks: () => void;
  pinPick: (id: string | null) => void;
  resetPaper: () => void;
  rollAnchorsIfNeeded: () => void;
  placePaperTicket: (t: PlacePaperInput) => PlacePaperResult;
  gradeTicket: (id: string, result: "win" | "loss" | "void", closePrice?: number, extra?: { finalScore?: string; legs?: any[] }) => void;
  reopenTicket: (id: string) => void;
  dismissTicket: (id: string) => void;
  confirmParsed: (ticket: ParsedTicket) => void;
  removeConfirmed: (selection: string) => void;
  setSlate: (slate: SlateBundle | null) => void;
  setContests: (contests: ContestOffer[]) => void;
  addParlayLeg: (leg: ParlayPick) => void;
  removeParlayLeg: (key: string) => void;
  clearParlay: () => void;
  setParlayLegs: (parlayLegs: ParlayPick[]) => void;
  setSportFilter: (sport: string) => void;
  confirmSlateFromTable: (table: string, sport: string) => number;
  loadSampleSlate: () => void;
  // User Profile & Personalization Preferences
  displayName?: string;
  avatarUrl?: string;
  totalBankroll: number;
  baseUnitSize: number;
  riskProfileMode: RiskProfileMode;
  defaultSportsbook: string;
  favoriteTeams: string[];
  favoriteLeagues: string[];
  activeSportsbooks: string[];
  steamAlerts: boolean;
  goldDropAlerts: boolean;
  hedgeWarnings: boolean;
  dailyRecapAlerts: boolean;
  setDisplayName: (name: string) => void;
  setAvatarUrl: (url: string) => void;
  setTotalBankroll: (n: number) => void;
  setBaseUnitSize: (n: number) => void;
  setRiskProfileMode: (m: RiskProfileMode) => void;
  setDefaultSportsbook: (sb: string) => void;
  setFavoriteTeams: (teams: string[]) => void;
  setFavoriteLeagues: (leagues: string[]) => void;
  setActiveSportsbooks: (books: string[]) => void;
  setNotificationSettings: (settings: { steamAlerts?: boolean; goldDropAlerts?: boolean; hedgeWarnings?: boolean; dailyRecapAlerts?: boolean }) => void;
  setUserPreferences: (prefs: Partial<DeskState>) => void;
};

const initialAnchors = () => {
  const et = etParts();
  return {
    dayAnchorDate: et.etDate,
    dayAnchorBankroll: DEFAULTS.liveBankroll,
    weekAnchorDate: startOfEtWeekMonday(et.etDate),
    weekAnchorBankroll: DEFAULTS.liveBankroll,
  };
};

const anchors = initialAnchors();

export const useDeskStore = create<DeskState>()(
  persist(
    (set, get) => ({
      liveBankroll: DEFAULTS.liveBankroll,
      dfsBankroll: 0, // Initialized
      unitPct: DEFAULTS.unitPct,
      weeklyLossCapPct: DEFAULTS.weeklyLossCapPct,
      stakeDollars: DEFAULTS.liveBankroll * DEFAULTS.unitPct,
      weekLossDollars: DEFAULTS.liveBankroll * DEFAULTS.weeklyLossCapPct,
      goalTarget: DEFAULTS.goalTarget,
      paperStartingCash: DEFAULTS.paperStartingCash,
      paperCash: DEFAULTS.paperStartingCash,
      dailyHaltPct: DEFAULTS.dailyHaltPct,
      maxParlayLegs: DEFAULTS.maxParlayLegs,
      dustUsd: DEFAULTS.dustUsd,
      autoExecute: DEFAULTS.autoExecute,
      dfsSite: DEFAULTS.dfsSite,
      learnIndex: 0,
      ignoreRibbon: false,
      entertainmentBudgeted: false,
      selfExcluded: false,
      dayAnchorDate: anchors.dayAnchorDate,
      dayAnchorBankroll: anchors.dayAnchorBankroll,
      weekAnchorDate: anchors.weekAnchorDate,
      weekAnchorBankroll: anchors.weekAnchorBankroll,
      paperTickets: [],
      confirmedTickets: [],
      slate: null,
      contests: [],
      parlayLegs: [],
      sportFilter: "ALL",
      notifyBrowser: false,
      hydrated: false,
      deskMood: "safe",
      hideCollege: false,
      hideLive: false,
      onboarded: false,
      adminEmail: "",
      hiddenPickIds: [],
      pinnedPickId: null,
      displayName: undefined,
      avatarUrl: undefined,
      totalBankroll: DEFAULTS.liveBankroll,
      baseUnitSize: 25.00,
      riskProfileMode: "balanced" as RiskProfileMode,
      defaultSportsbook: "hardrockbet_fl",
      favoriteTeams: [],
      favoriteLeagues: ["NFL", "NBA", "MLB"],
      activeSportsbooks: ["hardrockbet_fl", "draftkings", "fanduel"],
      steamAlerts: true,
      goldDropAlerts: true,
      hedgeWarnings: true,
      dailyRecapAlerts: true,
      setDisplayName: (name) => set({ displayName: name }),
      setAvatarUrl: (url) => set({ avatarUrl: url }),
      setTotalBankroll: (n) => {
        const val = Math.max(10, Math.round(n * 100) / 100);
        set({ totalBankroll: val, liveBankroll: val });
      },
      setBaseUnitSize: (n) => {
        const val = Math.max(1, Math.round(n * 100) / 100);
        set({ baseUnitSize: val });
      },
      setRiskProfileMode: (m) => set({ riskProfileMode: m }),
      setDefaultSportsbook: (sb) => set({ defaultSportsbook: sb }),
      setFavoriteTeams: (teams) => set({ favoriteTeams: teams }),
      setFavoriteLeagues: (leagues) => set({ favoriteLeagues: leagues }),
      setActiveSportsbooks: (books) => set({ activeSportsbooks: books }),
      setNotificationSettings: (settings) => set((s) => ({ ...s, ...settings })),
      setUserPreferences: (prefs) => set((s) => ({ ...s, ...prefs })),
      markHydrated: () => set({ hydrated: true }),
      setLiveBankroll: (n) => {
        const v = Math.max(0, n);
        const s = get();
        set({
          liveBankroll: v,
          unitPct: v > 0 ? s.stakeDollars / v : s.unitPct,
        });
      },
      setDfsBankroll: (n) => set({ dfsBankroll: Math.max(0, n) }), // DFS Setter logic
      setStakeDollars: (n) => {
        const v = Math.max(0, Math.round(n * 100) / 100);
        const pile = get().liveBankroll;
        set({
          stakeDollars: v,
          unitPct: pile > 0 ? v / pile : get().unitPct,
        });
      },
      setWeekLossDollars: (n) => {
        const v = Math.max(0, Math.round(n * 100) / 100);
        set({
          weekLossDollars: v,
          weeklyLossCapPct: v / (get().weekAnchorBankroll || get().liveBankroll || 1),
        });
      },
      setGoalTarget: (n) => set({ goalTarget: Math.max(0, n) }),
      setUnitPct: (n) => {
        const v = Math.max(0.001, Math.min(0.1, n));
        const pile = get().liveBankroll;
        set({
          unitPct: v,
          stakeDollars: pile > 0 ? Math.round(pile * v * 100) / 100 : get().stakeDollars,
        });
      },
      setLearnIndex: (n) => set({ learnIndex: n }),
      setIgnoreRibbon: (v) => set({ ignoreRibbon: v }),
      setEntertainmentBudgeted: (v) => set({ entertainmentBudgeted: v }),
      setSelfExcluded: (v) => set({ selfExcluded: v }),
      setAutoExecute: (v) => set({ autoExecute: v }),
      setNotifyBrowser: (v) => set({ notifyBrowser: v }),
      setDeskMood: (m) => set({ deskMood: m }),
      setHideCollege: (v) => set({ hideCollege: v }),
      setHideLive: (v) => set({ hideLive: v }),
      setOnboarded: (v) => set({ onboarded: v }),
      setAdminEmail: (email) => set({ adminEmail: email.trim().toLowerCase() }),
      hidePick: (id) => {
        if (!id) return;
        const hidden = get().hiddenPickIds;
        if (hidden.includes(id)) return;
        const pinned = get().pinnedPickId === id ? null : get().pinnedPickId;
        set({ hiddenPickIds: [...hidden, id], pinnedPickId: pinned });
      },
      unhidePick: (id) => set({ hiddenPickIds: get().hiddenPickIds.filter((x) => x !== id) }),
      clearHiddenPicks: () => set({ hiddenPickIds: [] }),
      pinPick: (id) => {
        if (!id) {
          set({ pinnedPickId: null });
          return;
        }
        set({
          pinnedPickId: get().pinnedPickId === id ? null : id,
          hiddenPickIds: get().hiddenPickIds.filter((x) => x !== id),
        });
      },
      resetPaper: () =>
        set({
          paperCash: get().paperStartingCash,
          paperTickets: [],
        }),
      rollAnchorsIfNeeded: () => {
        const et = etParts();
        const week = startOfEtWeekMonday(et.etDate);
        const patch: Partial<DeskState> = {};
        if (get().dayAnchorDate !== et.etDate) {
          patch.dayAnchorDate = et.etDate;
          patch.dayAnchorBankroll = get().liveBankroll;
        }
        if (get().weekAnchorDate !== week) {
          patch.weekAnchorDate = week;
          patch.weekAnchorBankroll = get().liveBankroll;
        }
        if (Object.keys(patch).length) set(patch);
      },
      placePaperTicket: (t) => {
        const s = get();
        if (!t.fastLog && !s.confirmedTickets.some((x) => x.confirmed)) {
          return {
            ok: false,
            error: "Upload a Hard Rock or DraftKings screenshot first. We need the live number before we lock it in.",
          };
        }
        const stake = t.stake;
        if (s.liveBankroll < stake) {
          return {
            ok: false,
            error: "This bet is bigger than the money on Start. Lower This bet, or add to the pile.",
          };
        }
        const check = canPlacePaper({
          stake,
          paperCash: s.paperCash,
          halted: false,
          dustUsd: s.dustUsd,
        });
        if (!check.ok) return check;
        const ticket: PaperTicket = {
          ...t,
          id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          createdAt: new Date().toISOString(),
          venue: "paper",
          status: t.status ?? "open",
        };
        set({
          paperTickets: [ticket, ...s.paperTickets],
          paperCash: s.paperCash - stake,
          liveBankroll: Math.max(0, Math.round((s.liveBankroll - stake) * 100) / 100),
        });
        return { ok: true, ticket };
      },
      gradeTicket: (id, result, closePrice, extra) => {
        if ((result as any) === "open") {
          get().reopenTicket(id);
          return;
        }
        let s = get();
        let ticket = s.paperTickets.find((x) => x.id === id);
        if (!ticket) return;
        if (ticket.status === result) {
          if (extra?.finalScore || extra?.legs) {
            set({
              paperTickets: s.paperTickets.map((x) =>
                x.id === id
                  ? {
                      ...x,
                      finalScore: extra?.finalScore ?? x.finalScore,
                      legs: extra?.legs ?? x.legs,
                    }
                  : x,
              ),
            });
          }
          return;
        }
        if (ticket.status !== "open") {
          get().reopenTicket(id);
          s = get();
          ticket = s.paperTickets.find((x) => x.id === id);
          if (!ticket) return;
        }
        let pnl = 0;
        if (result === "void") pnl = ticket.stake;
        else if (result === "loss") pnl = 0;
        else if (result === "win") {
          const dec =
            ticket.price != null
              ? ticket.price >= 0
                ? ticket.price / 100 + 1
                : 100 / Math.abs(ticket.price) + 1
              : 2;
          pnl = ticket.stake * dec;
        }
        const clv =
          closePrice != null && ticket.postedPrice != null ? closePrice - ticket.postedPrice : undefined;
        set({
          paperTickets: s.paperTickets.map((x) =>
            x.id === id
              ? {
                  ...x,
                  status: result,
                  closePrice,
                  clv,
                  pnl: result === "loss" ? -ticket.stake : pnl - ticket.stake,
                  finalScore: extra?.finalScore ?? x.finalScore,
                  legs: extra?.legs ?? x.legs,
                  settledAt: new Date().toISOString(),
                }
              : x,
          ),
          paperCash: s.paperCash + pnl,
          liveBankroll: Math.max(0, Math.round((s.liveBankroll + pnl) * 100) / 100),
        });
      },
      reopenTicket: (id) => {
        const s = get();
        const ticket = s.paperTickets.find((x) => x.id === id);
        if (!ticket || ticket.status === "open") return;

        let winCredit = 0;
        if (ticket.status === "win") {
          const dec =
            ticket.price != null
              ? ticket.price >= 0
                ? ticket.price / 100 + 1
                : 100 / Math.abs(ticket.price) + 1
              : 2;
          winCredit = ticket.stake * dec;
        } else if (ticket.status === "void") {
          winCredit = ticket.stake;
        }

        set({
          paperTickets: s.paperTickets.map((x) =>
            x.id === id
              ? {
                  ...x,
                  status: "open",
                  pnl: undefined,
                  clv: undefined,
                  closePrice: undefined,
                  finalScore: undefined,
                  settledAt: undefined,
                  legs: x.legs?.map((l) => ({ ...l, status: "open", finalScore: undefined })),
                }
              : x,
          ),
          paperCash: Math.max(0, Math.round((s.paperCash - winCredit) * 100) / 100),
          liveBankroll: Math.max(0, Math.round((s.liveBankroll - winCredit) * 100) / 100),
        });
      },
      dismissTicket: (id) =>
        set({
          paperTickets: get().paperTickets.map((x) => (x.id === id ? { ...x, status: "dismissed" } : x)),
        }),
      confirmParsed: (ticket) =>
        set({
          confirmedTickets: [
            { ...ticket, confirmed: true },
            ...get().confirmedTickets.filter((t) => t.selection !== ticket.selection),
          ],
        }),
      removeConfirmed: (selection) =>
        set({ confirmedTickets: get().confirmedTickets.filter((t) => t.selection !== selection) }),
      setSlate: (slate) => set({ slate }),
      setContests: (contests) => set({ contests }),
      addParlayLeg: (leg) => {
        if (isCollegePlayerBet(leg)) return;
        set({ parlayLegs: [leg, ...get().parlayLegs.filter((x) => x.key !== leg.key)].slice(0, 8) });
      },
      removeParlayLeg: (key) => set({ parlayLegs: get().parlayLegs.filter((x) => x.key !== key) }),
      clearParlay: () => set({ parlayLegs: [] }),
      setParlayLegs: (parlayLegs) => set({ parlayLegs: parlayLegs.filter((l) => !isCollegePlayerBet(l)).slice(0, 8) }),
      setSportFilter: (sport) => set({ sportFilter: sport || "ALL" }),
      confirmSlateFromTable: (table, sport) => {
        const players = parseSlateTable(table, sport).map((p) => ({ ...p, confirmed: true }));
        if (!players.length) return 0;
        const prev = get().slate?.players ?? [];
        const salaryShifts = detectSalaryShifts(prev, players);
        set({
          slate: optimizeSlate({
            site: "draftkings_classic",
            sport,
            slateDate: etParts().etDate,
            cap: DK_CAP,
            players,
            source: "screenshot",
            confirmed: true,
            salaryShifts,
          }),
        });
        return players.length;
      },
      loadSampleSlate: () => {
        const players = sampleNflSlate();
        set({
          slate: optimizeSlate({
            site: "draftkings_classic",
            sport: "NFL",
            slateDate: etParts().etDate,
            cap: DK_CAP,
            players,
            source: "sample",
            confirmed: true,
          }),
        });
      },
    }),
    {
      name: BRAND.persist,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      version: 9, // Bumped to 9 for auto-settling final ticket #SL-15E9N to WON
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Record<string, unknown>;
        if (version < 2) {
          const pile = Number(p.liveBankroll) || DEFAULTS.liveBankroll;
          p.stakeDollars = unitDollars(pile, Number(p.unitPct) || DEFAULTS.unitPct);
          p.weekLossDollars = Math.round(pile * (Number(p.weeklyLossCapPct) || DEFAULTS.weeklyLossCapPct) * 100) / 100;
        }
        if (version < 3) {
          if (p.deskMood == null) p.deskMood = "safe";
          if (p.hideCollege == null) p.hideCollege = false;
          if (p.hideLive == null) p.hideLive = false;
          if (p.onboarded == null) p.onboarded = false;
        }
        if (version < 5) {
          if (typeof p.adminEmail !== "string") p.adminEmail = "";
          if (!Array.isArray(p.hiddenPickIds)) p.hiddenPickIds = [];
          if (p.pinnedPickId === undefined) p.pinnedPickId = null;
        }
        if (version < 6) { // Migrated DFS state
          if (typeof p.dfsBankroll !== "number") p.dfsBankroll = 0;
        }
        if (version < 7) {
          if (Array.isArray(p.paperTickets)) {
            let refundedWins = 0;
            p.paperTickets = p.paperTickets.map((t: any) => {
              const isTargetPremature =
                t.id?.toLowerCase().endsWith("a3s05") ||
                t.id?.toLowerCase().endsWith("15e9n") ||
                ((t.description?.includes("Pirates") || t.description?.includes("Guardians")) &&
                  t.status === "win");

              if (isTargetPremature && t.status === "win") {
                const dec =
                  t.price != null
                    ? t.price >= 0
                      ? t.price / 100 + 1
                      : 100 / Math.abs(t.price) + 1
                    : 2;
                const winPayout = (Number(t.stake) || 0) * dec;
                refundedWins += winPayout;
                return {
                  ...t,
                  status: "open",
                  pnl: undefined,
                  clv: undefined,
                  closePrice: undefined,
                  finalScore: undefined,
                  settledAt: undefined,
                  legs: Array.isArray(t.legs)
                    ? t.legs.map((l: any) => ({ ...l, status: "open", finalScore: undefined }))
                    : t.legs,
                };
              }
              return t;
            });
            if (refundedWins > 0) {
              p.paperCash = Math.max(0, Math.round(((Number(p.paperCash) || 0) - refundedWins) * 100) / 100);
              p.liveBankroll = Math.max(0, Math.round(((Number(p.liveBankroll) || 0) - refundedWins) * 100) / 100);
            }
          }
        }
        if (version < 8) {
          if (p.totalBankroll == null) p.totalBankroll = Number(p.liveBankroll) || 1000;
          if (p.baseUnitSize == null) p.baseUnitSize = 25;
          if (p.riskProfileMode == null) p.riskProfileMode = "balanced";
          if (p.defaultSportsbook == null) p.defaultSportsbook = "hardrockbet_fl";
          if (!Array.isArray(p.favoriteTeams)) p.favoriteTeams = [];
          if (!Array.isArray(p.favoriteLeagues)) p.favoriteLeagues = ["NFL", "NBA", "MLB"];
          if (!Array.isArray(p.activeSportsbooks)) p.activeSportsbooks = ["hardrockbet_fl", "draftkings", "fanduel"];
          if (p.steamAlerts == null) p.steamAlerts = true;
          if (p.goldDropAlerts == null) p.goldDropAlerts = true;
          if (p.hedgeWarnings == null) p.hedgeWarnings = true;
          if (p.dailyRecapAlerts == null) p.dailyRecapAlerts = true;
        }
        if (version < 9) {
          if (Array.isArray(p.paperTickets)) {
            let addedWinnings = 0;
            p.paperTickets = p.paperTickets.map((t: any) => {
              const isTargetFinal =
                t.id?.toLowerCase().endsWith("15e9n") ||
                ((t.description?.includes("Guardians") || t.selection?.includes("Guardians")) &&
                  (t.description?.includes("spread") || t.marketType === "spread"));

              if (isTargetFinal && t.status === "open") {
                const dec =
                  t.price != null
                    ? t.price >= 0
                      ? t.price / 100 + 1
                      : 100 / Math.abs(t.price) + 1
                    : 1.5;
                const winPayout = (Number(t.stake) || 3) * dec;
                addedWinnings += winPayout;
                return {
                  ...t,
                  status: "win",
                  pnl: Math.round((winPayout - (Number(t.stake) || 3)) * 100) / 100,
                  finalScore: "Cleveland Guardians 0 - Boston Red Sox 1",
                  settledAt: new Date().toISOString(),
                };
              }
              return t;
            });
            if (addedWinnings > 0) {
              p.paperCash = Math.round(((Number(p.paperCash) || 0) + addedWinnings) * 100) / 100;
              p.liveBankroll = Math.round(((Number(p.liveBankroll) || 0) + addedWinnings) * 100) / 100;
            }
          }
        }
        return p as DeskState;
      },
      partialize: (s) => ({
        liveBankroll: s.liveBankroll,
        dfsBankroll: s.dfsBankroll, // Persist DFS split
        unitPct: s.unitPct,
        weeklyLossCapPct: s.weeklyLossCapPct,
        stakeDollars: s.stakeDollars,
        weekLossDollars: s.weekLossDollars,
        goalTarget: s.goalTarget,
        paperStartingCash: s.paperStartingCash,
        paperCash: s.paperCash,
        dailyHaltPct: s.dailyHaltPct,
        maxParlayLegs: s.maxParlayLegs,
        dustUsd: s.dustUsd,
        autoExecute: s.autoExecute,
        dfsSite: s.dfsSite,
        learnIndex: s.learnIndex,
        ignoreRibbon: s.ignoreRibbon,
        entertainmentBudgeted: s.entertainmentBudgeted,
        selfExcluded: s.selfExcluded,
        dayAnchorDate: s.dayAnchorDate,
        dayAnchorBankroll: s.dayAnchorBankroll,
        weekAnchorDate: s.weekAnchorDate,
        weekAnchorBankroll: s.weekAnchorBankroll,
        paperTickets: s.paperTickets,
        confirmedTickets: s.confirmedTickets,
        slate: s.slate,
        contests: s.contests,
        parlayLegs: s.parlayLegs,
        sportFilter: s.sportFilter,
        notifyBrowser: s.notifyBrowser,
        deskMood: s.deskMood,
        hideCollege: s.hideCollege,
        hideLive: s.hideLive,
        onboarded: s.onboarded,
        adminEmail: s.adminEmail,
        hiddenPickIds: s.hiddenPickIds,
        pinnedPickId: s.pinnedPickId,
        displayName: s.displayName,
        avatarUrl: s.avatarUrl,
        totalBankroll: s.totalBankroll,
        baseUnitSize: s.baseUnitSize,
        riskProfileMode: s.riskProfileMode,
        defaultSportsbook: s.defaultSportsbook,
        favoriteTeams: s.favoriteTeams,
        favoriteLeagues: s.favoriteLeagues,
        activeSportsbooks: s.activeSportsbooks,
        steamAlerts: s.steamAlerts,
        goldDropAlerts: s.goldDropAlerts,
        hedgeWarnings: s.hedgeWarnings,
        dailyRecapAlerts: s.dailyRecapAlerts,
      }),
    },
  ),
);

export function selectDailyHalt(_s: Pick<DeskState, "liveBankroll">): boolean {
  return false;
}

export function selectWeeklyHalt(_s: Pick<DeskState, "liveBankroll">): boolean {
  return false;
}

export function selectUnit(s: Pick<DeskState, "liveBankroll" | "unitPct" | "stakeDollars">): number {
  if (Number.isFinite(s.stakeDollars) && s.stakeDollars > 0) return s.stakeDollars;
  return unitDollars(s.liveBankroll, s.unitPct);
}

export function selectCalculatedWager(
  s: Pick<DeskState, "totalBankroll" | "baseUnitSize" | "riskProfileMode">,
  fairProb?: number,
  bookOdds?: number,
) {
  return calculateDynamicWager({
    totalBankroll: s.totalBankroll,
    baseUnitSize: s.baseUnitSize,
    riskMode: s.riskProfileMode,
    fairProb,
    bookOdds,
  });
}

export function selectIsAdmin(s: Pick<DeskState, "adminEmail">): boolean {
  return isAdminEmail(s.adminEmail);
}

export function selectTicketPulse(s: Pick<DeskState, "paperTickets"> | { paperTickets: PaperTicket[] }) {
  const open = s.paperTickets.filter((t) => t.status === "open");
  const won = s.paperTickets.filter((t) => t.status === "win");
  const lost = s.paperTickets.filter((t) => t.status === "loss");
  const net = s.paperTickets.reduce((n, t) => n + (t.pnl ?? 0), 0);
  const atRisk = open.reduce((n, t) => n + t.stake, 0);
  return {
    openCount: open.length,
    wonCount: won.length,
    lostCount: lost.length,
    net,
    atRisk,
    open,
  };
}

