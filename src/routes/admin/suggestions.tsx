import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lightbulb } from "lucide-react";
import { decideSuggestionFn, getSuggestionsFn } from "@/lib/market/tape-server";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/suggestions")({ component: SuggestionsDesk });

function SuggestionsDesk() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["brain-suggestions"],
    queryFn: () => getSuggestionsFn(),
  });
  const decide = useMutation({
    mutationFn: (opts: { id: string; status: "accepted" | "rejected" | "later" }) => decideSuggestionFn({ data: opts }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brain-suggestions"] }),
  });

  const rows = data ?? [];
  const pending = rows.filter((r) => r.status === "pending" || r.status === "later");
  const closed = rows.filter((r) => r.status === "accepted" || r.status === "rejected");

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2 text-ink">
        <Lightbulb className="size-5 text-primary" />
        Brain suggestions
      </h2>
      <p className="text-sm text-muted">
        Built from graded tape counts. Accept records your call. It does not rewrite the engine yet (H5).
      </p>

      {isLoading ? (
        <div className="text-center p-12 text-muted">Building suggestions...</div>
      ) : pending.length === 0 && closed.length === 0 ? (
        <div className="text-center p-12 text-muted border border-dashed border-line rounded-xl">
          <p className="font-medium text-ink">No suggestions yet</p>
          <p className="text-sm mt-1">Open Live Status so finals can grade, then come back.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {pending.map((row) => (
              <article key={row.id} className="bg-obsidian rounded-xl border border-line p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-bold text-ink text-sm">{row.title}</h3>
                  <span className="text-[10px] uppercase tracking-wide text-amber-400 font-bold">{row.status}</span>
                </div>
                <p className="text-sm text-muted leading-relaxed">{row.body}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ id: row.id, status: "accepted" })}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-400"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ id: row.id, status: "later" })}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-line/60 text-ink"
                  >
                    Later
                  </button>
                  <button
                    type="button"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ id: row.id, status: "rejected" })}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/15 text-red-400"
                  >
                    Reject
                  </button>
                </div>
              </article>
            ))}
          </div>

          {closed.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Decided</h3>
              {closed.map((row) => (
                <div key={row.id} className="text-sm border border-line rounded-lg px-3 py-2 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-ink">{row.title}</div>
                    <div className="text-xs text-muted mt-0.5">{row.body}</div>
                  </div>
                  <span className={cn("text-[10px] uppercase font-bold", row.status === "accepted" ? "text-emerald-400" : "text-red-400")}>
                    {row.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
