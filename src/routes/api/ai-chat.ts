import { createFileRoute } from "@tanstack/react-router";
import { executeAgentChat, type AgentChatResult } from "@/lib/market/ai-analyst";

export const Route = createFileRoute("/api/ai-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => handleAiChat(request),
    },
  },
});

async function handleAiChat(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}));
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!message) {
      return new Response(
        JSON.stringify({ ok: false, error: "Prompt message is required." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const history = Array.isArray(body.history) ? body.history : [];
    const context = body.context || {};

    const result: AgentChatResult = await executeAgentChat(message, history, context);

    return new Response(
      JSON.stringify({ ok: true, ...result }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("[api/ai-chat] Error processing request:", err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Agent processing failed: " + (err?.message || String(err)),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
