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

const accountingPage = readFileSync(resolve("src/app/app/accounting/page.tsx"), "utf8");
const glSetupComponent = readFileSync(resolve("src/components/accounting/gl-setup.tsx"), "utf8");
const manageRoutePath = resolve("src/app/app/accounting/base-gl/[glPubkey]/manage/page.tsx");

assertIncludes(accountingPage, "BaseGlWithLinks", "Base GL view model");
assertIncludes(accountingPage, "selectedBaseGlPubkey", "Base GL selection state");
assertIncludes(accountingPage, "linkedSupplierLedgers", "supplier sub-ledger links");
assertIncludes(accountingPage, "linkedBuyerLedgers", "buyer sub-ledger links");
assertIncludes(accountingPage, "Select Base GL", "Base GL selector label");
assertIncludes(accountingPage, "Linked Supplier Ledgers", "supplier linked ledger section");
assertIncludes(accountingPage, "Linked Buyer Ledgers", "buyer linked ledger section");
assertIncludes(
  accountingPage,
  "/app/accounting/base-gl/${selectedBaseGl.pubkey}/manage",
  "Base GL manage route",
);
assertExcludes(accountingPage, "Select Ledger", "sub-ledger selector label");

if (!existsSync(manageRoutePath)) {
  throw new Error("Base GL manage route: expected /app/accounting/base-gl/[glPubkey]/manage/page.tsx to exist");
}

const manageRoute = readFileSync(manageRoutePath, "utf8");
assertIncludes(manageRoute, "allowedInitializationTypes", "manage route restricts GL initialization types");
assertIncludes(manageRoute, "linkedSupplierLedgers.length > 0", "manage route allows AR only with supplier links");
assertIncludes(manageRoute, "linkedBuyerLedgers.length > 0", "manage route allows AP only with buyer links");
assertIncludes(manageRoute, "GlSetupComponent", "manage route renders GL setup");
assertIncludes(manageRoute, "JournalEntriesComponent", "manage route renders journal entries");

assertIncludes(glSetupComponent, "allowedInitializationTypes", "GL setup accepts allowed types");
assertIncludes(glSetupComponent, "canUseAr", "GL setup gates AR initialization");
assertIncludes(glSetupComponent, "canUseAp", "GL setup gates AP initialization");
