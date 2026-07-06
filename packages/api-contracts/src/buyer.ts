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