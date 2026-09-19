export function mlbHalf(raw?: string | null): string {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return "";
  if (/^top|t$/.test(s) || s.startsWith("top")) return "Top";
  if (/^bot|bottom/.test(s)) return "Bot";
  if (/^mid|middle/.test(s)) return "Mid";
  if (/^end/.test(s)) return "End";
  return "";
}

export function mlbInningLabel(raw?: string | number | null): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (/(st|nd|rd|th)$/i.test(s)) return s;
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  const mod = n % 100;
  const suf = mod >= 11 && mod <= 13 ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th";
  return `${n}${suf}`;
}

export function formatLivePeriod(opts: {
  sport?: string | null;
  period?: string | number | null;
  clock?: string | null;
  statusText?: string | null;
}): string {
  const sport = String(opts.sport || "").toUpperCase();
  const status = String(opts.statusText || "").trim();
  const period = opts.period != null && String(opts.period).trim() ? String(opts.period).trim() : "";
  const clock = String(opts.clock || "").trim();
  if (sport === "MLB") {
    const half = mlbHalf(clock) || mlbHalf(status);
    const inn = mlbInningLabel(period) || mlbInningLabel(status.replace(/^(top|bot|bottom|mid|middle|end)\s+/i, ""));
    if (half && inn) return `${half} ${inn}`;
    if (/\b(top|bot|mid|end)\b/i.test(status) && /\d/.test(status)) {
      const h = mlbHalf(status);
      const i = mlbInningLabel(status.replace(/[^0-9]/g, ""));
      if (h && i) return `${h} ${i}`;
    }
    if (status && /inning|top|bot|mid|end/i.test(status)) return status;
    if (inn) return `Inning ${inn}`;
    return status || clock;
  }
  if (sport === "NFL" || sport === "NCAAF" || sport === "NBA" || sport === "NCAAB") {
    if (status && /q|quarter|half|ot/i.test(status)) return status;
    const q = period ? (/^q/i.test(period) ? period : `Q${period}`) : "";
    return [q, clock && !/^q/i.test(clock) ? clock : ""].filter(Boolean).join(" ");
  }
  if (sport === "NHL") {
    if (status && /p|period|ot/i.test(status)) return status;
    const per = period ? (/^p/i.test(period) ? period : `P${period}`) : "";
    return [per, clock].filter(Boolean).join(" ");
  }
  return status || [period, clock].filter(Boolean).join(" ");
}
