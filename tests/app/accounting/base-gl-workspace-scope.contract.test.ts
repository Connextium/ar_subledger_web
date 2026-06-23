import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function assertIncludes(source: string, expected: string, label: string) {
  if (!source.includes(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}`);
  }
}

function assertExcludes(source: string, unexpected: string, label: string) {
  if (source.includes(unexpected)) {
    throw new Error(`${label}: did not expect ${JSON.stringify(unexpected)}`);
  }
}

const accountingPage = readFileSync(resolve("src/app/app/accounting/page.tsx"), "utf8");

assertIncludes(accountingPage, "controlPlaneService.listLedgerLinks(activeWorkspaceId)", "workspace ledger links loaded");
assertIncludes(accountingPage, "controlPlaneService.listBuyerLedgerLinks(activeWorkspaceId)", "workspace Buyer Ledger links loaded");
assertIncludes(accountingPage, "workspaceGlKeys", "Base GL keys derived from workspace links");
assertIncludes(accountingPage, "activeSupplierLedgerPdas", "Supplier ledgers restricted to active workspace links");
assertIncludes(accountingPage, "activeBuyerLedgerPdas", "Buyer ledgers restricted to active workspace links");
assertIncludes(
  accountingPage,
  "buyerLedgerRows.filter((row) => activeBuyerLedgerPdas.has(row.pubkey))",
  "Linked Buyer Ledgers require a direct active link in the workspace",
);
assertExcludes(
  accountingPage,
  "activeBuyerLedgerPdas.has(row.pubkey) || workspaceGlKeys.has(row.accountingLedger)",
  "shared Base GL must not infer Buyer Ledger workspace membership",
);
assertIncludes(accountingPage, "controlPlaneService.linkLedgerToWorkspace", "new standalone Base GL linked to workspace");
assertIncludes(accountingPage, "onchainLedgerKey: accountingLedgerPubkey", "standalone Base GL key persisted");
assertIncludes(
  accountingPage,
  "const glByPubkey = new Map<string, AccountingLedger>();",
  "workspace Base GL result map starts empty",
);
