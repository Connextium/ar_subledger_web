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

const service = readFileSync(resolve("src/services/settlement-facilitator-service.ts"), "utf8");

assertIncludes(service, 'msg.includes("out of range")', "runtime buffer offset errors recognized");
assertIncludes(service, "connection.getProgramAccounts", "route list reads raw program accounts");
assertIncludes(service, 'account.name === "settlementRoute"', "route list locates normalized SettlementRoute discriminator");
assertIncludes(service, 'decode("settlementRoute"', "route accounts decoded individually");
assertIncludes(service, "data.subarray(0, discriminator.length).equals(discriminator)", "unrelated accounts filtered before decode");
assertIncludes(service, "Skipping incompatible SettlementRoute account", "one legacy route cannot empty the entire list");
assertExcludes(service, "this.accountNs.settlementRoute.all()", "all-or-nothing route scan");
