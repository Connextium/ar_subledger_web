import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase as configuredSupabase } from "@/lib/supabase/client";

type AuthChangeCallback = (event: string, session: Session | null) => void;
type ConfiguredSessionResult = Awaited<ReturnType<typeof configuredSupabase.auth.getSession>>;

const LOCAL_SESSION_KEY = "ar:local-auth:session";
const INVALID_REFRESH_TOKEN_MESSAGES = ["Invalid Refresh Token", "Refresh Token Not Found"];

function isInvalidRefreshTokenError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String(error.message)
        : String(error ?? "");

  return INVALID_REFRESH_TOKEN_MESSAGES.some((candidate) => message.includes(candidate));
}

async function clearInvalidRefreshTokenSession(error: unknown): Promise<boolean> {
  if (!isInvalidRefreshTokenError(error)) return false;

  await configuredSupabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  return true;
}

async function getConfiguredSession(): Promise<ConfiguredSessionResult> {
  try {
    const result = await configuredSupabase.auth.getSession();
    if (result.error && (await clearInvalidRefreshTokenSession(result.error))) {
      return { data: { session: null }, error: null };
    }
    return result;
  } catch (error) {
    if (await clearInvalidRefreshTokenSession(error)) {
      return { data: { session: null }, error: null };
    }
    throw error;
  }
}

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
    async signInWithPassword() {
      return { data: { session: readLocalSession() }, error: null };
    },
    async signUp() {
      return { data: { session: readLocalSession() }, error: null };
    },
    async signOut() {
      if (typeof window !== "undefined") window.localStorage.removeItem(LOCAL_SESSION_KEY);
      return { error: null };
    },
  },
  from() {
    const builder = {
      select() {
        return builder;
      },
      insert() {
        return builder;
      },
      update() {
        return builder;
      },
      delete() {
        return builder;
      },
      eq() {
        return builder;
      },
      order() {
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

const configuredAuth = new Proxy(configuredSupabase.auth, {
  get(target, property, receiver) {
    if (property === "getSession") return getConfiguredSession;
    const value = Reflect.get(target, property, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  },
}) as typeof configuredSupabase.auth;

const configuredSessionClient = new Proxy(configuredSupabase, {
  get(target, property, receiver) {
    if (property === "auth") return configuredAuth;
    const value = Reflect.get(target, property, receiver);
    return typeof value === "function" ? value.bind(receiver) : value;
  },
}) as typeof configuredSupabase;

export const supabase = isSupabaseConfigured ? configuredSessionClient : localSupabase;
