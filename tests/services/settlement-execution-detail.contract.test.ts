import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const facilitatorApiClient = readFileSync(resolve("src/lib/api-client/v1/facilitator.ts"), "utf8");
const detailPage = readFileSync(
	resolve("src/app/app/facilitator/settlements/executions/[pubkey]/page.tsx"),
	"utf8",
);

assert.ok(facilitatorApiClient.includes("apiFetch"));
assert.ok(detailPage.includes("service.getExecution(params.pubkey)"));
