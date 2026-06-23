import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const service = readFileSync(resolve("src/services/settlement-facilitator-service.ts"), "utf8");
const anchorClient = readFileSync(resolve("src/lib/solana/anchor-client.ts"), "utf8");

assert.ok(
  anchorClient.includes("createAccountingEngineProgram"),
  "anchor client must expose the accounting program for ledger sequence reads",
);
assert.ok(
  service.includes("this.accountingAccountNs.glConfig.fetch(buyerLedger)"),
  "settlement must read the Buyer accounting ledger journal sequence",
);
assert.ok(
  service.includes("this.accountingAccountNs.glConfig.fetch(supplierLedger)"),
  "settlement must read the Supplier accounting ledger journal sequence",
);
assert.ok(
  service.includes("buyerJournalCount + BigInt(1)"),
  "Buyer journal PDA must use the next available ledger journal ID",
);
assert.ok(
  service.includes("supplierJournalCount + BigInt(1)"),
  "Supplier journal PDA must use the next available ledger journal ID",
);
assert.ok(
  !service.includes("deriveJournalEntryPda(buyerLedger, settlementSeq)"),
  "settlement sequence must not be reused as the Buyer journal ID",
);
assert.ok(
  !service.includes("deriveJournalEntryPda(supplierLedger, settlementSeq)"),
  "settlement sequence must not be reused as the Supplier journal ID",
);
