import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function assertIncludes(source: string, expected: string, label: string) {
  if (!source.includes(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}`);
  }
}

function assertExcludes(source: string, unexpected: string, label: string) {
  if (source.includes(unexpected)) {
    throw new Error(`${label}: did not expect ${JSON.stringify(unexpected)}`);
  }
}

const contextBar = readFileSync(resolve("src/components/layout/context-bar.tsx"), "utf8");

assertIncludes(contextBar, 'pathname.startsWith("/app/vendor-supplier")', "context bar scoped to supplier pages");
assertIncludes(contextBar, "Supplier AR Context", "supplier-specific context title");
assertIncludes(contextBar, "Supplier Ledger", "supplier-specific ledger label");
assertIncludes(contextBar, "Select supplier ledger", "supplier-specific empty option");
assertIncludes(contextBar, "supplier ledger", "active summary distinguishes supplier ledger");
assertExcludes(contextBar, "Working Context", "generic working context title");
assertExcludes(contextBar, ">Ledger<", "generic ledger label");
