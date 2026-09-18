import { createFileRoute } from "@tanstack/react-router";
import { runMorningPull } from "@/lib/market/morning-pull";

export const Route = createFileRoute("/api/cron/morning-pull")({
  server: {
    handlers: {
      GET: async () => handleMorningPull(),
      POST: async () => handleMorningPull(),
    },
  },
});

async function handleMorningPull() {
  try {
    const result = await runMorningPull();
    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Morning pull failed:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
