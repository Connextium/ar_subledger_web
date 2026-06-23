import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const listPage = readFileSync(
  resolve("src/app/app/facilitator/settlements/documents/page.tsx"),
  "utf8",
);
const detailPath = resolve(
  "src/app/app/facilitator/settlements/documents/[pubkey]/page.tsx",
);

assert.ok(
  listPage.includes("`/app/facilitator/settlements/documents/${row.pubkey}`"),
  "settlement document rows must link to their detail page",
);
assert.ok(existsSync(detailPath), "settlement document detail page must exist");

const detailPage = readFileSync(detailPath, "utf8");
for (const expected of [
  "service.getDocument(params.pubkey)",
  "service.getRoute(nextDocument.route)",
  "listWorkspaceSettlementRoutes(activeWorkspaceId)",
  'link.status === "active"',
  "link.routePda === nextDocument.route",
  "nextRoute.facilitator !== wallet.publicKey.toBase58()",
  "deriveVendorInvoicePda(new PublicKey(nextRoute.buyerApLedger), nextDocument.invoiceNo)",
  "deriveInvoicePda(new PublicKey(nextRoute.supplierArLedger), nextDocument.invoiceNo)",
  "apService.getVendorInvoice(buyerInvoicePda.toBase58())",
  "arService.getInvoice(supplierInvoicePda.toBase58())",
  "compareSettlementInvoice",
]) {
  assert.ok(detailPage.includes(expected), `detail page must include ${expected}`);
}
