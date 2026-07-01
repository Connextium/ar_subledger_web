import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const supabaseClient = readFileSync("src/lib/supabase/client.ts", "utf8");
const sessionClient = readFileSync("src/lib/api-client/v1/session-client.ts", "utf8");

assert.ok(
  supabaseClient.includes('supabaseAuthStorageKey = "ar-subledger:supabase-auth"'),
  "Supabase auth must use an app-specific storage key",
);
assert.ok(
  supabaseClient.includes("storageKey: supabaseAuthStorageKey"),
  "Supabase auth options must apply the app-specific storage key",
);
assert.ok(
  sessionClient.includes('"Invalid Refresh Token"') &&
    sessionClient.includes('"Refresh Token Not Found"'),
  "session client must identify stale Supabase refresh-token failures",
);
assert.ok(
  sessionClient.includes('signOut({ scope: "local" })'),
  "session client must clear only local auth state when refresh token is stale",
);
assert.ok(
  sessionClient.includes("new Proxy(configuredSupabase.auth") &&
    sessionClient.includes('property === "getSession"'),
  "configured session client must route getSession through the stale-token guard",
);
