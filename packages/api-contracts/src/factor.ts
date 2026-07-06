export type EligibleInvoiceRecord = {
  invoicePubkey: string;
  ledgerPubkey: string;
  customerPubkey: string;
  invoiceNo: string;
  currency: string;
  openAmount: number;
  dueDate: number;
};

export type ListEligibleInvoicesResponse = {
  eligibleInvoices: EligibleInvoiceRecord[];
};