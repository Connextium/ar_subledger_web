export type ExpectedSettlementInvoice = {
  pubkey: string;
  ledger: string;
  invoiceNo: string;
  originalAmount: number;
  currency: string;
};

export type MatchableSettlementInvoice = ExpectedSettlementInvoice;

export type SettlementInvoiceMatch = {
  found: boolean;
  overall: boolean;
  fields: {
    pda: boolean;
    ledger: boolean;
    invoiceNo: boolean;
    originalAmount: boolean;
    currency: boolean;
  };
};

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

export function compareSettlementInvoice(
  invoice: MatchableSettlementInvoice | null,
  expected: ExpectedSettlementInvoice,
): SettlementInvoiceMatch {
  const expectedPubkey = expected.pubkey.trim();
  const expectedLedger = expected.ledger.trim();
  const expectedInvoiceNo = normalizeText(expected.invoiceNo);
  const expectedCurrency = normalizeText(expected.currency);

  const fields = {
    pda: expectedPubkey.length === 0 ? true : invoice?.pubkey === expectedPubkey,
    ledger: expectedLedger.length === 0 ? true : invoice?.ledger === expectedLedger,
    invoiceNo: normalizeText(invoice?.invoiceNo ?? "") === expectedInvoiceNo,
    originalAmount: invoice?.originalAmount === expected.originalAmount,
    currency: normalizeText(invoice?.currency ?? "") === expectedCurrency,
  };

  return {
    found: invoice !== null,
    overall: invoice !== null && Object.values(fields).every(Boolean),
    fields,
  };
}
