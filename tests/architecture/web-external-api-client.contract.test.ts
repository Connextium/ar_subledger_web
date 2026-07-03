import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

assert.equal(
  existsSync(resolve("src/app/api")),
  false,
  "apps/web must not own runtime app/api route handlers after Task 8",
);

const configurationPage = readFileSync(resolve("src/app/app/configuration/page.tsx"), "utf8");
const embeddedWalletContext = readFileSync(resolve("src/context/embedded-wallet-context.tsx"), "utf8");
const glSetupComponent = readFileSync(resolve("src/components/accounting/gl-setup.tsx"), "utf8");

for (const source of [configurationPage, embeddedWalletContext, glSetupComponent]) {
  assert.ok(source.includes("resolveApiBasePath"));
  assert.ok(source.includes("/api/v1/"));
}
