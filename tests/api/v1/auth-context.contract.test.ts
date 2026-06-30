import assert from "node:assert/strict";
import { hasRequiredScopes, type ApiScope } from "@/app/api/v1/_shared/auth-context";

const scopes: ApiScope[] = ["buyer:read", "buyer:write", "platform:read"];
assert.equal(hasRequiredScopes(scopes, ["buyer:read"]), true);
assert.equal(hasRequiredScopes(scopes, ["supplier:read"]), false);
assert.equal(hasRequiredScopes(scopes, ["buyer:read", "buyer:write"]), true);
