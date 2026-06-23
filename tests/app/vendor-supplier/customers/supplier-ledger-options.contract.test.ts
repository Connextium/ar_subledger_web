import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function assertIncludes(source: string, expected: string, label: string) {
  if (!source.includes(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}`);
  }
}

const customersPage = readFileSync(resolve("src/app/app/vendor-supplier/customers/page.tsx"), "utf8");

assertIncludes(customersPage, "arService.listLedgers()", "decoded Supplier AR ledgers loaded");
assertIncludes(customersPage, "supplierLedgerPdas", "decoded Supplier Ledger PDA set");
assertIncludes(
  customersPage,
  "supplierLedgerPdas.has(row.ledgerPda)",
  "optional ledger choices intersect workspace links with Supplier AR accounts",
);
assertIncludes(customersPage, "row.workspaceId === activeWorkspaceId", "optional ledger choices use active workspace");
