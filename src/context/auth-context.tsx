"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { env } from "@/lib/config/env";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const MOCK_EMAIL = "localnet@embedded.wallet";
const LOCAL_USERS_KEY = "ar:local-auth:users";
const LOCAL_SESSION_KEY = "ar:local-auth:session";

type LocalAuthUser = {
  id: string;
  email: string;
  password: string;
};

function readLocalUsers(): LocalAuthUser[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(LOCAL_USERS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as LocalAuthUser[];
  } catch {
    return [];
  }
}

function writeLocalUsers(users: LocalAuthUser[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

function readLocalSessionUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(LOCAL_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { id: string; email: string };
    return { id: parsed.id, email: parsed.email } as User;
  } catch {
    return null;
  }
}

function writeLocalSessionUser(user: User | null): void {
  if (typeof window === "undefined") return;
  if (!user) {
    window.localStorage.removeItem(LOCAL_SESSION_KEY);
    return;
  }
  window.localStorage.setItem(
    LOCAL_SESSION_KEY,
    JSON.stringify({ id: user.id, email: user.email ?? MOCK_EMAIL }),
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!env.supabaseUrl || !env.supabaseAnonKey) {
      const localUser = readLocalSessionUser();
      if (localUser) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSession({ user: localUser } as Session);
      } else {
        setSession(null);
      }
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      async signIn(email, password) {
        if (!env.supabaseUrl || !env.supabaseAnonKey) {
          const users = readLocalUsers();
          const existing = users.find(
            (candidate) => candidate.email.toLowerCase() === email.toLowerCase().trim(),
          );
          if (!existing || existing.password !== password) {
            throw new Error("Invalid email or password.");
          }
          const user = { id: existing.id, email: existing.email } as User;
          writeLocalSessionUser(user);
          setSession({ user } as Session);
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      async signUp(email, password) {
        if (!env.supabaseUrl || !env.supabaseAnonKey) {
          const users = readLocalUsers();
          const normalizedEmail = email.toLowerCase().trim();
          if (users.some((candidate) => candidate.email.toLowerCase() === normalizedEmail)) {
            throw new Error("Email already registered.");
          }
          const userRecord: LocalAuthUser = {
            id: crypto.randomUUID(),
            email: normalizedEmail,
            password,
          };
          users.push(userRecord);
          writeLocalUsers(users);
          const user = { id: userRecord.id, email: userRecord.email } as User;
          writeLocalSessionUser(user);
          setSession({ user } as Session);
          return;
        }
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      },
      async signOut() {
        if (!env.supabaseUrl || !env.supabaseAnonKey) {
          writeLocalSessionUser(null);
          setSession(null);
          return;
        }
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
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
