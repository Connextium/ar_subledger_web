import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const configurationPage = readFileSync(resolve("src/app/app/configuration/page.tsx"), "utf8");

assert.ok(configurationPage.includes('import { authApi } from "@/lib/api-client/v1/auth";'));
assert.ok(configurationPage.includes("authApi.listApiKeys"));
assert.ok(configurationPage.includes("authApi.createApiKey"));
assert.ok(configurationPage.includes("authApi.revokeApiKey"));
assert.ok(configurationPage.includes("createdApiKey"));
assert.ok(configurationPage.includes("Copy now"));
assert.ok(configurationPage.includes("navigator.clipboard.writeText"));
assert.ok(configurationPage.includes('id="api-keys"'));
