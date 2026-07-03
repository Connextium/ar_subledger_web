import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const facilitatorApiClient = readFileSync(resolve("src/lib/api-client/v1/facilitator.ts"), "utf8");

assert.ok(facilitatorApiClient.includes("apiFetch"));
assert.equal(existsSync(resolve("src/app/api/wallets/route.ts")), false);
