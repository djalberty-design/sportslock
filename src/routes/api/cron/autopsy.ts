import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

export const Route = createFileRoute("/api/cron/autopsy")({
  server: {
    handlers: {
      GET: async () => handleAutopsy(),
      POST: async () => handleAutopsy(),
    }
  }
});

async function callLLM(prompt: string): Promise<string> {
  const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  if (!apiKey) {
    return "[ERROR] XAI_API_KEY environment variable is missing.";
  }

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-3-mini-fast",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return `[LLM ERROR] ${res.status}: ${errText}`;
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "[No response]";
  } catch (err) {
    console.error("LLM Generation Failed:", err);
    return `[LLM ERROR] - ${(err as Error).message}`;
  }
}

async function handleAutopsy() {
  const sql = await getSql();

  const unexplainedLosses = await sql`
    SELECT * FROM prediction_logs 
    WHERE status = 'LOSS' AND ai_autopsy IS NULL 
    LIMIT 5
  `;

  let autopsyCount = 0;
  for (const log of unexplainedLosses) {
    try {
      const prompt = `You are a sharp quantitative sports bettor. We lost this prediction.
Analyze the pre-game mathematical snapshot vs. the final ESPN box score results.
Classify this loss as either 'HIGH VARIANCE' (bad luck, right math) or 'MODEL ERROR' (mispriced odds, wrong math).
Provide a 2-sentence breakdown of why.

--- PRE-GAME SNAPSHOT ---
${JSON.stringify(log.snapshot, null, 2)}

--- FINAL BOX SCORE ---
${JSON.stringify(log.actual_result, null, 2)}

Prediction Details:
Selection: ${log.selection}
Market: ${log.market_type}
Line: ${log.line}
Price: ${log.price}
Model Probability: ${log.model_probability}
Edge: ${log.edge}
`;

      const llmResponse = await callLLM(prompt);

      await sql`
        UPDATE prediction_logs
        SET ai_autopsy = ${llmResponse},
            updated_at = now()
        WHERE id = ${log.id}
      `;
      
      autopsyCount++;
    } catch (e) {
      console.error(`Failed to complete autopsy for log ${log.id}`, e);
    }
  }

  return new Response(JSON.stringify({ success: true, autopsyCount }), {
    headers: { 'Content-Type': 'application/json' }
  });
}