import assert from "node:assert/strict";
import { existsSync } from "node:fs";

const routes = [
  "src/app/api/v1/platform/openapi.json/route.ts",
  "src/app/api/v1/auth/register/route.ts",
  "src/app/api/v1/auth/login/route.ts",
  "src/app/api/v1/auth/logout/route.ts",
  "src/app/api/v1/auth/session/route.ts",
  "src/app/api/v1/auth/api-keys/route.ts",
  "src/app/api/v1/platform/health/route.ts",
  "src/app/api/v1/platform/version/route.ts",
  "src/app/api/v1/platform/me/route.ts",
  "src/app/api/v1/platform/workspaces/route.ts",
  "src/app/api/v1/platform/workspaces/[workspaceId]/wallets/route.ts",
  "src/app/api/v1/platform/workspaces/[workspaceId]/api-clients/route.ts",
  "src/app/api/v1/platform/workspaces/[workspaceId]/audit-events/route.ts",
  "src/app/api/v1/buyer/workspaces/[workspaceId]/ledgers/route.ts",
  "src/app/api/v1/buyer/workspaces/[workspaceId]/vendors/route.ts",
  "src/app/api/v1/buyer/workspaces/[workspaceId]/vendor-invoices/route.ts",
  "src/app/api/v1/supplier/workspaces/[workspaceId]/ledgers/route.ts",
  "src/app/api/v1/supplier/workspaces/[workspaceId]/customers/route.ts",
  "src/app/api/v1/supplier/workspaces/[workspaceId]/invoices/route.ts",
  "src/app/api/v1/factor/workspaces/[workspaceId]/eligible-invoices/route.ts",
  "src/app/api/v1/facilitator/workspaces/[workspaceId]/routes/route.ts",
  "src/app/api/v1/facilitator/workspaces/[workspaceId]/documents/route.ts",
  "src/app/api/v1/facilitator/workspaces/[workspaceId]/executions/route.ts",
  "src/app/api/v1/webhooks/workspaces/[workspaceId]/subscriptions/route.ts",
];

for (const route of routes) {
  assert.equal(existsSync(route), true, `${route} must exist`);
}
