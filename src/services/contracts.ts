import type {
  ActivityItem,
  CreditNoteRecord,
  CustomerRecord,
  InvoiceRecord,
  LedgerRecord,
  ReceiptRecord,
  WriteOffRecord,
} from "@/lib/types/domain";

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

export type IssueInvoiceInput = {
  ledgerPubkey: string;
  customerPubkey: string;
  invoiceNo: string;
  amountMinor: number;
  issueDateUnix: number;
  dueDateUnix: number;
  currency: string;
  description: string;
};

export type RecordReceiptInput = {
  ledgerPubkey: string;
  customerPubkey: string;
  invoicePubkey: string;
  receiptSeq: number;
  receiptNo: string;
  amountMinor: number;
  receiptDateUnix: number;
  paymentReference: string;
};

export type IssueCreditNoteInput = {
  ledgerPubkey: string;
  customerPubkey: string;
  invoicePubkey: string;
  creditSeq: number;
  creditNo: string;
  amountMinor: number;
  creditDateUnix: number;
  reason: string;
};

export type WriteOffInvoiceInput = {
  ledgerPubkey: string;
  customerPubkey: string;
  invoicePubkey: string;
  amountMinor: number;
  writeoffDateUnix: number;
  reason: string;
};

export type CloseInvoiceInput = {
  ledgerPubkey: string;
  customerPubkey: string;
  invoicePubkey: string;
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
