export type AppRole = "admin" | "accountant" | "viewer";

export type Workspace = {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
};

export type WorkspaceMember = {
  workspaceId: string;
  userId: string;
  role: AppRole;
};

export type WorkspaceLedgerLink = {
  id: string;
  workspaceId: string;
  ledgerPda: string;
  ledgerCode: string;
  authorityPubkey: string;
  onchainLedgerKey?: string | null;
  status: "active" | "inactive";
  createdAt: string;
};

export type WorkspaceCustomerStatus = "active" | "inactive" | "archived";

export type WorkspaceCustomer = {
  id: string;
  workspaceId: string;
  customerRef: string;
  legalName: string;
  taxId: string | null;
  status: WorkspaceCustomerStatus;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceCustomerCodeStatus = "reserved" | "released";

export type WorkspaceCustomerCodeRegistryEntry = {
  id: string;
  workspaceId: string;
  customerCode: string;
  workspaceCustomerId: string;
  status: WorkspaceCustomerCodeStatus;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceCustomerLedgerLinkStatus = "active" | "inactive";

export type WorkspaceCustomerLedgerLink = {
  id: string;
  workspaceId: string;
  workspaceCustomerId: string;
  ledgerPda: string;
  onchainCustomerPubkey: string;
  customerCode: string;
  status: WorkspaceCustomerLedgerLinkStatus;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceBuyerLedgerLinkStatus = "active" | "inactive";

export type WorkspaceBuyerLedgerLink = {
  id: string;
  workspaceId: string;
  ledgerPda: string;
  ledgerCode: string;
  authorityPubkey: string;
  accountingLedgerKey: string;
  status: WorkspaceBuyerLedgerLinkStatus;
  createdAt: string;
};

export type WorkspaceVendorStatus = "active" | "inactive" | "archived";

export type WorkspaceVendor = {
  id: string;
  workspaceId: string;
  vendorRef: string;
  legalName: string;
  taxId: string | null;
  status: WorkspaceVendorStatus;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceVendorLedgerLinkStatus = "active" | "inactive";

export type WorkspaceVendorLedgerLink = {
  id: string;
  workspaceId: string;
  workspaceVendorId: string;
  ledgerPda: string;
  onchainVendorPubkey: string;
  vendorCode: string;
  status: WorkspaceVendorLedgerLinkStatus;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceSettlementRoute = {
  id: string;
  workspaceId: string;
  routePda: string;
  routeCode: string;
  buyerLedgerPda: string;
  supplierLedgerPda: string;
  status: "active" | "inactive";
  createdAt: string;
};

export type WorkspaceSettlementDocument = {
  id: string;
  workspaceId: string;
  routePda: string;
  documentPda: string;
  invoiceNo: string;
  status: "open" | "partially_settled" | "settled" | "cancelled";
  createdAt: string;
};

export type WorkspaceSettlementExecution = {
  id: string;
  workspaceId: string;
  routePda: string;
  executionPda: string;
  documentPda: string;
  amount: number;
  createdAt: string;
};