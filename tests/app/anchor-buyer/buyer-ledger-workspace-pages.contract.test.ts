import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function assertIncludes(source: string, expected: string, label: string) {
  if (!source.includes(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}`);
  }
}
for (const pagePath of ["vendor-invoices/page.tsx", "payments/page.tsx"]) {
  const source = readFileSync(resolve("src/app/app/anchor-buyer", pagePath), "utf8");
  assertIncludes(source, "useWorkspace", `${pagePath} reads the active workspace`);
  assertIncludes(
    source,
    "listBuyerLedgerLinks(activeWorkspaceId)",
    `${pagePath} loads active workspace Buyer Ledger links`,
  );
  assertIncludes(
    source,
    "listLedgerLinks(activeWorkspaceId)",
    `${pagePath} supports legacy Buyer Ledgers through workspace Base GL links`,
  );
  assertIncludes(
    source,
    "filterBuyerLedgersByWorkspaceLinks",
    `${pagePath} intersects on-chain Buyer Ledgers with workspace ownership`,
  );
  assertIncludes(
    source,
    "[activeWorkspaceId, service]",
    `${pagePath} reloads Buyer Ledgers when the workspace changes`,
  );
}
