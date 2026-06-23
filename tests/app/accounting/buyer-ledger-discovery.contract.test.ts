import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function assertIncludes(source: string, expected: string, label: string) {
  if (!source.includes(expected)) {
    throw new Error(`${label}: expected accounting page to include ${JSON.stringify(expected)}`);
  }
}

function assertExcludes(source: string, unexpected: string, label: string) {
  if (source.includes(unexpected)) {
    throw new Error(`${label}: did not expect accounting page to include ${JSON.stringify(unexpected)}`);
  }
}

const accountingPage = readFileSync(resolve("src/app/app/accounting/page.tsx"), "utf8");

assertIncludes(accountingPage, "createApSubledgerService", "buyer AP ledger service");
assertIncludes(accountingPage, "listBuyerLedgers", "buyer AP ledger discovery");
assertIncludes(accountingPage, "buyerLinksByGl", "buyer ledgers grouped by Base GL");
assertIncludes(accountingPage, "row.accountingLedger", "buyer Base GL pubkey linked from AP ledger");
assertIncludes(accountingPage, "linkedBuyerLedgers", "buyer ledgers displayed under selected Base GL");
assertExcludes(
  accountingPage,
  "if (!dbLedgers || dbLedgers.length === 0) {\n        setLedgers([]);",
  "seller-only empty ledger branch",
);
