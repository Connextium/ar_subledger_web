import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/config/env";

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);

export const supabase = createClient(
  env.supabaseUrl || "https://placeholder.supabase.co",
  env.supabaseAnonKey || "public-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);

export const supabaseAuthEnabled = isSupabaseConfigured;
export const supabaseControlPlaneEnabled = isSupabaseConfigured;

export const supabaseOptions = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
};
