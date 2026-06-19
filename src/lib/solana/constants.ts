import { PublicKey } from "@solana/web3.js";
import { env } from "@/lib/config/env";

export const PROGRAM_ID = new PublicKey(env.programId);
export const AP_SUBLEDGER_PROGRAM_ID = new PublicKey(env.apSubledgerProgramId);
export const ACCOUNTING_ENGINE_PROGRAM_ID = new PublicKey(env.accountingEngineProgramId);

export const SEEDS = {
  ledger: Buffer.from("ledger"),
  gl: Buffer.from("gl"),
  journal: Buffer.from("journal"),
  customer: Buffer.from("customer"),
  invoice: Buffer.from("invoice"),
  receipt: Buffer.from("receipt"),
  credit: Buffer.from("credit"),
  writeoff: Buffer.from("writeoff"),
  buyerLedger: Buffer.from("buyer-ledger"),
  vendor: Buffer.from("vendor"),
  vendorInvoice: Buffer.from("vendor-invoice"),
  vendorPayment: Buffer.from("vendor-payment"),
};
