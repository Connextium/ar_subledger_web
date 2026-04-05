import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID, SEEDS } from "@/lib/solana/constants";

export function deriveLedgerPda(authority: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([SEEDS.ledger, authority.toBuffer()], PROGRAM_ID);
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
  const seqBuf = Buffer.alloc(8);
  seqBuf.writeBigUInt64LE(seq);
  return PublicKey.findProgramAddressSync([SEEDS.receipt, invoice.toBuffer(), seqBuf], PROGRAM_ID);
}

export function deriveCreditPda(invoice: PublicKey, seq: bigint): [PublicKey, number] {
  const seqBuf = Buffer.alloc(8);
  seqBuf.writeBigUInt64LE(seq);
  return PublicKey.findProgramAddressSync([SEEDS.credit, invoice.toBuffer(), seqBuf], PROGRAM_ID);
}

export function deriveWriteOffPda(invoice: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([SEEDS.writeoff, invoice.toBuffer()], PROGRAM_ID);
}
