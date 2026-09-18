import { createFileRoute } from "@tanstack/react-router";

/**
 * Test endpoint: visit /api/auth-callback-test to check if the auth
 * callback route pattern works on Vercel. If you see this JSON, the route
 * matching is working properly for /api/auth/* paths.
 */
export const Route = createFileRoute("/api/auth-callback-test")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return new Response(
          JSON.stringify({
            ok: true,
            message: "Route matching works for /api/auth/* paths",
            url: request.url,
            timestamp: new Date().toISOString(),
          }, null, 2),
          { headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
