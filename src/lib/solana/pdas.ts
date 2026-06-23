import { PublicKey } from "@solana/web3.js";
import {
  ACCOUNTING_ENGINE_PROGRAM_ID,
  AP_SUBLEDGER_PROGRAM_ID,
  PROGRAM_ID,
  SETTLEMENT_FACILITATOR_PROGRAM_ID,
  SEEDS,
} from "@/lib/solana/constants";

function u64ToLeBuffer(value: bigint): Buffer {
  if (value < 0n) {
    throw new Error("Sequence must be non-negative.");
  }

  const maxU64 = (1n << 64n) - 1n;
  if (value > maxU64) {
    throw new Error("Sequence exceeds u64 range.");
  }

  const buf = Buffer.alloc(8);
  let remaining = value;
  for (let i = 0; i < 8; i += 1) {
    buf[i] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }

  return buf;
}

export function deriveLedgerPda(authority: PublicKey, ledgerCode: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.ledger, authority.toBuffer(), Buffer.from(ledgerCode)],
    PROGRAM_ID,
  );
}

export function deriveAccountingLedgerPda(
  authority: PublicKey,
  ledgerCode: string,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.ledger, authority.toBuffer(), Buffer.from(ledgerCode)],
    ACCOUNTING_ENGINE_PROGRAM_ID,
  );
}

export function deriveGlAccountPda(accountingLedger: PublicKey, code: number): [PublicKey, number] {
  const codeBuf = Buffer.alloc(4);
  codeBuf.writeUInt32LE(code, 0);
  return PublicKey.findProgramAddressSync(
    [SEEDS.gl, accountingLedger.toBuffer(), codeBuf],
    ACCOUNTING_ENGINE_PROGRAM_ID,
  );
}

export function deriveJournalEntryPda(
  accountingLedger: PublicKey,
  entryId: bigint,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.journal, accountingLedger.toBuffer(), u64ToLeBuffer(entryId)],
    ACCOUNTING_ENGINE_PROGRAM_ID,
  );
}

export function derivePostingDelegatePda(
  accountingLedger: PublicKey,
  delegate: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.postingDelegate, accountingLedger.toBuffer(), delegate.toBuffer()],
    ACCOUNTING_ENGINE_PROGRAM_ID,
  );
}

export function deriveCustomerPda(ledger: PublicKey, customerCode: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.customer, ledger.toBuffer(), Buffer.from(customerCode)],
    PROGRAM_ID,
  );
}

export function deriveInvoicePda(ledger: PublicKey, invoiceNo: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.invoice, ledger.toBuffer(), Buffer.from(invoiceNo)],
    PROGRAM_ID,
  );
}

export function deriveReceiptPda(invoice: PublicKey, seq: bigint): [PublicKey, number] {
  const seqBuf = u64ToLeBuffer(seq);
  return PublicKey.findProgramAddressSync([SEEDS.receipt, invoice.toBuffer(), seqBuf], PROGRAM_ID);
}

export function deriveCreditPda(invoice: PublicKey, seq: bigint): [PublicKey, number] {
  const seqBuf = u64ToLeBuffer(seq);
  return PublicKey.findProgramAddressSync([SEEDS.credit, invoice.toBuffer(), seqBuf], PROGRAM_ID);
}

export function deriveWriteOffPda(invoice: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([SEEDS.writeoff, invoice.toBuffer()], PROGRAM_ID);
}

export function deriveBuyerLedgerPda(authority: PublicKey, ledgerCode: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.buyerLedger, authority.toBuffer(), Buffer.from(ledgerCode)],
    AP_SUBLEDGER_PROGRAM_ID,
  );
}

export function deriveVendorPda(ledger: PublicKey, vendorCode: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.vendor, ledger.toBuffer(), Buffer.from(vendorCode)],
    AP_SUBLEDGER_PROGRAM_ID,
  );
}

export function deriveVendorInvoicePda(ledger: PublicKey, invoiceNo: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.vendorInvoice, ledger.toBuffer(), Buffer.from(invoiceNo)],
    AP_SUBLEDGER_PROGRAM_ID,
  );
}

export function deriveVendorPaymentPda(invoice: PublicKey, seq: bigint): [PublicKey, number] {
  const seqBuf = u64ToLeBuffer(seq);
  return PublicKey.findProgramAddressSync(
    [SEEDS.vendorPayment, invoice.toBuffer(), seqBuf],
    AP_SUBLEDGER_PROGRAM_ID,
  );
}

export function deriveSettlementRoutePda(
  facilitator: PublicKey,
  routeCode: string,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.settlementRoute, facilitator.toBuffer(), Buffer.from(routeCode)],
    SETTLEMENT_FACILITATOR_PROGRAM_ID,
  );
}

export function deriveSettlementDocumentPda(
  route: PublicKey,
  documentHash: string,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.settlementDocument, route.toBuffer(), Buffer.from(documentHash)],
    SETTLEMENT_FACILITATOR_PROGRAM_ID,
  );
}

export function deriveSettlementExecutionPda(
  document: PublicKey,
  settlementSeq: bigint,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.settlementExecution, document.toBuffer(), u64ToLeBuffer(settlementSeq)],
    SETTLEMENT_FACILITATOR_PROGRAM_ID,
  );
}
