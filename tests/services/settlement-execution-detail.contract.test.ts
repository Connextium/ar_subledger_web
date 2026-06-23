import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const contracts = readFileSync(resolve("src/services/contracts.ts"), "utf8");
const service = readFileSync(resolve("src/services/settlement-facilitator-service.ts"), "utf8");

assert.ok(contracts.includes("getExecution(pubkey: string): Promise<SettlementExecutionRecord | null>"));
assert.ok(service.includes("async getExecution(pubkey: string): Promise<SettlementExecutionRecord | null>"));
assert.ok(service.includes("this.accountNs.settlementExecution.fetch(new PublicKey(pubkey))"));
assert.ok(service.includes("this.mapExecutionRecord(pubkey, account)"));
