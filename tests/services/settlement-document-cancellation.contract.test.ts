import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const contracts = readFileSync(resolve("src/services/contracts.ts"), "utf8");
const service = readFileSync(resolve("src/services/settlement-facilitator-service.ts"), "utf8");
const idl = JSON.parse(
  readFileSync(resolve("src/lib/solana/settlement_facilitator.idl.json"), "utf8"),
) as { instructions: Array<{ name: string }> };

assert.ok(contracts.includes("export type CancelSettlementDocumentInput"));
assert.ok(contracts.includes("routePubkey: string"));
assert.ok(contracts.includes("documentPubkey: string"));
assert.ok(contracts.includes("cancelDocument(input: CancelSettlementDocumentInput): Promise<string>"));
assert.ok(service.includes("async cancelDocument(input: CancelSettlementDocumentInput): Promise<string>"));
assert.ok(service.includes(".cancelDocument()"));
assert.ok(service.includes("facilitator: this.wallet.publicKey"));
assert.ok(service.includes("route,"));
assert.ok(service.includes("document,"));
assert.ok(idl.instructions.some((instruction) => instruction.name === "cancel_document"));
