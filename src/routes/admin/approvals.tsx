import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listAccessRequests, decideAccessRequest, listAllowlist, addAllowlistEmail, revokeAllowlistEmail } from "@/lib/desk-api";
import { OWNER_ADMIN_EMAIL } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { UserCheck, UserX, Clock, Shield, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/approvals")({ component: ApprovalsPage });

function ApprovalsPage() {
  const qc = useQueryClient();
  const reqs = useQuery({ queryKey: ["access-requests"], queryFn: () => listAccessRequests(), staleTime: 10_000 });
  const list = useQuery({ queryKey: ["allowlist"], queryFn: () => listAllowlist(), staleTime: 10_000 });
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");

  const pending = (reqs.data ?? []).filter((r) => r.status === "pending");
  const decided = (reqs.data ?? []).filter((r) => r.status !== "pending");

  async function addUser() {
    setNote("");
    try {
      const rows = await addAllowlistEmail({ data: { email: draft, role: "user" } });
      qc.setQueryData(["allowlist"], rows);
      setDraft("");
      setNote("User approved.");
      void qc.invalidateQueries({ queryKey: ["access-requests"] });
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not add that email.");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-display text-2xl text-ink flex items-center gap-2">
          <UserCheck className="size-6 text-emerald-500" /> Access Control
        </h2>
        <p className="text-sm text-muted mt-1">
          Approve or deny access requests. Manage the allowlist.
        </p>
      </header>

      {/* Pending Requests */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
          <Clock className="size-3.5" /> Pending Requests ({pending.length})
        </h3>
        {pending.length === 0 && (
          <p className="text-sm text-muted bg-wash rounded-lg p-4">No pending access requests.</p>
        )}
        {pending.map((r) => (
          <div key={r.id} className="bg-wash rounded-lg p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-ink">{r.email}</p>
              <p className="text-xs text-muted">{r.name || "No name"} • Requested access</p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  void decideAccessRequest({ data: { email: r.email, approve: true } }).then((rows) => {
                    qc.setQueryData(["access-requests"], rows);
                    void qc.invalidateQueries({ queryKey: ["allowlist"] });
                  });
                }}
                className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30"
              >
                <UserCheck className="size-3.5 mr-1" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void decideAccessRequest({ data: { email: r.email, approve: false } }).then((rows) => {
                    qc.setQueryData(["access-requests"], rows);
                  });
                }}
                className="text-red-400 border-red-500/30 hover:bg-red-500/10"
              >
                <UserX className="size-3.5 mr-1" /> Deny
              </Button>
            </div>
          </div>
        ))}
      </section>

      {/* Add User Manually */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
          <Plus className="size-3.5" /> Add User Manually
        </h3>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void addUser();
          }}
        >
          <Input
            type="email"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="user@email.com"
            className="max-w-md"
          />
          <Button type="submit">Add</Button>
        </form>
        {note && <p className="text-sm text-muted">{note}</p>}
      </section>

      {/* Approved Users */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
          <Shield className="size-3.5" /> Approved Users ({(list.data ?? []).length})
        </h3>
        <div className="divide-y divide-line rounded-lg border border-line overflow-hidden">
          {(list.data ?? []).map((row) => (
            <div key={row.email} className="flex items-center justify-between px-4 py-3 bg-panel">
              <div>
                <span className="text-sm text-ink font-medium">{row.email}</span>
                <span className={cn("ml-2 text-[10px] uppercase tracking-wider font-bold",
                  row.role === "admin" ? "text-primary" : "text-emerald-500"
                )}>
                  {row.role}
                </span>
              </div>
              {row.email === OWNER_ADMIN_EMAIL ? (
                <span className="text-xs text-muted">Super admin</span>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-400 hover:bg-red-500/10"
                  onClick={() => {
                    void revokeAllowlistEmail({ data: { email: row.email } }).then((rows) => {
                      qc.setQueryData(["allowlist"], rows);
                      void qc.invalidateQueries({ queryKey: ["access-requests"] });
                    });
                  }}
                >
                  Revoke
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Decided History */}
      {decided.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted">History</h3>
          <div className="space-y-1">
            {decided.map((r) => (
              <div key={r.id} className="text-xs flex justify-between items-center px-3 py-2 rounded bg-wash">
                <span className="text-ink">{r.email}</span>
                <span className={cn("font-bold uppercase",
                  r.status === "approved" ? "text-emerald-400" : "text-red-400"
                )}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
