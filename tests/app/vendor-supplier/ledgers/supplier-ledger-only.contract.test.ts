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

const ledgerPage = readFileSync(resolve("src/app/app/vendor-supplier/ledgers/page.tsx"), "utf8");

assertIncludes(ledgerPage, "linkedSupplierLedgerPdas", "workspace Supplier Ledger PDA set");
assertIncludes(
  ledgerPage,
  "rows.filter((row) => linkedSupplierLedgerPdas.has(row.pubkey))",
  "ledger list intersects workspace links with decoded Supplier AR accounts",
);
assertExcludes(ledgerPage, "accountingLedger: \"\"", "Base GL or unresolved link placeholder in AR Ledger list");
