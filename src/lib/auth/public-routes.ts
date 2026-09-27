/** Phase 2 guest-readable surfaces. Everything else stays behind sign-in. */
export const GUEST_READABLE_PATHS = ["/", "/results"] as const;

export function normalizePathname(pathname: string): string {
  if (!pathname) return "/";
  const trimmed = pathname.split("?")[0].split("#")[0] || "/";
  if (trimmed.length > 1 && trimmed.endsWith("/")) return trimmed.slice(0, -1);
  return trimmed;
}

export function isGuestReadablePath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  if (path === "/") return true;
  return path === "/results" || path.startsWith("/results/");
}

export function requiresSignIn(pathname: string): boolean {
  const path = normalizePathname(pathname);
  if (path === "/login" || path.startsWith("/api/")) return false;
  return !isGuestReadablePath(path);
}
