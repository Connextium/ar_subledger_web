import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const facilitatorApiClient = readFileSync(resolve("src/lib/api-client/v1/facilitator.ts"), "utf8");
const executionPage = readFileSync(
  resolve("src/app/app/facilitator/settlements/executions/page.tsx"),
  "utf8",
);

assert.ok(
  facilitatorApiClient.includes("apiFetch"),
  "facilitator api-client should use HTTP boundary",
);
assert.ok(
  executionPage.includes("service.executeSettlement"),
  "settlement execution page should call facilitator boundary method",
);
