export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  solanaRpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "http://127.0.0.1:8899",
  programId:
    process.env.NEXT_PUBLIC_AR_SUBLEDGER_PROGRAM_ID ??
    "3jRx3EYaVqU6LizE3d9od4Luim9NABWTFUvNe6E68xRg",
};

export function assertRequiredEnv(): void {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    console.warn(
      "Supabase env vars missing. Auth and control-plane features will be unavailable until configured.",
    );
  }
}
