import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase as configuredSupabase } from "@/lib/supabase/client";

type AuthChangeCallback = (event: string, session: Session | null) => void;

const LOCAL_SESSION_KEY = "ar:local-auth:session";

function readLocalSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(LOCAL_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { id: string; email: string };
    return { user: { id: parsed.id, email: parsed.email } as User } as Session;
  } catch {
    return null;
  }
}

const localSupabase = {
  auth: {
    async getSession() {
      return { data: { session: readLocalSession() }, error: null };
    },
    onAuthStateChange(callback: AuthChangeCallback) {
      callback("INITIAL_SESSION", readLocalSession());
      return { data: { subscription: { unsubscribe() {} } } };
    },
    async signInWithPassword(..._args: unknown[]) {
      return { data: { session: readLocalSession() }, error: null };
    },
    async signUp(..._args: unknown[]) {
      return { data: { session: readLocalSession() }, error: null };
    },
    async signOut() {
      if (typeof window !== "undefined") window.localStorage.removeItem(LOCAL_SESSION_KEY);
      return { error: null };
    },
  },
  from(..._args: unknown[]) {
    const builder = {
      select(..._args: unknown[]) {
        return builder;
      },
      insert(..._args: unknown[]) {
        return builder;
      },
      update(..._args: unknown[]) {
        return builder;
      },
      delete(..._args: unknown[]) {
        return builder;
      },
      eq(..._args: unknown[]) {
        return builder;
      },
      order(..._args: unknown[]) {
        return builder;
      },
      maybeSingle() {
        return Promise.resolve({ data: null, error: null });
      },
      single() {
        return Promise.resolve({ data: null, error: null });
      },
      then(resolve: (value: { data: never[]; error: null }) => void) {
        return Promise.resolve({ data: [], error: null }).then(resolve);
      },
    };
    return builder;
  },
} as unknown as typeof configuredSupabase;

export const supabase = isSupabaseConfigured ? configuredSupabase : localSupabase;
