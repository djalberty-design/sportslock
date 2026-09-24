import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function floorToCent(n: number): number {
  return Math.floor(n * 100 + Number.EPSILON) / 100;
}

export function formatUsd(n: number, digits = 2): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function formatPct(n: number, digits = 1): string {
  const pct = n * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(digits)}%`;
}

export function formatAmerican(odds: number): string {
  if (!Number.isFinite(odds)) return "—";
  return odds >= 0 ? `+${Math.round(odds)}` : `${Math.round(odds)}`;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function etParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    weekday: get("weekday"),
    etDate: `${get("year")}-${get("month")}-${get("day")}`,
    etStamp: `${get("hour")}:${get("minute")}`,
  };
}

export function isTodayEt(iso: string, now = new Date()): boolean {
  if (!iso) return false;
  const t = new Date(iso);
  if (!Number.isFinite(t.getTime())) return false;
  return etParts(t).etDate === etParts(now).etDate;
}

export function startOfEtWeekMonday(etDate: string): string {
  const [y, m, d] = etDate.split("-").map(Number);
  const utc = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  const dow = utc.getUTCDay(); // 0 Sun
  const offset = dow === 0 ? 6 : dow - 1;
  utc.setUTCDate(utc.getUTCDate() - offset);
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(utc.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** "Monday, Sep 8 · 8:20 p.m. ET" — Florida/Eastern. Compact: "Mon 8:20 p.m. ET". */
export function formatKickoff(iso: string, compact = false): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const weekday = d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: compact ? "short" : "long",
  });
  const date = d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
  });
  const time = d
    .toLocaleString("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace("AM", "a.m.")
    .replace("PM", "p.m.");
  return compact ? `${weekday} ${date} · ${time} ET` : `${weekday}, ${date} · ${time} ET`;
}

export function matchupLine(away: string, home: string): string {
  if (!away && !home) return "";
  return `${away} (away) at ${home} (home)`;
}

/** Format time strictly in Eastern Time (America/New_York): e.g. "7:00 PM ET" */
export function formatEasternTime(input?: string | number | Date | null): string {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (!Number.isFinite(d.getTime())) return "";
  const time = d.toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${time} ET`;
}

/** Format short date strictly in Eastern Time (America/New_York): e.g. "Sep 24" */
export function formatEasternDate(input?: string | number | Date | null): string {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
  });
}

/** Format short game start strictly in Eastern Time: e.g. "Today 8:15 PM ET" or "Thu 8:15 PM ET" */
export function formatEasternShort(input?: string | number | Date | null, now = new Date()): string {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (!Number.isFinite(d.getTime())) return "";
  const isToday = isTodayEt(d.toISOString(), now);
  const time = d.toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  if (isToday) {
    return `Today ${time} ET`;
  }
  const day = d.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  });
  return `${day} ${time} ET`;
}

/** Format full date & time strictly in Eastern Time: e.g. "Thu, Sep 24, 7:00 PM ET" */
export function formatEasternDateTime(input?: string | number | Date | null): string {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (!Number.isFinite(d.getTime())) return "";
  const dateStr = d.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeStr = d.toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${dateStr}, ${timeStr} ET`;
}

export type QuotaBreakdown = {
  quota: number | null;
  propsAvail: number;
  activeSports: number;
  activeSportNames: string[];
  daysLeft: number;
  reservedForDaily: number;
  resetLabel: string;
  monthlyPropsBudget: number;
};

/** Formulate available player prop pulls based on active sports and remaining month days in Eastern Time */
export function getEasternQuotaBreakdown(quota: number | null, now = new Date()): QuotaBreakdown | null {
  if (quota == null) return null;
  const parts = etParts(now);
  const month = parseInt(parts.month, 10);
  const day = parseInt(parts.day, 10);
  const year = parseInt(parts.year, 10);

  const activeSportNames: string[] = [];
  if (month >= 9 || month <= 2) activeSportNames.push("NFL");
  if (month >= 8 || month <= 1) activeSportNames.push("NCAAF");
  if (month >= 3 && month <= 11) activeSportNames.push("MLB");
  if (month >= 10 || month <= 6) activeSportNames.push("NBA");
  if (month >= 10 || month <= 6) activeSportNames.push("NHL");
  if (month >= 11 || month <= 4) activeSportNames.push("NCAAB");

  const activeSports = activeSportNames.length;
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - day + 1);
  const reservedForDaily = daysLeft * activeSports;
  const propsAvail = Math.max(0, quota - reservedForDaily);
  const monthlyPropsBudget = Math.max(0, 500 - (daysInMonth * activeSports));

  const resetDate = new Date(year, month, 1);
  const resetLabel = resetDate.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
  });

  return {
    quota,
    propsAvail,
    activeSports,
    activeSportNames,
    daysLeft,
    reservedForDaily,
    resetLabel,
    monthlyPropsBudget,
  };
}

