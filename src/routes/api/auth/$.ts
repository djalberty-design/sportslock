import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          return await auth.handler(request);
        } catch (err: any) {
          console.error("[api/auth/$] GET error:", err);
          return new Response(JSON.stringify({ error: err?.message || "Auth handler error" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
      POST: async ({ request }) => {
        try {
          return await auth.handler(request);
        } catch (err: any) {
          console.error("[api/auth/$] POST error:", err);
          return new Response(JSON.stringify({ error: err?.message || "Auth handler error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
