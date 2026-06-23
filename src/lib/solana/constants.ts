import { PublicKey } from "@solana/web3.js";
import { env } from "@/lib/config/env";

export const PROGRAM_ID = new PublicKey(env.programId);
export const AP_SUBLEDGER_PROGRAM_ID = new PublicKey(env.apSubledgerProgramId);
export const ACCOUNTING_ENGINE_PROGRAM_ID = new PublicKey(env.accountingEngineProgramId);
export const SETTLEMENT_FACILITATOR_PROGRAM_ID = new PublicKey(env.settlementFacilitatorProgramId);

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
  postingDelegate: Buffer.from("posting-delegate"),
  settlementRoute: Buffer.from("settlement-route"),
  settlementDocument: Buffer.from("settlement-document"),
  settlementExecution: Buffer.from("settlement-execution"),
};
