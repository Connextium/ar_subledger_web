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

export function compareSettlementInvoice(
  invoice: MatchableSettlementInvoice | null,
  expected: ExpectedSettlementInvoice,
): SettlementInvoiceMatch {
  const fields = {
    pda: invoice?.pubkey === expected.pubkey,
    ledger: invoice?.ledger === expected.ledger,
    invoiceNo: invoice?.invoiceNo === expected.invoiceNo,
    originalAmount: invoice?.originalAmount === expected.originalAmount,
    currency: invoice?.currency === expected.currency,
  };

  return {
    found: invoice !== null,
    overall: invoice !== null && Object.values(fields).every(Boolean),
    fields,
  };
}
