import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function assertIncludes(source: string, expected: string, label: string) {
  if (!source.includes(expected)) {
    throw new Error(`${label}: expected detail page to include ${JSON.stringify(expected)}`);
  }
}

const detailPage = readFileSync(
  resolve("src/app/app/anchor-buyer/vendor-invoices/[pubkey]/page.tsx"),
  "utf8",
);

assertIncludes(detailPage, "payVendorInvoice", "payment service call");
assertIncludes(detailPage, "Post Payment", "payment submit button");
assertIncludes(detailPage, "Payment No", "payment number input");
assertIncludes(detailPage, "Payment Date", "payment date input");
assertIncludes(detailPage, "listBuyerLedgers", "buyer ledger lookup");
assertIncludes(detailPage, "listVendors", "vendor lookup");
assertIncludes(detailPage, "Buyer", "buyer display label");
assertIncludes(detailPage, "Vendor", "vendor display label");
