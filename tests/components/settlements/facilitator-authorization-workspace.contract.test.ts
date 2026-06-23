import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function assertIncludes(source: string, expected: string, label: string) {
  if (!source.includes(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}`);
  }
}

const component = readFileSync(resolve("src/components/settlements/facilitator-authorization-workspace.tsx"), "utf8");

assertIncludes(component, "useWorkspace", "authorization workspace reads active workspace");
assertIncludes(
  component,
  "listBuyerLedgerLinks(activeWorkspaceId)",
  "buyer authorization loads current workspace Buyer Ledger links",
);
assertIncludes(
  component,
  "filterBuyerLedgersByWorkspaceLinks(buyerLedgers, links)",
  "buyer authorization requires direct active workspace Buyer Ledger linkage",
);
assertIncludes(
  component,
  "listLedgerLinks(activeWorkspaceId)",
  "supplier authorization loads current workspace ledger links",
);
assertIncludes(component, "supplierLedgerPdas", "supplier authorization derives active workspace Supplier Ledger PDAs");
assertIncludes(
  component,
  "supplierLedgers.filter((ledger) => supplierLedgerPdas.has(ledger.pubkey))",
  "supplier authorization intersects decoded AR ledgers with workspace links",
);
assertIncludes(component, "[activeWorkspaceId, side, wallet]", "ledger selector reloads when workspace changes");
