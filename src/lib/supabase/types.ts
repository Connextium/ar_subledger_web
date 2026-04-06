import type { AppRole } from "@/lib/types/domain";

export type WorkspaceRow = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
};

export type WorkspaceMemberRow = {
  workspace_id: string;
  user_id: string;
  role: AppRole;
};

export type LedgerRow = {
  id: string;
  workspace_id: string;
  ledger_pda: string;
  ledger_code: string;
  authority_pubkey: string;
  status?: "active" | "inactive";
  created_at: string;
};

export type WalletKeypairRow = {
  id: string;
  workspace_id: string;
  chain: string;
  public_key: string;
  encrypted_private_key: string;
  key_provider: "app_managed" | "db_vault" | "aws_kms" | "gcp_kms" | "azure_kv";
  encryption_key_id: string;
  key_version: string;
  encrypted_dek: string | null;
  crypto_alg: string;
  nonce_or_iv: string;
  auth_tag: string | null;
  source: "registration_init" | "rotate" | "function_generated";
  usage:
    | "main_operational"
    | "registration_seed"
    | "transaction_signer"
    | "workspace_bootstrap"
    | "ledger_initialize"
    | "customer_initialize"
    | "invoice_issue"
    | "settlement_record"
    | "emergency_fallback";
  reference_type: string | null;
  reference_id: string | null;
  is_main: boolean;
  status: "active" | "disabled" | "archived";
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type WalletBalanceSnapshotRow = {
  id: string;
  wallet_id: string;
  lamports: number;
  rpc_endpoint: string;
  observed_at: string;
  created_at: string;
};

export type WorkspaceCustomerRow = {
  id: string;
  workspace_id: string;
  customer_ref: string;
  legal_name: string;
  tax_id: string | null;
  status: "active" | "inactive" | "archived";
  created_at: string;
  updated_at: string;
};

export type WorkspaceCustomerCodeRegistryRow = {
  id: string;
  workspace_id: string;
  customer_code: string;
  workspace_customer_id: string;
  status: "reserved" | "released";
  created_at: string;
  updated_at: string;
};

export type WorkspaceCustomerLedgerLinkRow = {
  id: string;
  workspace_id: string;
  workspace_customer_id: string;
  ledger_pda: string;
  onchain_customer_pubkey: string;
  customer_code: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
};
