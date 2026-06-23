import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const page = readFileSync(
  resolve("src/app/app/facilitator/settlements/documents/page.tsx"),
  "utf8",
);

assert.ok(
  page.includes("originalAmount: parseAmountToMinor(originalAmount)"),
  "settlement document registration must convert major-unit input to minor units",
);
assert.ok(
  !page.includes("originalAmount: Number(originalAmount)"),
  "settlement document registration must not store major units directly",
);
assert.ok(
  page.includes("formatLamportsAmount(row.originalAmount, row.currency || \"USD\")"),
  "settlement document list must format stored minor units",
);
assert.ok(
  page.includes("formatLamportsAmount(row.openAmount, row.currency || \"USD\")"),
  "settlement document list must format open minor units",
);
assert.ok(
  page.includes("formatLamportsAmount(row.settledAmount, row.currency || \"USD\")"),
  "settlement document list must format settled minor units",
);
