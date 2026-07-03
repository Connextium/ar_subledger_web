import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const page = readFileSync(
  resolve("src/app/app/facilitator/settlements/executions/page.tsx"),
  "utf8",
);

for (const expected of [
  "useWorkspace",
  "listWorkspaceSettlementRoutes(activeWorkspaceId)",
  'link.status === "active"',
  "route.facilitator === wallet.publicKey",
  "workspaceRoutePdas.has(document.route)",
  "workspaceRoutePdas.has(execution.route)",
  "`/app/facilitator/settlements/executions/${row.pubkey}`",
  "Settlement #{row.settlementSeq}",
  "amountMinor: parseAmountToMinor(amount)",
  "formatLamportsAmount(row.amount",
]) {
  assert.ok(page.includes(expected), `execution list must include ${expected}`);
}
