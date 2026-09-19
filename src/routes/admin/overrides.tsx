import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { cn } from "@/lib/utils";
import { Sliders, Trash2, Shield, AlertTriangle } from "lucide-react";

// Server functions
const listOverridesFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const { listOverrides } = await import("@/lib/market/overrides");
    return listOverrides();
  });

const clearOverrideFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { fingerprint: string }) => data)
  .handler(async ({ data }) => {
    const { clearOverride } = await import("@/lib/market/overrides");
    await clearOverride(data.fingerprint);
    return { ok: true };
  });

export const Route = createFileRoute("/admin/overrides")({ component: OverridesPage });

function OverridesPage() {
  const qc = useQueryClient();
  const { data: overrides, isLoading } = useQuery({
    queryKey: ["brain-overrides"],
    queryFn: () => listOverridesFn(),
    refetchInterval: 30_000,
  });

  const clearMut = useMutation({
    mutationFn: (fingerprint: string) => clearOverrideFn({ data: { fingerprint } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["brain-overrides"] }),
  });

  const rows = overrides ?? [];
  const sitOverrides = rows.filter((o) => o.sit);
  const haircutOverrides = rows.filter((o) => o.chanceHaircut > 0 && !o.sit);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-display text-2xl text-ink flex items-center gap-2">
          <Sliders className="size-6 text-primary" /> Active Overrides
        </h2>
        <p className="text-sm text-muted mt-1">
          Every active brain override affecting the engine. Clear any you disagree with.
        </p>
      </header>

      {isLoading && <p className="text-sm text-muted">Loading...</p>}

      {rows.length === 0 && !isLoading && (
        <div className="bg-wash rounded-xl p-8 text-center">
          <Shield className="size-8 text-muted mx-auto mb-2" />
          <p className="text-sm text-muted">No active overrides. The engine is running clean defaults.</p>
        </div>
      )}

      {/* Sit Overrides */}
      {sitOverrides.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
            <AlertTriangle className="size-3.5" /> Sit Overrides ({sitOverrides.length})
          </h3>
          <p className="text-[10px] text-muted">These markets are suppressed from AI Picks unless photographed from Hard Rock.</p>
          {sitOverrides.map((o) => (
            <div key={o.fingerprint} className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-ink">{o.sport}</span>
                  <span className="text-xs text-muted uppercase">{o.market}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-bold">SIT</span>
                </div>
                <p className="text-xs text-muted">{o.note}</p>
              </div>
              <button
                onClick={() => clearMut.mutate(o.fingerprint)}
                disabled={clearMut.isPending}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-line text-muted hover:bg-red-500/15 hover:text-red-400 transition-colors"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </section>
      )}

      {/* Haircut Overrides */}
      {haircutOverrides.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Sliders className="size-3.5" /> Probability Haircuts ({haircutOverrides.length})
          </h3>
          <p className="text-[10px] text-muted">These markets have their model probability reduced by the haircut amount.</p>
          {haircutOverrides.map((o) => (
            <div key={o.fingerprint} className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-ink">{o.sport}</span>
                  <span className="text-xs text-muted uppercase">{o.market}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold font-mono">
                    -{Math.round(o.chanceHaircut * 100)}%
                  </span>
                </div>
                <p className="text-xs text-muted">{o.note}</p>
              </div>
              <button
                onClick={() => clearMut.mutate(o.fingerprint)}
                disabled={clearMut.isPending}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-line text-muted hover:bg-red-500/15 hover:text-red-400 transition-colors"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </section>
      )}

      {/* Summary */}
      {rows.length > 0 && (
        <div className="bg-panel border border-line rounded-lg p-4 text-xs text-muted">
          <strong className="text-ink">{rows.length}</strong> active override{rows.length !== 1 ? "s" : ""} •
          <strong className="text-red-400 ml-1">{sitOverrides.length}</strong> sit •
          <strong className="text-amber-400 ml-1">{haircutOverrides.length}</strong> haircut
        </div>
      )}
    </div>
  );
}
