import {
  createCustomerSchema,
  createWorkspaceCustomerSchema,
  linkWorkspaceCustomerToLedgerSchema,
  recordReceiptSchema,
  updateWorkspaceCustomerSchema,
} from "@/lib/validation/schemas";

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const createResult = createWorkspaceCustomerSchema.safeParse({
  workspaceId: "11111111-1111-4111-8111-111111111111",
  customerRef: "",
  legalName: "",
  status: "active",
});

if (createResult.success) {
  throw new Error("createWorkspaceCustomerSchema should reject blank recipient fields");
}

assertEqual(createResult.error.issues[0]?.message, "Recipient reference is required.", "create recipient ref message");
assertEqual(
  createResult.error.issues[1]?.message,
  "Legal name is only required when creating a new recipient. Select an existing invoice customer, or enter the recipient legal name to create one.",
  "create recipient legal name message",
);

const updateResult = updateWorkspaceCustomerSchema.safeParse({
  id: "22222222-2222-4222-8222-222222222222",
  workspaceId: "11111111-1111-4111-8111-111111111111",
  customerRef: "",
  legalName: "",
  status: "active",
});

if (updateResult.success) {
  throw new Error("updateWorkspaceCustomerSchema should reject blank recipient fields");
}

assertEqual(updateResult.error.issues[0]?.message, "Recipient reference is required.", "update recipient ref message");
assertEqual(
  updateResult.error.issues[1]?.message,
  "Legal name is only required when creating a new recipient. Select an existing invoice customer, or enter the recipient legal name to create one.",
  "update recipient legal name message",
);

const linkResult = linkWorkspaceCustomerToLedgerSchema.safeParse({
  workspaceId: "11111111-1111-4111-8111-111111111111",
  workspaceCustomerId: "33333333-3333-4333-8333-333333333333",
  ledgerPda: "",
  onchainCustomerPubkey: "",
  customerCode: "BUYER-001",
});

if (linkResult.success) {
  throw new Error("linkWorkspaceCustomerToLedgerSchema should reject blank recipient link fields");
}

assertEqual(linkResult.error.issues[0]?.message, "Select a ledger before linking a recipient.", "recipient link ledger message");
assertEqual(
  linkResult.error.issues[1]?.message,
  "On-chain recipient account is required when linking a recipient to a ledger.",
  "recipient link on-chain account message",
);

const onchainResult = createCustomerSchema.safeParse({
  ledgerPubkey: "",
  customerCode: "",
  customerName: "",
  creditLimit: 0,
});

if (onchainResult.success) {
  throw new Error("createCustomerSchema should reject blank on-chain recipient fields");
}

assertEqual(onchainResult.error.issues[0]?.message, "Select a ledger before creating an on-chain recipient.", "on-chain recipient ledger message");
assertEqual(onchainResult.error.issues[1]?.message, "Recipient code is required.", "on-chain recipient code message");
assertEqual(onchainResult.error.issues[2]?.message, "Recipient name is required.", "on-chain recipient name message");

const receiptResult = recordReceiptSchema.safeParse({
  ledgerPubkey: "ledger",
  customerPubkey: "customer",
  invoicePubkey: "invoice",
  receiptSeq: 1,
  receiptNo: "",
  amount: 100,
  receiptDate: "",
  paymentReference: "",
});

if (receiptResult.success) {
  throw new Error("recordReceiptSchema should reject blank receipt fields");
}

assertEqual(receiptResult.error.issues[0]?.message, "Receipt number is required.", "record receipt number message");
assertEqual(receiptResult.error.issues[1]?.message, "Receipt date is required.", "record receipt date message");
