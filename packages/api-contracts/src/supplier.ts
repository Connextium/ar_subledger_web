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