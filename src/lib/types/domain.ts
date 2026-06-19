export type AppRole = "admin" | "accountant" | "viewer";

export type LedgerRecord = {
  pubkey: string;
  authority: string;
  ledgerCode: string;
  accountingLedger: string;
  arControlAccountCode: number;
  revenueAccountCode: number;
  cashAccountCode: number;
  writeoffExpenseAccountCode: number;
  nextJournalEntryId: number;
  customerCount: number;
  invoiceCount: number;
};

export type CustomerRecord = {
  pubkey: string;
  ledger: string;
  customerCode: string;
  customerName: string;
  status: number;
  creditLimit: number;
  totalOutstanding: number;
  totalInvoiced: number;
  totalPaid: number;
  totalCredited: number;
  totalWrittenOff: number;
  invoiceCount: number;
};

export type InvoiceRecord = {
  pubkey: string;
  ledger: string;
  customer: string;
  invoiceNo: string;
  originalAmount: number;
  openAmount: number;
  paidAmount: number;
  creditedAmount: number;
  writtenOffAmount: number;
  currency: string;
  description: string;
  issueDate: number;
  dueDate: number;
  status: number;
  receiptSeq: number;
  creditSeq: number;
  journalEntryId: number;
  hasWriteoff: boolean;
};

export type ReceiptRecord = {
  pubkey: string;
  invoice: string;
  receiptSeq: number;
  receiptNo: string;
  amount: number;
  receiptDate: number;
  paymentReference: string;
  journalEntryId: number;
};

export type CreditNoteRecord = {
  pubkey: string;
  invoice: string;
  creditSeq: number;
  creditNo: string;
  amount: number;
  creditDate: number;
  reason: string;
  journalEntryId: number;
};

export type WriteOffRecord = {
  pubkey: string;
  invoice: string;
  amount: number;
  writeoffDate: number;
  reason: string;
  journalEntryId: number;
};

export type BuyerLedgerRecord = {
  pubkey: string;
  authority: string;
  ledgerCode: string;
  accountingLedger: string;
  apControlAccountCode: number;
  purchaseAccountCode: number;
  cashAccountCode: number;
  nextJournalEntryId: number;
  vendorCount: number;
  invoiceCount: number;
};

export type VendorRecord = {
  pubkey: string;
  ledger: string;
  vendorCode: string;
  vendorName: string;
  status: number;
  totalOpenPayable: number;
  totalInvoiced: number;
  totalPaid: number;
  invoiceCount: number;
};

export type VendorInvoiceRecord = {
  pubkey: string;
  ledger: string;
  vendor: string;
  invoiceNo: string;
  originalAmount: number;
  openAmount: number;
  paidAmount: number;
  adjustedAmount: number;
  currency: string;
  description: string;
  documentHash: string;
  invoiceDate: number;
  dueDate: number;
  status: number;
  paymentSeq: number;
  journalEntryId: number;
};

export type VendorPaymentRecord = {
  pubkey: string;
  invoice: string;
  paymentSeq: number;
  paymentNo: string;
  amount: number;
  paymentDate: number;
  paymentReference: string;
  journalEntryId: number;
};

export type ActivityItem = {
  id: string;
  type:
    | "customer_created"
    | "invoice_issued"
    | "receipt_recorded"
    | "credit_note_issued"
    | "invoice_written_off"
    | "invoice_closed";
  ledger?: string;
  customer?: string;
  invoice?: string;
  amount?: number;
  documentNo?: string;
  occurredAt: number;
  details: string;
};

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

export type WorkspaceBuyerLedgerLink = {
  id: string;
  workspaceId: string;
  ledgerPda: string;
  ledgerCode: string;
  authorityPubkey: string;
  accountingLedgerKey: string | null;
  status: "active" | "inactive";
  createdAt: string;
};

export type WorkspaceVendorLedgerLink = {
  id: string;
  workspaceId: string;
  workspaceVendorId: string;
  ledgerPda: string;
  onchainVendorPubkey: string;
  vendorCode: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
};

export const INVOICE_STATUS_LABEL: Record<number, string> = {
  1: "Open",
  2: "Partially Paid",
  3: "Paid",
  4: "Credited",
  5: "Written Off",
  6: "Closed",
};

export const CUSTOMER_STATUS_LABEL: Record<number, string> = {
  1: "Active",
  2: "Suspended",
  3: "Closed",
};
