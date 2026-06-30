import assert from "node:assert/strict";
import { existsSync } from "node:fs";

const files = [
  "src/server/api/application/buyer-service.ts",
  "src/server/api/application/supplier-service.ts",
  "src/server/api/application/factor-service.ts",
  "src/server/api/application/facilitator-service.ts",
  "src/server/api/application/platform-service.ts",
  "src/server/api/application/webhook-service.ts",
];

for (const file of files) {
  assert.equal(existsSync(file), true, `${file} must exist`);
}
