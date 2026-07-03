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

const facilitatorApiClient = readFileSync(resolve("src/lib/api-client/v1/facilitator.ts"), "utf8");

assertIncludes(facilitatorApiClient, "apiFetch", "route list uses facilitator HTTP api-client boundary");
assertExcludes(facilitatorApiClient, "@/services/", "facilitator api-client should not import removed web services");
