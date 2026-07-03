import { existsSync, readFileSync } from "node:fs";
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

const vendorsPage = readFileSync(resolve("src/app/app/anchor-buyer/vendors/page.tsx"), "utf8");
const buyerLedgersPage = readFileSync(resolve("src/app/app/anchor-buyer/buyer-ledgers/page.tsx"), "utf8");
const platformApiClient = readFileSync(resolve("src/lib/api-client/v1/platform.ts"), "utf8");
const detailPagePath = resolve("src/app/app/anchor-buyer/vendors/[pubkey]/page.tsx");

assertIncludes(vendorsPage, "service.listVendors(ledgerPubkey)", "vendor list filtered by selected Buyer Ledger");
assertIncludes(vendorsPage, "listBuyerLedgerLinks(activeWorkspaceId)", "Buyer Ledgers loaded from active workspace links");
assertIncludes(vendorsPage, "listLedgerLinks(activeWorkspaceId)", "legacy Buyer Ledgers inferred from workspace Base GL links");
assertIncludes(vendorsPage, "filterBuyerLedgersByWorkspaceLinks", "on-chain Buyer Ledgers intersected with workspace links");
assertIncludes(vendorsPage, "[activeWorkspaceId, service]", "Buyer Ledger list reloads when workspace changes");
assertIncludes(vendorsPage, "createWorkspaceVendor", "workspace vendor metadata created off-chain");
assertIncludes(vendorsPage, "upsertWorkspaceVendorLedgerLink", "workspace vendor linked to Buyer Ledger");
assertIncludes(vendorsPage, "/app/anchor-buyer/vendors/${row.pubkey}", "vendor row links to detail");

if (!existsSync(detailPagePath)) {
  throw new Error("vendor detail page: expected /app/anchor-buyer/vendors/[pubkey]/page.tsx to exist");
}

const detailPage = readFileSync(detailPagePath, "utf8");
assertIncludes(detailPage, "updateWorkspaceVendor", "vendor detail updates workspace metadata");
assertIncludes(detailPage, "On-chain vendor is immutable", "detail page explains immutable vendor account");
assertIncludes(detailPage, "Vendor Legal Name", "detail page edits legal metadata");
assertIncludes(detailPage, "Status", "detail page edits workspace status");
assertExcludes(detailPage, "updateVendor(", "detail page must not call on-chain vendor update");

assertIncludes(platformApiClient, "apiFetch", "platform API client uses HTTP ownership boundary");

assertIncludes(buyerLedgersPage, "useWorkspace", "Buyer Ledger inventory reads the active workspace");
assertIncludes(buyerLedgersPage, "listBuyerLedgerLinks(activeWorkspaceId)", "Buyer Ledger inventory is workspace-scoped");
assertIncludes(buyerLedgersPage, "listLedgerLinks(activeWorkspaceId)", "Buyer Ledger inventory supports legacy Base GL linkage");
assertIncludes(buyerLedgersPage, "filterBuyerLedgersByWorkspaceLinks", "Buyer Ledger inventory intersects on-chain and workspace records");
assertIncludes(
  buyerLedgersPage,
  "setRows([]);\n\n    if (!service || !activeWorkspaceId)",
  "Buyer Ledger inventory clears stale rows before a workspace reload",
);
assertIncludes(buyerLedgersPage, "upsertBuyerLedgerLink", "new Buyer Ledger is linked to the active workspace");
