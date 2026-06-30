import assert from "node:assert/strict";
import { openApiDocument } from "@/app/api/v1/_shared/openapi";

assert.equal(openApiDocument.openapi, "3.1.0");
assert.ok(openApiDocument.paths["/api/v1/auth/register"]);
assert.ok(openApiDocument.paths["/api/v1/platform/workspaces/{workspaceId}/wallets"]);
assert.ok(openApiDocument.paths["/api/v1/platform/workspaces/{workspaceId}/api-clients"]);
assert.ok(openApiDocument.paths["/api/v1/platform/workspaces/{workspaceId}/audit-events"]);
assert.ok(openApiDocument.paths["/api/v1/buyer/workspaces/{workspaceId}/vendor-invoices"]);
assert.ok(openApiDocument.paths["/api/v1/supplier/workspaces/{workspaceId}/invoices"]);
assert.ok(openApiDocument.paths["/api/v1/factor/workspaces/{workspaceId}/eligible-invoices"]);
assert.ok(openApiDocument.paths["/api/v1/facilitator/workspaces/{workspaceId}/executions"]);
