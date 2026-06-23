import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const contracts = readFileSync(resolve("src/services/contracts.ts"), "utf8");
const service = readFileSync(resolve("src/services/settlement-facilitator-service.ts"), "utf8");

assert.ok(
  contracts.includes("getDocument(pubkey: string): Promise<SettlementDocumentRecord | null>"),
  "settlement service contract must expose direct document lookup",
);
assert.ok(
  service.includes("async getDocument(pubkey: string): Promise<SettlementDocumentRecord | null>"),
  "settlement service must implement direct document lookup",
);
assert.ok(
  service.includes("this.accountNs.settlementDocument.fetch(new PublicKey(pubkey))"),
  "direct lookup must fetch the requested settlement document account",
);
assert.ok(
  service.includes("this.mapDocumentRecord(pubkey, account)"),
  "direct lookup must use the standard settlement document mapping",
);
