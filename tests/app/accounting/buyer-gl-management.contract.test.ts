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
const initializeGlApi = readFileSync(resolve("src/app/api/accounting/initialize-gl/route.ts"), "utf8");
const baseGlManageRoutePath = resolve("src/app/app/accounting/base-gl/[glPubkey]/manage/page.tsx");

assertIncludes(
  accountingPage,
  "/app/accounting/base-gl/${selectedBaseGl.pubkey}/manage",
  "buyer-linked Base GL management route",
);
assertExcludes(
  accountingPage,
  ': "/app/anchor-buyer/buyer-ledgers"',
  "Manage GL Accounting should not return to buyer ledger list",
);

if (!existsSync(baseGlManageRoutePath)) {
  throw new Error("Base GL manage route: expected Base GL accounting page to exist");
}

const baseGlManageRoute = readFileSync(baseGlManageRoutePath, "utf8");
assertIncludes(baseGlManageRoute, "linkedBuyerLedgers", "Base GL manage route loads buyer AP ledger links");
assertIncludes(baseGlManageRoute, "GlSetupComponent", "Base GL manage route renders GL setup");
assertIncludes(baseGlManageRoute, "JournalEntriesComponent", "Base GL manage route renders journal entries");
assertIncludes(baseGlManageRoute, 'generalLedgerId={`base-gl:${glPubkey}`}', "Base GL manage route uses Base GL ID");
assertIncludes(baseGlManageRoute, "allowedInitializationTypes", "Base GL manage route restricts initialization");

assertIncludes(glSetupComponent, "defaultInitializationType", "GL setup supports caller-selected default");
assertIncludes(glSetupComponent, "ledgerKey,", "GL setup submits Base GL pubkey to initialize API");

assertIncludes(initializeGlApi, 'generalLedgerId.startsWith("base-gl:")', "initialize API recognizes Base GL IDs");
assertIncludes(initializeGlApi, "ledgerKey", "initialize API accepts Base GL pubkey");
