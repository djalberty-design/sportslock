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
        const sessionCookiePresent = cookies.includes("sportslock.session_token");

        let sessionResult: unknown = null;
        let sessionError: string | null = null;
        try {
          const session = await auth.api.getSession({ headers: request.headers });
          sessionResult = session
            ? { userId: session.user?.id, email: session.user?.email, name: session.user?.name }
            : null;
        } catch (e) {
          sessionError = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
        }

        // Also try listing users to check if any exist in the database
        let userCount = 0;
        let userListError: string | null = null;
        try {
          const users = await auth.api.listUsers({ query: { limit: 5 }, headers: request.headers });
          userCount = users?.users?.length ?? 0;
        } catch (e) {
          userListError = e instanceof Error ? e.message : String(e);
        }

        const debug = {
          timestamp: new Date().toISOString(),
          authConfigured: Boolean(process.env.GOOGLE_CLIENT_ID),
          betterAuthUrl: process.env.BETTER_AUTH_URL ?? "(not set)",
          betterAuthSecretSet: Boolean(process.env.BETTER_AUTH_SECRET),
          viteAuthEnabled: process.env.VITE_AUTH_ENABLED ?? "(not set)",
          googleClientIdSet: Boolean(process.env.GOOGLE_CLIENT_ID),
          googleClientSecretSet: Boolean(process.env.GOOGLE_CLIENT_SECRET),
          sessionCookiePresent,
          allCookies: cookies.substring(0, 500),
          session: sessionResult,
          sessionError,
          usersInDb: userCount,
          userListError,
          hint: !sessionCookiePresent
            ? "Session cookie not found. Try: 1) Clear all cookies for sportslock.app, 2) Sign up with email/password first at /login, 3) Check Google OAuth redirect URI is https://sportslock.app/api/auth/callback/google in Google Cloud Console"
            : "Session cookie found - checking session validity",
        };

        return new Response(JSON.stringify(debug, null, 2), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
