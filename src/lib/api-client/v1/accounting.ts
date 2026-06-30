import type {
  AccountingLedger as RealAccountingLedger,
  AccountingLedgerDiscoveryDebug,
  GlAccount,
  JournalEntry,
  PostingDelegateStatus,
  PostingLine,
} from "@/services/accounting-engine-service";

export type {
  AccountingLedgerDiscoveryDebug,
  GlAccount,
  JournalEntry,
  PostingDelegateStatus,
  PostingLine,
};

export type AccountingLedger = RealAccountingLedger & {
  pubkey?: string;
  authority?: string;
  ledgerCode?: string;
  nextJournalEntryId?: number;
};

export { accountingEngineService } from "@/services/accounting-engine-service";
