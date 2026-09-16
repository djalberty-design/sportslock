/**
 * The upstream identity providers this app offers for sign-in.
 *
 * Source of truth for BOTH the server (`server.ts`, one `genericOAuth` provider
 * per entry) and the client (`client.ts` / sign-in buttons). Kept in its own
 * dependency-free module so the client can import it without pulling the
 * server-only Better Auth instance (and `pg`) into the browser bundle.
 *
 * Each app federates to the shared auth broker (`AUTH_ISSUER`), which holds
 * the real Google/X secrets. The app never sees them — it only knows its own
 * per-app client id/secret and which upstream to ask the broker for (`idp`).
 */
export type AuthProvider = {
  /** This app's local provider id; also the callback path segment. */
  providerId: string;
  /** Upstream hint the broker forwards to (Better Auth social id). */
  idp: string;
  /** Human label for the sign-in button. */
  label: string;
};

/** @deprecated Use AuthProvider */
export type GrokProvider = AuthProvider;

export const AUTH_PROVIDERS: readonly AuthProvider[] = [
  { providerId: "sl-google", idp: "google", label: "Google" },
  
];

/** @deprecated Use AUTH_PROVIDERS */
export const GROK_PROVIDERS = AUTH_PROVIDERS;
