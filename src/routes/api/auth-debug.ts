import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

/**
 * Debug endpoint to check auth session state.
 * Visit /api/auth-debug in the browser to see if your session cookie is being read.
 */
export const Route = createFileRoute("/api/auth-debug")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const cookies = request.headers.get("cookie") ?? "(no cookies)";
        const sessionCookiePresent = cookies.includes("__Host-grok-auth.session_token");

        let sessionResult: unknown = null;
        let sessionError: string | null = null;
        try {
          const session = await auth.api.getSession({ headers: request.headers });
          sessionResult = session
            ? { userId: session.user?.id, email: session.user?.email, name: session.user?.name }
            : null;
        } catch (e) {
          sessionError = e instanceof Error ? e.message : String(e);
        }

        const debug = {
          timestamp: new Date().toISOString(),
          authConfigured: Boolean(process.env.GOOGLE_CLIENT_ID),
          betterAuthUrl: process.env.BETTER_AUTH_URL ?? "(not set)",
          betterAuthSecretSet: Boolean(process.env.BETTER_AUTH_SECRET),
          viteAuthEnabled: process.env.VITE_AUTH_ENABLED ?? "(not set)",
          sessionCookiePresent,
          cookieHeader: cookies.substring(0, 200) + (cookies.length > 200 ? "..." : ""),
          session: sessionResult,
          sessionError,
        };

        return new Response(JSON.stringify(debug, null, 2), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
