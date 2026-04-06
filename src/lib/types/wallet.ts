export type WalletSource = "registration_init" | "rotate" | "function_generated";

export type WalletUsage =
  | "main_operational"
  | "registration_seed"
  | "transaction_signer"
  | "workspace_bootstrap"
  | "ledger_initialize"
  | "customer_initialize"
  | "invoice_issue"
  | "settlement_record"
  | "emergency_fallback";

export type WalletStatus = "active" | "disabled" | "archived";

export type WorkspaceWallet = {
  id: string;
  workspaceId: string;
  chain: string;
  publicKey: string;
  keyProvider: "app_managed" | "db_vault" | "aws_kms" | "gcp_kms" | "azure_kv";
  encryptionKeyId: string;
  keyVersion: string;
  cryptoAlg: string;
  source: WalletSource;
  usage: WalletUsage;
  referenceType: string | null;
  referenceId: string | null;
  isMain: boolean;
  status: WalletStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  latestBalanceLamports?: number | null;
  latestBalanceObservedAt?: string | null;
};

export type CreateWalletPayload = {
  workspaceId: string;
  actorUserId: string;
  publicKey: string;
  privateKey: string;
  chain?: string;
  source: WalletSource;
  usage: WalletUsage;
  referenceType?: string | null;
  referenceId?: string | null;
  setAsMain?: boolean;
};

export type WalletBalanceSnapshot = {
  walletId: string;
  lamports: number;
  rpcEndpoint: string;
  observedAt: string;
};
