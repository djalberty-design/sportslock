import { createFileRoute } from "@tanstack/react-router";
import { runMorningPull } from "@/lib/market/morning-pull";

export const Route = createFileRoute("/api/cron/morning-pull")({
  server: {
    handlers: {
      GET: async ({ request }) => handleMorningPull(request),
      POST: async ({ request }) => handleMorningPull(request),
    },
  },
});

async function handleMorningPull(request?: Request) {
  try {
    const url = request ? new URL(request.url) : null;
    const force = url?.searchParams.get("force") === "true";
    const result = await runMorningPull(force);
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
