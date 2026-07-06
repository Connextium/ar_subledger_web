export type AccountingLedger = {
  pubkey?: string;
  authority?: string;
  ledgerCode?: string;
  nextJournalEntryId?: number;
};

export type GlAccount = {
  code: number;
  name: string;
  category: string;
};

export type PostingLine = {
  id: string;
  journalEntryId: number;
  accountCode: number;
  direction: "debit" | "credit";
  amount: number;
  memo?: string;
};

export type JournalEntry = {
  id: number;
  ledgerPubkey: string;
  memo: string;
  createdAt: string;
};