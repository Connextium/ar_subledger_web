export type SettlementRouteRecord = {
  pubkey: string;
  facilitator: string;
  buyerAuthority: string;
  supplierAuthority: string;
  buyerApLedger: string;
  supplierArLedger: string;
  buyerAccountingLedger: string;
  supplierAccountingLedger: string;
  routeCode: string;
  documentCount: number;
  nextSettlementSeq: number;
  active: boolean;
};

export type SettlementDocumentRecord = {
  pubkey: string;
  route: string;
  invoiceNo: string;
  documentHash: string;
  currency: string;
  originalAmount: number;
  openAmount: number;
  settledAmount: number;
  status: number;
};

export type SettlementExecutionRecord = {
  pubkey: string;
  route: string;
  document: string;
  settlementSeq: number;
  amount: number;
  buyerJournalEntryId: number;
  supplierJournalEntryId: number;
  buyerJournalEntry: string;
  supplierJournalEntry: string;
  memo: string;
  executedAt: number;
};