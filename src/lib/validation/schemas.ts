import { z } from "zod";

const RECIPIENT_LEGAL_NAME_REQUIRED_MESSAGE =
  "Legal name is only required when creating a new recipient. Select an existing invoice customer, or enter the recipient legal name to create one.";

export const workspaceCustomerCodeSchema = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[A-Z0-9][A-Z0-9_-]*$/, "Customer code must use A-Z, 0-9, '_' or '-' only");

export const createWorkspaceCustomerSchema = z.object({
  workspaceId: z.string().uuid(),
  customerRef: z.string().trim().min(1, "Recipient reference is required.").max(64),
  legalName: z.string().trim().min(1, RECIPIENT_LEGAL_NAME_REQUIRED_MESSAGE).max(160),
  taxId: z.string().trim().max(64).optional(),
  status: z.enum(["active", "inactive", "archived"]).default("active"),
});

export const updateWorkspaceCustomerSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  customerRef: z.string().trim().min(1, "Recipient reference is required.").max(64).optional(),
  legalName: z.string().trim().min(1, RECIPIENT_LEGAL_NAME_REQUIRED_MESSAGE).max(160).optional(),
  taxId: z.string().trim().max(64).optional().nullable(),
  status: z.enum(["active", "inactive", "archived"]).optional(),
});

export const reserveWorkspaceCustomerCodeSchema = z.object({
  workspaceId: z.string().uuid(),
  customerCode: workspaceCustomerCodeSchema,
  workspaceCustomerId: z.string().uuid(),
  status: z.enum(["reserved", "released"]).default("reserved"),
});

export const linkWorkspaceCustomerToLedgerSchema = z.object({
  workspaceId: z.string().uuid(),
  workspaceCustomerId: z.string().uuid(),
  ledgerPda: z.string().min(1, "Select a ledger before linking a recipient."),
  onchainCustomerPubkey: z
    .string()
    .min(1, "On-chain recipient account is required when linking a recipient to a ledger."),
  customerCode: workspaceCustomerCodeSchema,
  status: z.enum(["active", "inactive"]).default("active"),
});

export const initializeLedgerSchema = z.object({
  ledgerCode: z
    .string()
    .trim()
    .min(1)
    .max(24)
    .regex(/^AR-[A-Z]{2,8}-\d{4}$/),
  accountingLedgerPubkey: z.string().trim().min(32),
  arControlAccountCode: z.coerce.number().int().positive(),
  revenueAccountCode: z.coerce.number().int().positive(),
  cashAccountCode: z.coerce.number().int().positive(),
  writeoffExpenseAccountCode: z.coerce.number().int().positive(),
});

export const createCustomerSchema = z.object({
  ledgerPubkey: z.string().min(1, "Select a ledger before creating an on-chain recipient."),
  customerCode: z.string().trim().min(1, "Recipient code is required.").max(32),
  customerName: z.string().trim().min(1, "Recipient name is required.").max(80),
  creditLimit: z.coerce.number().min(0),
});

export const updateCustomerSchema = z.object({
  ledgerPubkey: z.string().min(1),
  customerPubkey: z.string().min(1),
  status: z.coerce.number().int().refine((v) => v === 1 || v === 2, {
    message: "Status must be Enable or Disable",
  }),
  creditLimit: z.coerce.number().min(0),
});

export const issueInvoiceSchema = z
  .object({
    ledgerPubkey: z.string().min(1, "Select a ledger before issuing an invoice."),
    customerPubkey: z.string().min(1, "Select a linked customer before issuing an invoice."),
    invoiceNo: z.string().trim().min(1, "Invoice number is required.").max(40),
    amount: z.coerce.number().positive(),
    issueDate: z.string().min(1, "Issue date is required."),
    dueDate: z.string().min(1, "Due date is required."),
    currency: z.string().trim().min(1, "Currency is required.").max(12),
    description: z.string().max(160),
  })
  .refine((v) => new Date(v.dueDate).getTime() >= new Date(v.issueDate).getTime(), {
    message: "Due date cannot be before issue date",
    path: ["dueDate"],
  });

export const recordReceiptSchema = z.object({
  ledgerPubkey: z.string().min(1, "Select a ledger before recording a receipt."),
  customerPubkey: z.string().min(1, "Select a linked customer before recording a receipt."),
  invoicePubkey: z.string().min(1, "Select an invoice before recording a receipt."),
  receiptSeq: z.coerce.number().int().positive(),
  receiptNo: z.string().trim().min(1, "Receipt number is required.").max(40),
  amount: z.coerce.number().positive(),
  receiptDate: z.string().min(1, "Receipt date is required."),
  paymentReference: z.string().max(64),
});

export const issueCreditNoteSchema = z.object({
  ledgerPubkey: z.string().min(1, "Select a ledger before issuing a credit note."),
  customerPubkey: z.string().min(1, "Select a linked customer before issuing a credit note."),
  invoicePubkey: z.string().min(1, "Select an invoice before issuing a credit note."),
  creditSeq: z.coerce.number().int().positive(),
  creditNo: z.string().trim().min(1, "Credit note number is required.").max(40),
  amount: z.coerce.number().positive(),
  creditDate: z.string().min(1, "Credit note date is required."),
  reason: z.string().max(160),
});

export const writeOffSchema = z.object({
  ledgerPubkey: z.string().min(1, "Select a ledger before writing off an invoice."),
  customerPubkey: z.string().min(1, "Select a linked customer before writing off an invoice."),
  invoicePubkey: z.string().min(1, "Select an invoice before writing it off."),
  amount: z.coerce.number().positive(),
  writeoffDate: z.string().min(1, "Write-off date is required."),
  reason: z.string().max(160),
});

export const closeInvoiceSchema = z.object({
  ledgerPubkey: z.string().min(1, "Select a ledger before closing an invoice."),
  customerPubkey: z.string().min(1, "Select a linked customer before closing an invoice."),
  invoicePubkey: z.string().min(1, "Select an invoice before closing it."),
});

export const initializeBuyerLedgerSchema = z.object({
  ledgerCode: z
    .string()
    .trim()
    .min(1)
    .max(24)
    .regex(/^AP-[A-Z]{2,8}-\d{4}$/, "Buyer AP ledger code must use AP-{REGION}-{YYYY}"),
  accountingLedgerPubkey: z.string().trim().min(32),
  apControlAccountCode: z.coerce.number().int().positive(),
  purchaseAccountCode: z.coerce.number().int().positive(),
  cashAccountCode: z.coerce.number().int().positive(),
});

export const createVendorSchema = z.object({
  vendorCode: z.string().trim().min(1).max(32),
  vendorName: z.string().trim().min(1).max(80),
});

export const receiveVendorInvoiceSchema = z.object({
  invoiceNo: z.string().trim().min(1).max(40),
  amount: z.string().trim().min(1),
  invoiceDate: z.string().trim().min(1),
  dueDate: z.string().trim().min(1),
  currency: z.string().trim().min(1).max(12),
  description: z.string().max(160),
  documentHash: z.string().max(88),
});

export const payVendorInvoiceSchema = z.object({
  paymentNo: z.string().trim().min(1).max(40),
  amount: z.string().trim().min(1),
  paymentDate: z.string().trim().min(1),
  paymentReference: z.string().max(64),
});

export const initializeSettlementRouteSchema = z.object({
  routeCode: z.string().trim().min(1).max(32),
  buyerApLedgerPubkey: z.string().trim().min(32),
  supplierArLedgerPubkey: z.string().trim().min(32),
});

export const registerSettlementDocumentSchema = z.object({
  routePubkey: z.string().trim().min(32),
  invoiceNo: z.string().trim().min(1).max(40),
  documentHash: z.string().trim().min(1).max(88),
  currency: z.string().trim().min(1).max(12),
  originalAmount: z.coerce.number().int().positive(),
});

export const executeSettlementSchema = z.object({
  routePubkey: z.string().trim().min(32),
  documentPubkey: z.string().trim().min(32),
  settlementSeq: z.coerce.number().int().positive(),
  amount: z.coerce.number().int().positive(),
  memo: z.string().max(160),
});
