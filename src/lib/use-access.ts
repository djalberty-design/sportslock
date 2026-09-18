import { useQuery } from "@tanstack/react-query";
import { getAccess, type AccessState } from "@/lib/desk-api";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

/**
 * Required auth. No guest access. Unauthenticated → login wall.
 * Authenticated but not approved → "Access Pending".
 * Only djalberty@gmail.com is admin.
 */
export function useAccess() {
  const { user, isPending } = useCurrentUserState();
  const signedIn = Boolean(user && !user.isDevFallback);
  const q = useQuery({
    queryKey: ["access", user?.id],
    queryFn: () => getAccess(),
    enabled: signedIn,
    staleTime: 30_000,
    retry: 2,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
  });
  const access: AccessState | null = signedIn && q.data ? q.data : null;
  const isApproved = access?.status === "approved";
  return {
    user,
    sessionPending: isPending,
    accessPending: signedIn && q.isLoading,
    accessError: signedIn && q.isError,
    access,
    isAdmin: isApproved && access?.role === "admin",
    isApproved,
    signedIn,
    refetch: q.refetch,
  };
}
