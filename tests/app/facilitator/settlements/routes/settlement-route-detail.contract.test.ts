import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function assertIncludes(source: string, expected: string, label: string) {
  if (!source.includes(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}`);
  }
}

const routesPage = readFileSync(resolve("src/app/app/facilitator/settlements/routes/page.tsx"), "utf8");
const service = readFileSync(resolve("src/services/settlement-facilitator-service.ts"), "utf8");
const contracts = readFileSync(resolve("src/services/contracts.ts"), "utf8");
const detailPath = resolve("src/app/app/facilitator/settlements/routes/[pubkey]/page.tsx");

assertIncludes(contracts, "getRoute(pubkey: string)", "settlement service direct route contract");
assertIncludes(service, "async getRoute", "settlement service direct route implementation");
assertIncludes(routesPage, "/app/facilitator/settlements/routes/${row.pubkey}", "route inventory detail link");

if (!existsSync(detailPath)) {
  throw new Error("expected settlement route detail page");
}

const detailPage = readFileSync(detailPath, "utf8");
assertIncludes(detailPage, "service.getRoute(params.pubkey)", "detail directly loads route PDA");
assertIncludes(detailPage, "getBuyerLedger(nextRoute.buyerApLedger)", "detail resolves Buyer AP Ledger code");
assertIncludes(detailPage, "getLedger(nextRoute.supplierArLedger)", "detail resolves Supplier AR Ledger code");
assertIncludes(detailPage, "new PublicKey(nextRoute.buyerAccountingLedger)", "detail resolves Buyer Base GL code");
assertIncludes(detailPage, "new PublicKey(nextRoute.supplierAccountingLedger)", "detail resolves Supplier Base GL code");
assertIncludes(detailPage, "Buyer AP Ledger", "detail displays Buyer AP identity");
assertIncludes(detailPage, "Supplier AR Ledger", "detail displays Supplier AR identity");
assertIncludes(detailPage, "Buyer Base GL", "detail displays Buyer Base GL identity");
assertIncludes(detailPage, "Supplier Base GL", "detail displays Supplier Base GL identity");
