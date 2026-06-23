import type {
  ActivityItem,
  CreditNoteRecord,
  CustomerRecord,
  InvoiceRecord,
  LedgerRecord,
  ReceiptRecord,
  WriteOffRecord,
  BuyerLedgerRecord,
  VendorInvoiceRecord,
  VendorPaymentRecord,
  VendorRecord,
  SettlementDocumentRecord,
  SettlementExecutionRecord,
  SettlementRouteRecord,
} from "@/lib/types/domain";

export type TransactionSubmissionHooks = {
  onSubmitted?: (signature: string) => void;
};

export type InitializeLedgerInput = {
  ledgerCode: string;
  accountingLedgerPubkey: string;
  arControlAccountCode: number;
  revenueAccountCode: number;
  cashAccountCode: number;
  writeoffExpenseAccountCode: number;
};

export type CreateCustomerInput = {
  ledgerPubkey: string;
  customerCode: string;
  customerName: string;
  creditLimitMinor: number;
};

export type UpdateCustomerInput = {
  ledgerPubkey: string;
  customerPubkey: string;
  status: number;
  creditLimitMinor: number;
};

export type IssueInvoiceInput = TransactionSubmissionHooks & {
  ledgerPubkey: string;
  customerPubkey: string;
  invoiceNo: string;
  amountMinor: number;
  issueDateUnix: number;
  dueDateUnix: number;
  currency: string;
  description: string;
};

export type RecordReceiptInput = TransactionSubmissionHooks & {
  ledgerPubkey: string;
  customerPubkey: string;
  invoicePubkey: string;
  receiptSeq: number;
  receiptNo: string;
  amountMinor: number;
  receiptDateUnix: number;
  paymentReference: string;
};

export type IssueCreditNoteInput = TransactionSubmissionHooks & {
  ledgerPubkey: string;
  customerPubkey: string;
  invoicePubkey: string;
  creditSeq: number;
  creditNo: string;
  amountMinor: number;
  creditDateUnix: number;
  reason: string;
};

export type WriteOffInvoiceInput = TransactionSubmissionHooks & {
  ledgerPubkey: string;
  customerPubkey: string;
  invoicePubkey: string;
  amountMinor: number;
  writeoffDateUnix: number;
  reason: string;
};

export type CloseInvoiceInput = TransactionSubmissionHooks & {
  ledgerPubkey: string;
  customerPubkey: string;
  invoicePubkey: string;
};

export type InitializeBuyerLedgerInput = {
  ledgerCode: string;
  accountingLedgerPubkey: string;
  apControlAccountCode: number;
  purchaseAccountCode: number;
  cashAccountCode: number;
};

export type CreateVendorInput = {
  ledgerPubkey: string;
  vendorCode: string;
  vendorName: string;
};

export type ReceiveVendorInvoiceInput = TransactionSubmissionHooks & {
  ledgerPubkey: string;
  vendorPubkey: string;
  invoiceNo: string;
  amountMinor: number;
  invoiceDateUnix: number;
  dueDateUnix: number;
  currency: string;
  description: string;
  documentHash: string;
};

export type PayVendorInvoiceInput = TransactionSubmissionHooks & {
  ledgerPubkey: string;
  vendorPubkey: string;
  invoicePubkey: string;
  paymentSeq: number;
  paymentNo: string;
  amountMinor: number;
  paymentDateUnix: number;
  paymentReference: string;
};

export type InitializeSettlementRouteInput = TransactionSubmissionHooks & {
  routeCode: string;
  buyerApLedgerPubkey: string;
  supplierArLedgerPubkey: string;
};

export type RegisterSettlementDocumentInput = TransactionSubmissionHooks & {
  routePubkey: string;
  invoiceNo: string;
  documentHash: string;
  currency: string;
  originalAmount: number;
};

export type CancelSettlementDocumentInput = TransactionSubmissionHooks & {
  routePubkey: string;
  documentPubkey: string;
};

export type ExecuteSettlementInput = TransactionSubmissionHooks & {
  routePubkey: string;
  documentPubkey: string;
  settlementSeq: number;
  amountMinor: number;
  memo: string;
};

export interface LedgerService {
  initializeLedger(input: InitializeLedgerInput): Promise<string>;
  listLedgers(): Promise<LedgerRecord[]>;
  getLedger(pubkey: string): Promise<LedgerRecord | null>;
}

export interface CustomerService {
  createCustomer(input: CreateCustomerInput): Promise<string>;
  updateCustomer(input: UpdateCustomerInput): Promise<string>;
  listCustomers(ledgerPubkey?: string): Promise<CustomerRecord[]>;
  getCustomer(pubkey: string): Promise<CustomerRecord | null>;
}

export interface InvoiceService {
  issueInvoice(input: IssueInvoiceInput): Promise<string>;
  closeInvoice(input: CloseInvoiceInput): Promise<string>;
  listInvoices(ledgerPubkey?: string): Promise<InvoiceRecord[]>;
  getInvoice(pubkey: string): Promise<InvoiceRecord | null>;
}

export interface SettlementService {
  recordReceipt(input: RecordReceiptInput): Promise<string>;
  issueCreditNote(input: IssueCreditNoteInput): Promise<string>;
  writeOffInvoice(input: WriteOffInvoiceInput): Promise<string>;
  listReceipts(invoicePubkey?: string): Promise<ReceiptRecord[]>;
  listCreditNotes(invoicePubkey?: string): Promise<CreditNoteRecord[]>;
  listWriteOffs(invoicePubkey?: string): Promise<WriteOffRecord[]>;
  listActivity(): Promise<ActivityItem[]>;
}

export interface ApSubledgerService {
  initializeBuyerLedger(input: InitializeBuyerLedgerInput): Promise<string>;
  createVendor(input: CreateVendorInput): Promise<string>;
  receiveVendorInvoice(input: ReceiveVendorInvoiceInput): Promise<string>;
  payVendorInvoice(input: PayVendorInvoiceInput): Promise<string>;
  listBuyerLedgers(): Promise<BuyerLedgerRecord[]>;
  listVendors(ledgerPubkey?: string): Promise<VendorRecord[]>;
  getVendorInvoice(pubkey: string): Promise<VendorInvoiceRecord | null>;
  listVendorInvoices(ledgerPubkey?: string): Promise<VendorInvoiceRecord[]>;
  listVendorPayments(invoicePubkey?: string): Promise<VendorPaymentRecord[]>;
}

export interface SettlementFacilitatorService {
  initializeRoute(input: InitializeSettlementRouteInput): Promise<string>;
  getRoute(pubkey: string): Promise<SettlementRouteRecord | null>;
  registerDocument(input: RegisterSettlementDocumentInput): Promise<string>;
  getDocument(pubkey: string): Promise<SettlementDocumentRecord | null>;
  cancelDocument(input: CancelSettlementDocumentInput): Promise<string>;
  executeSettlement(input: ExecuteSettlementInput): Promise<string>;
  listRoutes(): Promise<SettlementRouteRecord[]>;
  listDocuments(routePubkey?: string): Promise<SettlementDocumentRecord[]>;
  getExecution(pubkey: string): Promise<SettlementExecutionRecord | null>;
  listExecutions(documentPubkey?: string): Promise<SettlementExecutionRecord[]>;
}
