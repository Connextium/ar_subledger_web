import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sessionClient = readFileSync("src/lib/api-client/v1/session-client.ts", "utf8");

assert.ok(
  !sessionClient.includes("@/lib/supabase/client"),
  "session client must not depend on local Supabase runtime module",
);
assert.ok(
  sessionClient.includes("@/lib/api-client/v1/auth"),
  "session client should resolve auth state through API client boundaries",
);
assert.ok(
  !sessionClient.includes("LOCAL_SESSION_KEY"),
  "session client must not retain local fallback session storage",
);
assert.ok(
  sessionClient.includes("export const supabase: any = apiBackedSupabase"),
  "session client must expose an API-backed supabase-compatible shim",
);
