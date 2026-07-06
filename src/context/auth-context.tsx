"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AuthSession, AuthUser } from "@/lib/auth/session-types";
import { authApi } from "@/lib/api-client/v1/auth";
import { RELOGIN_REQUIRED_EVENT } from "@/lib/auth/relogin-warning";

type AuthContextValue = {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  reloginWarning: string | null;
  dismissReloginWarning: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloginWarning, setReloginWarning] = useState<string | null>(null);

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

    const handleReloginRequired = (event: Event) => {
      const customEvent = event as CustomEvent<{ reason?: string } | undefined>;
      setReloginWarning(customEvent.detail?.reason ?? "Session or API key expired. Please re-login.");
      setLoading(false);
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
      reloginWarning,
      dismissReloginWarning() {
        setReloginWarning(null);
      },
      async signIn(email, password) {
        const { session: nextSession } = await authApi.login(email, password);
        setReloginWarning(null);
        setSession(nextSession ?? null);
      },
      async signUp(email, password) {
        const { session: nextSession } = await authApi.register(email, password);
        setReloginWarning(null);
        setSession(nextSession ?? null);
      },
      async signOut() {
        await authApi.logout();
        setReloginWarning(null);
        setSession(null);
      },
    }),
    [loading, reloginWarning, session],
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
