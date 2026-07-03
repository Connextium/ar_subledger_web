import type { AuthSession } from "@/lib/auth/session-types";
import { authApi } from "@/lib/api-client/v1/auth";

type AuthChangeCallback = (event: string, session: AuthSession | null) => void;
type SessionResult = { data: { session: AuthSession | null }; error: null };

async function getConfiguredSession(): Promise<SessionResult> {
  const payload = await authApi.getSession().catch(() => ({ session: null as AuthSession | null }));
  const session = (payload as { session?: AuthSession | null }).session ?? null;
  return { data: { session }, error: null };
}

const apiBackedSupabase = {
  auth: {
    async getSession(): Promise<SessionResult> {
      return getConfiguredSession();
    },
    onAuthStateChange(callback: AuthChangeCallback) {
      void getConfiguredSession().then(({ data }) => callback("INITIAL_SESSION", data.session));
      return { data: { subscription: { unsubscribe() {} } } };
    },
    async signInWithPassword(credentials: { email: string; password: string }) {
      const payload = await authApi.login(credentials.email, credentials.password);
      return { data: { session: (payload.session ?? null) as AuthSession | null }, error: null };
    },
    async signUp(credentials: { email: string; password: string }) {
      const payload = await authApi.register(credentials.email, credentials.password);
      return { data: { session: (payload.session ?? null) as AuthSession | null }, error: null };
    },
    async signOut() {
      await authApi.logout();
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
};

export const supabase: any = apiBackedSupabase;
