import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const detailPath = resolve("src/app/app/facilitator/settlements/executions/[pubkey]/page.tsx");
assert.ok(existsSync(detailPath), "settlement execution detail page must exist");
const page = readFileSync(detailPath, "utf8");

for (const expected of [
  "service.getExecution(params.pubkey)",
  "listWorkspaceSettlementRoutes(activeWorkspaceId)",
  'link.status === "active"',
  "link.routePda === nextExecution.route",
  "service.getRoute(nextExecution.route)",
  "nextRoute.facilitator !== wallet.publicKey.toBase58()",
  "service.getDocument(nextExecution.document)",
  "accountingEngineService.getJournalEntry(",
  "new PublicKey(nextRoute.buyerAccountingLedger)",
  "BigInt(nextExecution.buyerJournalEntryId)",
  "new PublicKey(nextRoute.supplierAccountingLedger)",
  "BigInt(nextExecution.supplierJournalEntryId)",
  "Buyer Journal Entry",
  "Supplier Journal Entry",
  "formatLamportsAmount",
]) {
  assert.ok(page.includes(expected), `execution detail page must include ${expected}`);
}
