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
