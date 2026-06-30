import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const files = [
  "src/server/api/application/auth-service.ts",
  "src/server/api/auth/api-key-service.ts",
  "src/server/api/auth/session-service.ts",
  "src/server/api/audit/audit-service.ts",
];

for (const file of files) {
  assert.equal(existsSync(file), true, `${file} must exist`);
}

const authContext = readFileSync("src/app/api/v1/_shared/auth-context.ts", "utf8");
assert.ok(authContext.includes('"auth:session"'));
assert.ok(authContext.includes('"api-clients:write"'));
assert.ok(authContext.includes('"wallets:export"'));
assert.ok(authContext.includes('"audit:read"'));
