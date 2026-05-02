const AR_ERROR_MESSAGES: Record<string, string> = {
  InvalidLedgerCode: "Ledger code is invalid.",
  InvalidCustomerCode: "Customer code is invalid.",
  InvalidCustomerName: "Customer name is invalid.",
  InvalidCustomerStatus: "Customer status is invalid.",
  InvalidInvoiceNo: "Invoice number is invalid.",
  InvalidReceiptNo: "Receipt number is invalid.",
  InvalidCreditNo: "Credit note number is invalid.",
  InvalidCurrency: "Currency must be non-empty and <= 12 chars.",
  DescriptionTooLong: "Description exceeds max length.",
  ReasonTooLong: "Reason exceeds max length.",
  PaymentReferenceTooLong: "Payment reference exceeds max length.",
  InvalidAmount: "Amount must be greater than zero.",
  InvalidDueDate: "Due date must be on/after issue date.",
  CustomerInactive: "Customer is not active.",
  CreditLimitExceeded: "Credit limit would be exceeded.",
  CreditLimitBelowOutstanding: "Credit limit cannot be lower than current outstanding balance.",
  CustomerLedgerMismatch: "Customer does not belong to selected ledger.",
  InvoiceLedgerMismatch: "Invoice does not belong to selected ledger.",
  InvoiceCustomerMismatch: "Invoice does not belong to selected customer.",
  InvoiceNotReceivable: "Invoice is not in receivable state.",
  InvoiceNotCreditable: "Invoice is not creditable.",
  InvoiceNotWriteOffEligible: "Invoice cannot be written off in current state.",
  AmountExceedsOpenBalance: "Amount exceeds invoice open balance.",
  InvoiceStillOpen: "Invoice still has open amount.",
  InvoiceNotClosable: "Invoice status does not allow close.",
  InvalidSequence: "Sequence value is invalid.",
  WriteOffAlreadyExists: "A write-off already exists for this invoice.",
  MathOverflow: "Arithmetic overflow occurred.",
};

export function mapAnchorError(error: unknown): string {
  if (!(error instanceof Error)) return "Transaction failed unexpectedly.";
  const message = error.message;

  if (message.includes("Instruction: RecordReceipt") && message.includes("already in use")) {
    return "Receipt sequence already exists for this invoice. Increase Seq and try again.";
  }

  for (const [code, pretty] of Object.entries(AR_ERROR_MESSAGES)) {
    if (message.includes(code)) {
      return pretty;
    }
  }
  return message;
}
