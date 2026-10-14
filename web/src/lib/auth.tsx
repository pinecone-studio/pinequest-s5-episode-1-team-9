"use client";

import { useAuth as useClerkAuth } from "@clerk/nextjs";
import type { UserDTO } from "@linguamatch/shared";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { ApiError, api, serverStatusStore, setTokenGetter } from "./api";
import { disconnectSocket } from "./socket";

interface AuthContextValue {
  /** The app profile (username, languages, privacy). Null when signed out. */
  user: UserDTO | null;
  loading: boolean;
  setUser: (user: UserDTO | null) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, userId, getToken, signOut } = useClerkAuth();
  const [user, setUser] = useState<UserDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTokenGetter((opts) => getToken(opts));
  }, [getToken]);

  /**
   * Loads the app profile for the Clerk session (the server creates it on first sign-in).
   * If the API can't be reached we stay in the loading state and try again, so nobody is
   * sent to /login just because the server is asleep.
   */
  const loadProfile = useCallback(
    async (isCurrent: () => boolean = () => true) => {
      for (let delay = 5000; isCurrent(); delay = Math.min(delay * 2, 30_000)) {
        try {
          const { user } = await api.me();
          if (isCurrent()) setUser(user);
          break;
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            // Clerk session without a usable account (e.g. it was deleted): end the session.
            if (isCurrent()) setUser(null);
            await signOut();
            break;
          }
          console.error("[auth] couldn't load your profile:", err);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
      if (isCurrent()) setLoading(false);
    },
    [signOut],
  );

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      disconnectSocket();
      setUser(null);
      setLoading(false);
      return;
    }
    let current = true;
    setLoading(true);
    void loadProfile(() => current);
    return () => {
      current = false;
    };
  }, [isLoaded, isSignedIn, userId, loadProfile]);

  const refresh = useCallback(() => loadProfile(), [loadProfile]);

  const logout = useCallback(async () => {
    disconnectSocket();
    await signOut();
    setUser(null);
  }, [signOut]);

  return (
    <AuthContext.Provider value={{ user, loading, setUser, refresh, logout }}>
      <ServerWakeBanner />
      {children}
    </AuthContext.Provider>
  );
}

/** Shown while API requests are being retried because the server is asleep or restarting. */
function ServerWakeBanner() {
  const status = useSyncExternalStore(serverStatusStore.subscribe, serverStatusStore.get, () => "ok" as const);
  if (status !== "waking") return null;
  return (
    <div role="status" className="bg-primary text-primary-foreground fixed inset-x-0 top-0 z-50 px-4 py-2 text-center text-sm">
      Waking up the server, this can take up to a minute...
    </div>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/**
 * Client-side route guard. Redirects to /login when signed out and to /onboarding when
 * the profile is incomplete. Returns the user once it's safe to render.
 */
export function useRequireUser({ onboarded = true }: { onboarded?: boolean } = {}): UserDTO | null {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    // Clerk's sign-in sends the user back to `redirect_url` afterwards.
    if (!user) router.replace(`/login?redirect_url=${encodeURIComponent(pathname)}`);
    else if (onboarded && !user.onboarded) router.replace("/onboarding");
  }, [loading, user, onboarded, router, pathname]);

  if (loading || !user || (onboarded && !user.onboarded)) return null;
  return user;
}
