import { PublicKey } from "@solana/web3.js";
import { env } from "@/lib/config/env";

export const PROGRAM_ID = new PublicKey(env.programId);

export const SEEDS = {
  ledger: Buffer.from("ledger"),
  customer: Buffer.from("customer"),
  invoice: Buffer.from("invoice"),
  receipt: Buffer.from("receipt"),
  credit: Buffer.from("credit"),
  writeoff: Buffer.from("writeoff"),
};
