import assert from "node:assert/strict";
import { compareSettlementInvoice } from "@/lib/settlement/invoice-match";

const expected = {
  pubkey: "invoice-pda",
  ledger: "ledger-pda",
  invoiceNo: "INV-100",
  originalAmount: 12500,
  currency: "USD",
};

const invoice = { ...expected };
const matched = compareSettlementInvoice(invoice, expected);
assert.equal(matched.found, true);
assert.equal(matched.overall, true);
assert.deepEqual(matched.fields, {
  pda: true,
  ledger: true,
  invoiceNo: true,
  originalAmount: true,
  currency: true,
});

const missing = compareSettlementInvoice(null, expected);
assert.equal(missing.found, false);
assert.equal(missing.overall, false);
assert.ok(Object.values(missing.fields).every((value) => value === false));

for (const field of ["pubkey", "ledger", "invoiceNo", "originalAmount", "currency"] as const) {
  const mismatchedInvoice = {
    ...invoice,
    [field]: field === "originalAmount" ? 12501 : "different",
  };
  const result = compareSettlementInvoice(mismatchedInvoice, expected);
  const resultField = field === "pubkey" ? "pda" : field;
  assert.equal(result.overall, false, `${field} mismatch must fail the overall match`);
  assert.equal(result.fields[resultField], false, `${field} mismatch must identify its field`);
}
