import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatLamportsAmount, parseAmountToMinor } from "@/lib/utils/format";

const facilitatorApiClient = readFileSync(resolve("src/lib/api-client/v1/facilitator.ts"), "utf8");
const page = readFileSync(
  resolve("src/app/app/facilitator/settlements/executions/page.tsx"),
  "utf8",
);

assert.equal(parseAmountToMinor("123"), 12_300);
assert.match(formatLamportsAmount(12_300, "USD"), /123\.00/);
assert.ok(facilitatorApiClient.includes("apiFetch"));
assert.ok(page.includes("amountMinor: parseAmountToMinor(amount)"));
