import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function assertIncludes(source: string, expected: string, label: string) {
  if (!source.includes(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}`);
  }
}

const listPage = readFileSync(resolve("src/app/app/anchor-buyer/vendor-invoices/page.tsx"), "utf8");
const detailPage = readFileSync(resolve("src/app/app/anchor-buyer/vendor-invoices/[pubkey]/page.tsx"), "utf8");
const apService = readFileSync(resolve("src/services/ap-subledger-service.ts"), "utf8");
const serviceContracts = readFileSync(resolve("src/services/contracts.ts"), "utf8");

assertIncludes(listPage, "service.listVendorInvoices(ledgerPubkey)", "invoice list scoped to selected Buyer Ledger");
assertIncludes(listPage, "service.listVendors(ledgerPubkey)", "vendor filter scoped to selected Buyer Ledger");
assertIncludes(listPage, "searchQuery", "received invoice text search");
assertIncludes(listPage, "vendorFilter", "received invoice vendor filter");
assertIncludes(listPage, "statusFilter", "received invoice payment-status filter");
assertIncludes(listPage, "filteredRows", "derived filtered invoice inventory");
assertIncludes(listPage, "getInvoiceStatus", "open, partially paid, and paid status derivation");
assertIncludes(listPage, "/app/anchor-buyer/vendor-invoices/${row.pubkey}", "invoice row detail link");

assertIncludes(serviceContracts, "getVendorInvoice(pubkey: string)", "AP service contract supports direct invoice lookup");
assertIncludes(apService, "async getVendorInvoice", "AP service implements direct invoice lookup");
assertIncludes(detailPage, "service.getVendorInvoice(params.pubkey)", "detail loads one invoice directly");
assertIncludes(detailPage, "useWorkspace", "detail reads the active workspace");
assertIncludes(detailPage, "listBuyerLedgerLinks(activeWorkspaceId)", "detail loads workspace Buyer Ledger links");
assertIncludes(detailPage, "filterBuyerLedgersByWorkspaceLinks", "detail derives workspace-authorized Buyer Ledgers");
assertIncludes(
  detailPage,
  "scopedLedgers.some((ledger) => ledger.pubkey === nextInvoice.ledger)",
  "detail rejects invoices outside the active workspace",
);
assertIncludes(detailPage, "payVendorInvoice", "detail can pay an authorized invoice");
assertIncludes(detailPage, "await loadDetail()", "payment refreshes invoice and payment state");
