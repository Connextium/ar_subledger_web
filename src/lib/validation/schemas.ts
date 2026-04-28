import { z } from "zod";

export const workspaceCustomerCodeSchema = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[A-Z0-9][A-Z0-9_-]*$/, "Customer code must use A-Z, 0-9, '_' or '-' only");

export const createWorkspaceCustomerSchema = z.object({
  workspaceId: z.string().uuid(),
  customerRef: z.string().trim().min(1).max(64),
  legalName: z.string().trim().min(1).max(160),
  taxId: z.string().trim().max(64).optional(),
  status: z.enum(["active", "inactive", "archived"]).default("active"),
});

export const updateWorkspaceCustomerSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  customerRef: z.string().trim().min(1).max(64).optional(),
  legalName: z.string().trim().min(1).max(160).optional(),
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
  ledgerPda: z.string().min(1),
  onchainCustomerPubkey: z.string().min(1),
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
  ledgerPubkey: z.string().min(1),
  customerCode: z.string().trim().min(1).max(32),
  customerName: z.string().trim().min(1).max(80),
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
    ledgerPubkey: z.string().min(1),
    customerPubkey: z.string().min(1),
    invoiceNo: z.string().trim().min(1).max(40),
    amount: z.coerce.number().positive(),
    issueDate: z.string().min(1),
    dueDate: z.string().min(1),
    currency: z.string().trim().min(1).max(12),
    description: z.string().max(160),
  })
  .refine((v) => new Date(v.dueDate).getTime() >= new Date(v.issueDate).getTime(), {
    message: "Due date cannot be before issue date",
    path: ["dueDate"],
  });

export const recordReceiptSchema = z.object({
  ledgerPubkey: z.string().min(1),
  customerPubkey: z.string().min(1),
  invoicePubkey: z.string().min(1),
  receiptSeq: z.coerce.number().int().positive(),
  receiptNo: z.string().trim().min(1).max(40),
  amount: z.coerce.number().positive(),
  receiptDate: z.string().min(1),
  paymentReference: z.string().max(64),
});

export const issueCreditNoteSchema = z.object({
  ledgerPubkey: z.string().min(1),
  customerPubkey: z.string().min(1),
  invoicePubkey: z.string().min(1),
  creditSeq: z.coerce.number().int().positive(),
  creditNo: z.string().trim().min(1).max(40),
  amount: z.coerce.number().positive(),
  creditDate: z.string().min(1),
  reason: z.string().max(160),
});

export const writeOffSchema = z.object({
  ledgerPubkey: z.string().min(1),
  customerPubkey: z.string().min(1),
  invoicePubkey: z.string().min(1),
  amount: z.coerce.number().positive(),
  writeoffDate: z.string().min(1),
  reason: z.string().max(160),
});

export const closeInvoiceSchema = z.object({
  ledgerPubkey: z.string().min(1),
  customerPubkey: z.string().min(1),
  invoicePubkey: z.string().min(1),
});
