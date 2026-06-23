import assert from "node:assert/strict";
import type {
  BuyerLedgerRecord,
  WorkspaceBuyerLedgerLink,
  WorkspaceLedgerLink,
} from "@/lib/types/domain";
import { filterBuyerLedgersByWorkspaceLinks } from "@/services/buyer-ledger-workspace";

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

function baseGlLink(onchainLedgerKey: string): WorkspaceLedgerLink {
  return {
    id: `base-gl-${onchainLedgerKey}`,
    workspaceId: "workspace-a",
    ledgerPda: `subledger-${onchainLedgerKey}`,
    ledgerCode: `gl-${onchainLedgerKey}`,
    authorityPubkey: "workspace-authority",
    onchainLedgerKey,
    status: "active",
    createdAt: "2026-06-20T00:00:00.000Z",
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
    ledger("legacy-workspace-ledger", "workspace-base-gl"),
    ledger("other-workspace-ledger"),
    ledger("inactive-ledger", "workspace-base-gl"),
  ],
  [link("workspace-ledger", "active"), link("inactive-ledger", "inactive")],
  [baseGlLink("workspace-base-gl")],
);

assert.deepEqual(
  result.map((row) => row.pubkey),
  ["workspace-ledger", "legacy-workspace-ledger"],
  "workspace Buyer Ledgers should include legacy records inferred through an active Base GL link",
);
