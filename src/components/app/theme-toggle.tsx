import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type ThemeMode = "dark" | "light";

interface ThemeStore {
  mode: ThemeMode;
  toggle: () => void;
  set: (m: ThemeMode) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      mode: "dark",
      toggle: () => set((s) => ({ mode: s.mode === "dark" ? "light" : "dark" })),
      set: (m) => set({ mode: m }),
    }),
    { name: "sportslock-theme" },
  ),
);

/** Mount this once to sync the class on <html>. */
export function ThemeSync() {
  const mode = useThemeStore((s) => s.mode);
  useEffect(() => {
    const root = document.documentElement;
    if (mode === "light") {
      root.classList.add("light");
      root.classList.remove("dark");
    } else {
      root.classList.add("dark");
      root.classList.remove("light");
    }
  }, [mode]);
  return null;
}

/** Toggle button for sidebar / header. */
export function ThemeToggle({ className }: { className?: string }) {
  const { mode, toggle } = useThemeStore();
  return (
    <button
      onClick={toggle}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors text-muted hover:bg-line/50 hover:text-ink",
        className,
      )}
      title={`Switch to ${mode === "dark" ? "light" : "dark"} mode`}
    >
      {mode === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      <span className="font-medium">{mode === "dark" ? "Light Mode" : "Dark Mode"}</span>
    </button>
  );
}
