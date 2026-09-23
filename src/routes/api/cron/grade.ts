import { createFileRoute } from "@tanstack/react-router";
import { gradePredictionLogs } from "@/lib/market/grade-tape";

export const Route = createFileRoute("/api/cron/grade")({
  server: {
    handlers: {
      GET: async () => handleGrade(),
      POST: async () => handleGrade(),
    }
  }
});

async function handleGrade() {
  try {
    const result = await gradePredictionLogs();
    return new Response(JSON.stringify({ 
      success: true, 
      gradedCount: result.graded, 
      unmatched: result.unmatched,
      historical: result.historical
    }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Grading cron failed:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}