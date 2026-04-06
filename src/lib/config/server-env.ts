import "server-only";

export const serverEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  walletEncryptionKey: process.env.WALLET_ENCRYPTION_KEY ?? "",
  walletEncryptionKeyVersion: process.env.WALLET_ENCRYPTION_KEY_VERSION ?? "v1",
  solanaRpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "http://127.0.0.1:8899",
};

export function assertServerSupabaseEnv(): void {
  if (!serverEnv.supabaseUrl || !serverEnv.supabaseServiceRoleKey) {
    throw new Error(
      "Missing server Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
}

export function assertWalletEncryptionEnv(): void {
  if (!serverEnv.walletEncryptionKey) {
    throw new Error(
      "Missing WALLET_ENCRYPTION_KEY. Phase B wallet service requires app-level encryption secret.",
    );
  }
}
