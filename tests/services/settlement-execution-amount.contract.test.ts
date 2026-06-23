import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatLamportsAmount, parseAmountToMinor } from "@/lib/utils/format";

const contracts = readFileSync(resolve("src/services/contracts.ts"), "utf8");
const service = readFileSync(resolve("src/services/settlement-facilitator-service.ts"), "utf8");
const page = readFileSync(
  resolve("src/app/app/facilitator/settlements/executions/page.tsx"),
  "utf8",
);

assert.equal(parseAmountToMinor("123"), 12_300);
assert.match(formatLamportsAmount(12_300, "USD"), /123\.00/);
assert.ok(contracts.includes("amountMinor: number"));
assert.ok(!contracts.includes("export type ExecuteSettlementInput = TransactionSubmissionHooks & {\n  routePubkey: string;\n  documentPubkey: string;\n  settlementSeq: number;\n  amount: number;"));
assert.ok(service.includes("new BN(input.amountMinor)"));
assert.ok(!service.includes("new BN(input.amount), input.memo"));
assert.ok(page.includes("amountMinor: parseAmountToMinor(amount)"));
