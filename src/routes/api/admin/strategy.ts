import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { isAdminEmail, normalizeEmail } from "@/lib/admin";

export const Route = createFileRoute("/api/admin/strategy")({
  server: {
    handlers: {
      GET: async ({ request }) => handleStrategyReport(request),
    }
  }
});

async function verifyAdmin(request: Request) {
  const { auth } = await import("@/lib/auth/server");
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.email) throw new Error("Unauthorized");
  const email = normalizeEmail(session.user.email);
  if (!isAdminEmail(email)) {
    const sql = await getSql();
    const listed = await sql<{ role: string }>`SELECT role FROM desk_allowlist WHERE email = ${email} LIMIT 1`;
    if (listed[0]?.role !== "admin") throw new Error("Forbidden");
  }
}

async function handleStrategyReport(request: Request) {
  try {
    await verifyAdmin(request);
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ report: "[ERROR] GEMINI_API_KEY environment variable is missing." }), { status: 500 });
    }

    const sql = await getSql();
    const logs = await sql`SELECT * FROM prediction_logs WHERE status != 'PENDING' ORDER BY created_at DESC`;

    if (!logs || logs.length === 0) {
      return new Response(JSON.stringify({ report: "Not enough graded predictions to generate a strategy report." }));
    }

    let cumulativeProfit = 0;
    let wins = 0;
    const marketStats: Record<string, { wins: number, total: number }> = {};
    const autopsies: string[] = [];

    for (const log of logs) {
      if (log.status === 'WIN') {
        wins++;
        cumulativeProfit += log.price < 0 ? (100 / Math.abs(log.price)) : (log.price / 100);
      } else if (log.status === 'LOSS') {
        cumulativeProfit -= 1;
        if (log.ai_autopsy && autopsies.length < 10) {
          autopsies.push(log.ai_autopsy);
        }
      }

      if (log.status === 'WIN' || log.status === 'LOSS') {
        const mType = log.market_type || 'unknown';
        if (!marketStats[mType]) marketStats[mType] = { wins: 0, total: 0 };
        marketStats[mType].total++;
        if (log.status === 'WIN') marketStats[mType].wins++;
      }
    }

    const totalGraded = logs.filter((l: any) => l.status === 'WIN' || l.status === 'LOSS').length;
    const overallWinRate = totalGraded > 0 ? ((wins / totalGraded) * 100).toFixed(1) : "0.0";
    
    const marketWinRates = Object.entries(marketStats)
      .map(([mType, stats]) => `${mType.toUpperCase()}: ${((stats.wins / stats.total) * 100).toFixed(1)}% (${stats.wins}/${stats.total})`)
      .join('\n');

    const prompt = `You are the Chief Risk Officer for a quantitative sports betting syndicate. 
Analyze this aggregate portfolio data and recent autopsy reports. 
Provide a concise, brutal 3-paragraph strategy report formatted using Markdown: 
1. Macro Performance Summary, 
2. Algorithmic Leaks (where are we losing money?), 
3. Actionable Adjustments (what should we change?).

--- PORTFOLIO METRICS ---
Total Graded Bets: ${totalGraded}
Overall Win Rate: ${overallWinRate}%
Total ROI (Units): ${cumulativeProfit.toFixed(2)}U

--- MARKET EFFICIENCY ---
${marketWinRates}

--- RECENT LOSS AUTOPSIES (LAST 10) ---
${autopsies.map(a => "- " + a).join('\n')}
`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    
    return new Response(JSON.stringify({ report: result.response.text() }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error("Strategy Report Failed:", err);
    return new Response(JSON.stringify({ report: `[LLM ERROR] - ${(err as Error).message}` }), { status: 500 });
  }
}