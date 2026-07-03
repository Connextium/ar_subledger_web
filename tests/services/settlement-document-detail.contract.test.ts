import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const facilitatorApiClient = readFileSync(resolve("src/lib/api-client/v1/facilitator.ts"), "utf8");
const detailPage = readFileSync(
  resolve("src/app/app/facilitator/settlements/documents/[pubkey]/page.tsx"),
  "utf8",
);

assert.ok(
  facilitatorApiClient.includes("apiFetch"),
  "facilitator API client should use HTTP boundary",
);
assert.ok(
  detailPage.includes("service.getDocument(params.pubkey)"),
  "detail page should request document via facilitator service boundary",
);
