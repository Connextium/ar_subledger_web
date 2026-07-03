import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function assertIncludes(source: string, expected: string, label: string) {
  if (!source.includes(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}`);
  }
}

const documentsPage = readFileSync(resolve("src/app/app/facilitator/settlements/documents/page.tsx"), "utf8");
const routesPage = readFileSync(resolve("src/app/app/facilitator/settlements/routes/page.tsx"), "utf8");

assertIncludes(documentsPage, "useWorkspace", "documents page reads current workspace");
assertIncludes(
  documentsPage,
  "listWorkspaceSettlementRoutes(activeWorkspaceId)",
  "documents page loads workspace route links",
);
assertIncludes(documentsPage, "workspaceRoutePdas", "documents page derives workspace route PDA set");
assertIncludes(
  documentsPage,
  "route.facilitator === wallet.publicKey",
  "route selector requires current facilitator ownership",
);
assertIncludes(documentsPage, "[activeWorkspaceId, service, wallet]", "route selector reloads on workspace or wallet change");

assertIncludes(routesPage, "useWorkspace", "route creation reads current workspace");
assertIncludes(routesPage, "service.getRoute(pubkey)", "route creation reloads persisted route metadata");
assertIncludes(routesPage, "upsertWorkspaceSettlementRoute", "new route linked to current workspace");
assertIncludes(routesPage, "rows.find((route) => route.routeCode === routeCode)", "route creation checks existing API-fetched route by code");
assertIncludes(routesPage, "setRows((current)", "created or recovered route inserted into visible inventory immediately");
assertIncludes(
  routesPage,
  "listWorkspaceSettlementRoutes(activeWorkspaceId)",
  "route inventory loads current workspace route links",
);
assertIncludes(routesPage, "workspaceRoutePdas", "route inventory derives active workspace route PDAs");
assertIncludes(
  routesPage,
  "route.facilitator === wallet.publicKey",
  "route inventory requires current facilitator ownership",
);
assertIncludes(routesPage, "[activeWorkspaceId, service, wallet]", "route inventory reloads on workspace or wallet change");
