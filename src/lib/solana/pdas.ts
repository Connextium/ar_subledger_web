import { PublicKey } from "@solana/web3.js";
import { ACCOUNTING_ENGINE_PROGRAM_ID, PROGRAM_ID, SEEDS } from "@/lib/solana/constants";

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
