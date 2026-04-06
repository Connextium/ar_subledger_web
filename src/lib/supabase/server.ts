import "server-only";

import { createClient } from "@supabase/supabase-js";
import { assertServerSupabaseEnv, serverEnv } from "@/lib/config/server-env";

export function createSupabaseServerClient() {
  assertServerSupabaseEnv();

  return createClient(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
