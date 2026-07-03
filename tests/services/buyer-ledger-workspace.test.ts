import assert from "node:assert/strict";
import type {
  BuyerLedgerRecord,
  WorkspaceBuyerLedgerLink,
} from "@/lib/types/domain";
import { filterBuyerLedgersByWorkspaceLinks } from "@/lib/api-client/v1/buyer-ledger-workspace";

function ledger(pubkey: string, accountingLedger = `accounting-${pubkey}`): BuyerLedgerRecord {
  return {
    pubkey,
    authority: `authority-${pubkey}`,
    ledgerCode: `code-${pubkey}`,
    accountingLedger,
    apControlAccountCode: 2100,
    purchaseAccountCode: 5000,
    cashAccountCode: 1000,
    nextJournalEntryId: 1,
    vendorCount: 0,
    invoiceCount: 0,
  };
}

function link(ledgerPda: string, status: WorkspaceBuyerLedgerLink["status"]): WorkspaceBuyerLedgerLink {
  return {
    id: `link-${ledgerPda}`,
    workspaceId: "workspace-a",
    ledgerPda,
    ledgerCode: `code-${ledgerPda}`,
    authorityPubkey: `authority-${ledgerPda}`,
    accountingLedgerKey: `accounting-${ledgerPda}`,
    status,
    createdAt: "2026-06-20T00:00:00.000Z",
  };
}

const result = filterBuyerLedgersByWorkspaceLinks(
  [
    ledger("workspace-ledger"),
    ledger("other-workspace-ledger"),
    ledger("inactive-ledger"),
  ],
  [link("workspace-ledger", "active"), link("inactive-ledger", "inactive")],
);

assert.deepEqual(
  result.map((row) => row.pubkey),
  ["workspace-ledger"],
  "workspace Buyer Ledgers should include only active linked records in api-client boundary helper",
);
