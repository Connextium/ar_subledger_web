import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const nextConfig = readFileSync(resolve("next.config.ts"), "utf8");
assert.ok(nextConfig.includes("allowedDevOrigins"), "Next dev origin allow-list must be configured.");
assert.ok(nextConfig.includes("WEB_ALLOWED_DEV_ORIGINS"), "Web dev origins should be configurable by environment.");
assert.ok(nextConfig.includes("NEXT_ALLOWED_DEV_ORIGINS"), "Next dev origins should support the shared env name.");

const loginPage = readFileSync(resolve("src/app/login/page.tsx"), "utf8");
assert.ok(
  loginPage.includes("Cross-origin access to Next.js dev resources is blocked by default for safety."),
  "Login page must render a cross-origin dev-resource warning.",
);
assert.ok(loginPage.includes("headers"), "Login page warning must be server-rendered from request headers.");
assert.ok(loginPage.includes("WEB_ALLOWED_DEV_ORIGINS"), "Login page warning must tell operators which env var to set.");
assert.ok(!loginPage.includes("AuthPageShell"), "Login page must not be blocked or redirected by auth shell session checks.");
assert.ok(loginPage.includes("LoginAvailabilityWarning"), "Login page must show API availability warnings.");

const authPageShell = readFileSync(resolve("src/components/auth/auth-page-shell.tsx"), "utf8");
assert.ok(
  authPageShell.includes("renderWhileCheckingSession"),
  "Auth page shell must support non-blocking login rendering.",
);

const availabilityWarning = readFileSync(resolve("src/components/auth/login-availability-warning.tsx"), "utf8");
assert.ok(availabilityWarning.includes("/api/v1/platform/health"), "Login availability warning must check API health.");
assert.ok(availabilityWarning.includes("AbortController"), "Login availability warning must timeout API health checks.");
assert.ok(availabilityWarning.includes("cross-origin"), "Login availability warning must mention cross-origin blocking.");

const homePage = readFileSync(resolve("src/app/page.tsx"), "utf8");
assert.ok(homePage.includes('redirect("/login")'), "Front page must load the login page before protected app routes.");
