"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AuthSession, AuthUser } from "@/lib/auth/session-types";
import { authApi } from "@/lib/api-client/v1/auth";
import { RELOGIN_REQUIRED_EVENT } from "@/lib/auth/relogin-warning";

type AuthContextValue = {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi
      .getSession()
      .then(({ session: nextSession }) => {
        setSession(nextSession ?? null);
      })
      .finally(() => setLoading(false));

    return;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleReloginRequired = () => {
      setSession(null);
      setLoading(false);

      if (window.location.pathname !== "/login") {
        window.location.replace("/login?reason=reauth");
      }
    };

    window.addEventListener(RELOGIN_REQUIRED_EVENT, handleReloginRequired as EventListener);
    return () => {
      window.removeEventListener(RELOGIN_REQUIRED_EVENT, handleReloginRequired as EventListener);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      async signIn(email, password) {
        const { session: nextSession } = await authApi.login(email, password);
        setSession(nextSession ?? null);
      },
      async signUp(email, password) {
        const { session: nextSession } = await authApi.register(email, password);
        setSession(nextSession ?? null);
      },
      async signOut() {
        await authApi.logout();
        setSession(null);
      },
    }),
    [loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
