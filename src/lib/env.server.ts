export function env(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

/**
 * Workspace preview vs deployed app.
 * Set SPORTSLOCK_DEPLOYED=1 in your Vercel project environment variables.
 * In local dev this is unset, so isWorkspacePreview() returns true.
 */
export function isWorkspacePreview(): boolean {
  return !env("GROK_PROJECT_ID") && !env("SPORTSLOCK_DEPLOYED");
}
