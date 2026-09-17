import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { HOW_IT_WORKS, MORE_LINKS } from "@/lib/plain-words";
import { cn } from "@/lib/utils";
import { useAccess } from "@/lib/use-access";
import { UserButton } from "@/lib/auth/gates";
import { DESK_VERSION } from "@/lib/market/rules";

/**
 * Full-screen slide-down More drawer on mobile (large tap targets).
 * Desktop keeps a compact panel under the header button.
 * Portaled to document.body so header backdrop-filter cannot trap `fixed`.
 */
export function MobileMoreDrawer() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin } = useAccess();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const overlay =
    open && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-50">
            <button
              type="button"
              className="absolute inset-0 bg-navy-deep/70"
              aria-label="Close More"
              onClick={() => setOpen(false)}
            />
            <div
              id="more-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="more-panel-title"
              className="drawer-down fixed inset-0 flex h-dvh w-full flex-col overflow-y-auto bg-card p-5 shadow-[var(--shadow-stamp)] md:inset-auto md:right-4 md:top-16 md:h-auto md:max-h-[85dvh] md:w-[26rem] md:rounded-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="more-panel-title" className="font-display text-2xl text-ink">
                    More
                  </h2>
                  <p className="mt-1 text-xs text-muted">Desk {DESK_VERSION}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="grid size-11 shrink-0 place-items-center rounded-md text-muted transition-transform duration-150 ease-out hover:bg-wash hover:text-ink active:scale-[0.96]"
                  aria-label="Close"
                >
                  <X className="size-4" strokeWidth={1.75} />
                </button>
              </div>

              <div className="mt-4 sm:hidden">
                <UserButton />
              </div>

              <ol className="mt-4 grid gap-2">
                {HOW_IT_WORKS.map((s) => (
                  <li key={s.n} className="rounded-md bg-wash px-3 py-3">
                    <p className="stamp text-emerald-500">{s.n}</p>
                    <p className="mt-1 text-sm font-medium text-ink">{s.title}</p>
                    <p className="text-xs text-muted">{s.body}</p>
                  </li>
                ))}
              </ol>

              <ul className="mt-4 space-y-1 pb-8">
                {MORE_LINKS.filter((item) => item.to !== "/admin" || isAdmin).map((item) => (
                  <li key={item.label}>
                    <Link
                      to={item.to}
                      hash={item.hash || undefined}
                      onClick={() => setOpen(false)}
                      className="flex min-h-12 items-center justify-between gap-3 rounded-md px-3 py-3 hover:bg-wash"
                    >
                      <span>
                        <span className="block text-sm font-medium text-ink">{item.label}</span>
                        <span className="block text-xs text-muted">{item.note}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-transform duration-150 ease-out active:scale-[0.96]",
          open || pathname === "/more" ? "bg-emerald-500 text-zinc-950" : "text-muted hover:bg-wash hover:text-ink",
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="more-panel"
        aria-label="More"
      >
        <Menu className="size-4" strokeWidth={1.75} />
        <span className="hidden sm:inline">More</span>
      </button>
      {overlay}
    </div>
  );
}

/** @deprecated Use MobileMoreDrawer */
export const MoreMenu = MobileMoreDrawer;
