import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getUserProfileDataFn,
  updateUserProfileFn,
  updateUserPreferencesFn,
  updateNotificationSettingsFn,
  toggleUserBookAccountFn,
  type RiskProfileMode,
} from "@/lib/profile-api";
import { useDeskStore } from "@/lib/desk-store";
import { RISK_PROFILES, calculateDynamicWager } from "@/lib/kelly";
import { cn } from "@/lib/utils";
import {
  User,
  Shield,
  Wallet,
  Sliders,
  Bell,
  CheckCircle2,
  Sparkles,
  Zap,
  Target,
  Flame,
  ArrowRight,
} from "lucide-react";

const AVAILABLE_BOOKS = [
  { id: "hardrockbet_fl", name: "Hard Rock Bet", tag: "Primary / FL" },
  { id: "draftkings", name: "DraftKings", tag: "Major Market" },
  { id: "fanduel", name: "FanDuel", tag: "Major Market" },
  { id: "betmgm", name: "BetMGM", tag: "Major Market" },
  { id: "caesars", name: "Caesars", tag: "Major Market" },
  { id: "circa", name: "Circa Sports", tag: "Sharp Book" },
  { id: "pinnacle", name: "Pinnacle", tag: "Sharp Consensus" },
  { id: "bet365", name: "Bet365", tag: "Global" },
];

const AVATAR_PRESETS = [
  "https://api.dicebear.com/7.x/bottts/svg?seed=SportsLock",
  "https://api.dicebear.com/7.x/bottts/svg?seed=AlphaTrader",
  "https://api.dicebear.com/7.x/bottts/svg?seed=QuantDesk",
  "https://api.dicebear.com/7.x/bottts/svg?seed=SharpEdge",
  "https://api.dicebear.com/7.x/bottts/svg?seed=CopulaBoss",
];

export function ProfileForm() {
  const queryClient = useQueryClient();
  const store = useDeskStore();

  const { data, isLoading } = useQuery({
    queryKey: ["user-profile-data"],
    queryFn: () => getUserProfileDataFn(),
    staleTime: 30_000,
  });

  // Local Form State
  const [displayName, setDisplayName] = useState(store.adminEmail ? "Quant Lead" : "Pro Bettor");
  const [avatarUrl, setAvatarUrl] = useState(AVATAR_PRESETS[0]);
  const [totalBankroll, setTotalBankroll] = useState(store.totalBankroll || 1000);
  const [baseUnitSize, setBaseUnitSize] = useState(store.baseUnitSize || 25);
  const [riskMode, setRiskMode] = useState<RiskProfileMode>(store.riskProfileMode || "balanced");
  const [activeBooks, setActiveBooks] = useState<Set<string>>(new Set(store.activeSportsbooks || ["hardrockbet_fl", "draftkings", "fanduel"]));
  const [notifs, setNotifs] = useState({
    steamAlerts: store.steamAlerts ?? true,
    goldDropAlerts: store.goldDropAlerts ?? true,
    hedgeWarnings: store.hedgeWarnings ?? true,
    dailyRecapAlerts: store.dailyRecapAlerts ?? true,
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sync server data into state on load
  useEffect(() => {
    if (data) {
      if (data.profile.displayName) setDisplayName(data.profile.displayName);
      if (data.profile.avatarUrl) setAvatarUrl(data.profile.avatarUrl);
      if (data.preferences.totalBankroll) setTotalBankroll(data.preferences.totalBankroll);
      if (data.preferences.baseUnitSize) setBaseUnitSize(data.preferences.baseUnitSize);
      if (data.preferences.riskProfileMode) setRiskMode(data.preferences.riskProfileMode);
      if (data.sportsbooks?.length) {
        const active = new Set(data.sportsbooks.filter((b) => b.isActive).map((b) => b.sportsbookId));
        if (active.size > 0) setActiveBooks(active);
      }
      setNotifs({
        steamAlerts: data.notifications.steamAlerts,
        goldDropAlerts: data.notifications.goldDropAlerts,
        hedgeWarnings: data.notifications.hedgeWarnings,
        dailyRecapAlerts: data.notifications.dailyRecapAlerts,
      });

      // Synchronize Zustand store
      store.setUserPreferences({
        totalBankroll: data.preferences.totalBankroll,
        liveBankroll: data.preferences.totalBankroll,
        baseUnitSize: data.preferences.baseUnitSize,
        riskProfileMode: data.preferences.riskProfileMode,
        activeSportsbooks: Array.from(activeBooks),
        steamAlerts: data.notifications.steamAlerts,
        goldDropAlerts: data.notifications.goldDropAlerts,
        hedgeWarnings: data.notifications.hedgeWarnings,
        dailyRecapAlerts: data.notifications.dailyRecapAlerts,
      });
    }
  }, [data]);

  // Mutations
  const saveProfileMut = useMutation({
    mutationFn: async () => {
      await updateUserProfileFn({
        data: { displayName, avatarUrl },
      });
      await updateUserPreferencesFn({
        data: {
          totalBankroll,
          baseUnitSize,
          riskProfileMode: riskMode,
        },
      });
      await updateNotificationSettingsFn({
        data: notifs,
      });
      // Update books
      for (const b of AVAILABLE_BOOKS) {
        await toggleUserBookAccountFn({
          data: { sportsbookId: b.id, isActive: activeBooks.has(b.id) },
        });
      }
    },
    onSuccess: () => {
      // Sync local Zustand state instantly
      store.setTotalBankroll(totalBankroll);
      store.setBaseUnitSize(baseUnitSize);
      store.setRiskProfileMode(riskMode);
      store.setActiveSportsbooks(Array.from(activeBooks));
      store.setNotificationSettings(notifs);

      queryClient.invalidateQueries({ queryKey: ["user-profile-data"] });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    },
  });

  const toggleBook = (id: string) => {
    setActiveBooks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id); // Keep at least one book active
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Kelly Preview Calculations
  const preview3Pct = calculateDynamicWager({
    totalBankroll,
    baseUnitSize,
    riskMode,
    fairProb: 0.554,
    bookOdds: -110,
  });

  const preview5Pct = calculateDynamicWager({
    totalBankroll,
    baseUnitSize,
    riskMode,
    fairProb: 0.574,
    bookOdds: -110,
  });

  const previewHeavySgp = calculateDynamicWager({
    totalBankroll,
    baseUnitSize,
    riskMode,
    fairProb: 0.38,
    bookOdds: 200,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="flex items-center gap-2 text-muted text-sm font-mono animate-pulse">
          <Sparkles className="size-4 text-primary" /> Loading User Profile & Preferences...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      {/* ── HEADER & AVATAR SECTION ── */}
      <section className="bg-panel border border-line rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="relative group shrink-0">
            <img
              src={avatarUrl}
              alt="User Avatar"
              className="size-20 sm:size-24 rounded-2xl border-2 border-primary/40 bg-obsidian p-1 shadow-lg shadow-primary/10 object-cover"
            />
          </div>
          <div className="flex-1 text-center sm:text-left space-y-3">
            <div>
              <span className="text-[10px] font-mono uppercase bg-primary/10 text-primary border border-primary/30 px-2.5 py-0.5 rounded-full font-bold">
                Institutional Quant Profile
              </span>
              <h2 className="text-2xl font-display font-bold text-ink mt-1">
                {displayName || "Quant Desk Lead"}
              </h2>
              <p className="text-xs text-muted">
                Configure your personal bankroll sizing, fractional Kelly risk profile, active sportsbooks, and real-time alert triggers.
              </p>
            </div>

            {/* Avatar Preset Selector */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
              <span className="text-[11px] text-muted font-medium">Select Avatar:</span>
              {AVATAR_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setAvatarUrl(p)}
                  className={cn(
                    "size-8 rounded-lg border p-0.5 transition-all overflow-hidden cursor-pointer",
                    avatarUrl === p
                      ? "border-primary ring-2 ring-primary/40 scale-105"
                      : "border-line hover:border-line-hover opacity-70 hover:opacity-100"
                  )}
                >
                  <img src={p} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>

            <div className="pt-2">
              <label className="block text-[11px] font-semibold text-muted mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your handle..."
                className="w-full sm:max-w-xs bg-obsidian border border-line rounded-lg px-3 py-1.5 text-sm text-ink focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── BANKROLL & UNIT ECONOMICS ── */}
      <section className="bg-panel border border-line rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-2 border-b border-line/60 pb-3">
          <Wallet className="size-5 text-emerald-400" />
          <div>
            <h3 className="text-base font-display font-bold text-ink">Bankroll & Unit Economics</h3>
            <p className="text-xs text-muted">
              SportsLock translates mathematical edge directly into personalized dollar bet recommendations.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-obsidian border border-line/80 rounded-xl p-4 space-y-1.5">
            <label className="block text-xs font-bold text-ink">Total Bankroll ($)</label>
            <p className="text-[11px] text-muted">Your dedicated sports betting investment capital.</p>
            <div className="relative mt-2">
              <span className="absolute left-3 top-2.5 text-muted font-mono text-sm">$</span>
              <input
                type="number"
                min="10"
                step="50"
                value={totalBankroll}
                onChange={(e) => setTotalBankroll(Math.max(10, Number(e.target.value)))}
                className="w-full bg-panel border border-line rounded-lg pl-7 pr-3 py-2 text-base font-mono font-bold text-ink focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="bg-obsidian border border-line/80 rounded-xl p-4 space-y-1.5">
            <label className="block text-xs font-bold text-ink">Base Unit Size ($)</label>
            <p className="text-[11px] text-muted">Standard 1.0u reference stake (typically 1% - 3% of bankroll).</p>
            <div className="relative mt-2">
              <span className="absolute left-3 top-2.5 text-muted font-mono text-sm">$</span>
              <input
                type="number"
                min="1"
                step="5"
                value={baseUnitSize}
                onChange={(e) => setBaseUnitSize(Math.max(1, Number(e.target.value)))}
                className="w-full bg-panel border border-line rounded-lg pl-7 pr-3 py-2 text-base font-mono font-bold text-ink focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Live Kelly Sizing Preview Table */}
        <div className="border border-line/80 rounded-xl bg-obsidian p-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-muted border-b border-line/50 pb-2">
            <span>LIVE KELLY SIZING PREVIEW (BASED ON YOUR ${totalBankroll} BANKROLL)</span>
            <span className="text-primary font-mono">{RISK_PROFILES[riskMode].label} Mode</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-panel border border-line/60 rounded-lg p-3">
              <div className="text-[11px] text-muted flex items-center gap-1">
                <Target className="size-3 text-blue-400" /> Standard +3% Edge
              </div>
              <div className="text-lg font-mono font-bold text-emerald-400 mt-1">
                {preview3Pct.formatted}
              </div>
              <div className="text-[10px] text-muted mt-0.5">High-probability straight bet</div>
            </div>

            <div className="bg-panel border border-line/60 rounded-lg p-3">
              <div className="text-[11px] text-muted flex items-center gap-1">
                <Flame className="size-3 text-amber-400" /> High-Conviction +5% Edge
              </div>
              <div className="text-lg font-mono font-bold text-emerald-400 mt-1">
                {preview5Pct.formatted}
              </div>
              <div className="text-[10px] text-muted mt-0.5">5-Star Gold Ticket alert</div>
            </div>

            <div className="bg-panel border border-line/60 rounded-lg p-3">
              <div className="text-[11px] text-muted flex items-center gap-1">
                <Zap className="size-3 text-purple-400" /> +200 SGP Value Parlay
              </div>
              <div className="text-lg font-mono font-bold text-emerald-400 mt-1">
                {previewHeavySgp.formatted}
              </div>
              <div className="text-[10px] text-muted mt-0.5">Variance-controlled parlay sizing</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── RISK PROFILE MODE ── */}
      <section className="bg-panel border border-line rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-line/60 pb-3">
          <Sliders className="size-5 text-primary" />
          <div>
            <h3 className="text-base font-display font-bold text-ink">Risk Profile & Kelly Fraction</h3>
            <p className="text-xs text-muted">
              Select your algorithmic risk appetite. Governs fractional Kelly multipliers, leg caps, and minimum edge cutoffs.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(["conservative", "balanced", "aggressive"] as RiskProfileMode[]).map((modeKey) => {
            const conf = RISK_PROFILES[modeKey];
            const isSelected = riskMode === modeKey;
            return (
              <button
                key={modeKey}
                type="button"
                onClick={() => setRiskMode(modeKey)}
                className={cn(
                  "p-4 rounded-xl border text-left transition-all cursor-pointer relative",
                  isSelected
                    ? "bg-primary/10 border-primary shadow-sm ring-1 ring-primary/40"
                    : "bg-obsidian border-line hover:border-line-hover opacity-80 hover:opacity-100"
                )}
              >
                {isSelected && (
                  <CheckCircle2 className="size-4 text-primary absolute top-3 right-3" />
                )}
                <div className="text-sm font-display font-bold text-ink flex items-center gap-1.5">
                  {conf.label}
                </div>
                <div className="text-xs text-emerald-400 font-mono font-semibold mt-1">
                  {conf.kellyMultiplier * 100}% Kelly • Max {conf.maxLegs} Legs
                </div>
                <p className="text-[11px] text-muted mt-2 leading-relaxed">
                  {conf.description}
                </p>
                <div className="mt-3 pt-2 border-t border-line/40 text-[10px] font-mono text-muted">
                  Min Edge: <span className="text-ink font-bold">+{conf.minEdgePct}%</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── ACTIVE SPORTSBOOKS ── */}
      <section className="bg-panel border border-line rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-line/60 pb-3">
          <Shield className="size-5 text-blue-400" />
          <div>
            <h3 className="text-base font-display font-bold text-ink">Active Sportsbook Accounts</h3>
            <p className="text-xs text-muted">
              SportsLock automatically filters and shops lines only across books where you hold active accounts.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {AVAILABLE_BOOKS.map((b) => {
            const isActive = activeBooks.has(b.id);
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => toggleBook(b.id)}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1",
                  isActive
                    ? "bg-blue-500/10 border-blue-500/40 text-ink shadow-sm"
                    : "bg-obsidian border-line opacity-50 hover:opacity-80"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold truncate">{b.name}</span>
                  {isActive && <span className="size-2 rounded-full bg-blue-400" />}
                </div>
                <span className="text-[9px] font-mono uppercase text-muted tracking-tight">
                  {b.tag}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── NOTIFICATION PREFERENCES ── */}
      <section className="bg-panel border border-line rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-line/60 pb-3">
          <Bell className="size-5 text-amber-400" />
          <div>
            <h3 className="text-base font-display font-bold text-ink">Automated Notification Alerts</h3>
            <p className="text-xs text-muted">
              Get notified the second sharp value enters the market or active slips reach optimal hedge spots.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-start gap-3 bg-obsidian border border-line/80 rounded-xl p-3.5 cursor-pointer hover:border-line-hover transition-colors">
            <input
              type="checkbox"
              checked={notifs.steamAlerts}
              onChange={(e) => setNotifs({ ...notifs, steamAlerts: e.target.checked })}
              className="mt-1 size-4 accent-primary rounded cursor-pointer"
            />
            <div>
              <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                ⚡ Steam & Reverse Line Movement
              </span>
              <p className="text-[11px] text-muted mt-0.5 leading-snug">
                Alerts when sharp money drives 1.5+ point spread shifts before retail books adjust.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 bg-obsidian border border-line/80 rounded-xl p-3.5 cursor-pointer hover:border-line-hover transition-colors">
            <input
              type="checkbox"
              checked={notifs.goldDropAlerts}
              onChange={(e) => setNotifs({ ...notifs, goldDropAlerts: e.target.checked })}
              className="mt-1 size-4 accent-primary rounded cursor-pointer"
            />
            <div>
              <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                ★ 5-Star Gold Ticket Drops
              </span>
              <p className="text-[11px] text-muted mt-0.5 leading-snug">
                Instant notification when the AI awards the highest quant badge on upcoming slates.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 bg-obsidian border border-line/80 rounded-xl p-3.5 cursor-pointer hover:border-line-hover transition-colors">
            <input
              type="checkbox"
              checked={notifs.hedgeWarnings}
              onChange={(e) => setNotifs({ ...notifs, hedgeWarnings: e.target.checked })}
              className="mt-1 size-4 accent-primary rounded cursor-pointer"
            />
            <div>
              <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                🛡️ Live In-Play Hedge Warnings
              </span>
              <p className="text-[11px] text-muted mt-0.5 leading-snug">
                Optimal mathematical hedge calculations when an open parlay hits N-1 legs.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 bg-obsidian border border-line/80 rounded-xl p-3.5 cursor-pointer hover:border-line-hover transition-colors">
            <input
              type="checkbox"
              checked={notifs.dailyRecapAlerts}
              onChange={(e) => setNotifs({ ...notifs, dailyRecapAlerts: e.target.checked })}
              className="mt-1 size-4 accent-primary rounded cursor-pointer"
            />
            <div>
              <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                📊 Daily Settlement & P&L Recaps
              </span>
              <p className="text-[11px] text-muted mt-0.5 leading-snug">
                Evening recap of all settled tickets, verified ROI, and bankroll progression.
              </p>
            </div>
          </label>
        </div>
      </section>

      {/* ── ACTION BUTTON BAR ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <div className="text-xs text-muted flex items-center gap-1.5">
          {savedSuccess && (
            <span className="text-emerald-400 font-bold flex items-center gap-1 animate-in fade-in">
              <CheckCircle2 className="size-4" /> Preferences saved and synced across app!
            </span>
          )}
        </div>

        <button
          type="button"
          disabled={saveProfileMut.isPending}
          onClick={() => saveProfileMut.mutate()}
          className="w-full sm:w-auto px-8 py-3 bg-primary text-black font-display font-bold rounded-xl shadow-apex-glow hover:bg-primary/90 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {saveProfileMut.isPending ? "Saving..." : "Save Preferences"}
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
