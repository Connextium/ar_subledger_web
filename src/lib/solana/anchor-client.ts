"use client";

import { AnchorProvider, BN, Program, type Idl } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { env } from "@/lib/config/env";
import type { EmbeddedWallet } from "@/lib/solana/embedded-wallet";
import idl from "@/lib/solana/ar_subledger.idl.json";
import apIdl from "@/lib/solana/ap_subledger.idl.json";
import settlementIdl from "@/lib/solana/settlement_facilitator.idl.json";
import accountingIdl from "@/lib/idl/accounting_engine.json";

export const connection = new Connection(env.solanaRpcUrl, {
  commitment: "confirmed",
  confirmTransactionInitialTimeout: 120_000, // 120 s — avoids the default 30 s timeout on busy validators
});

export function getProgramId(): PublicKey {
  return new PublicKey(env.programId);
}

export function createAnchorProvider(wallet: EmbeddedWallet): AnchorProvider {
  return new AnchorProvider(connection, wallet as AnchorProvider["wallet"], {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
}

export function createArSubledgerProgram(wallet: EmbeddedWallet): Program<Idl> {
  const provider = createAnchorProvider(wallet);
  const runtimeIdl = {
    ...(idl as Idl & { address?: string }),
    // Force runtime program ID from env so frontend is not blocked by stale copied IDL address.
    address: env.programId,
  };
  return new Program(runtimeIdl as Idl, provider);
}

export function createApSubledgerProgram(wallet: EmbeddedWallet): Program<Idl> {
  const provider = createAnchorProvider(wallet);
  const runtimeIdl = {
    ...(apIdl as Idl & { address?: string }),
    address: env.apSubledgerProgramId,
  };
  return new Program(runtimeIdl as Idl, provider);
}

export function createSettlementFacilitatorProgram(wallet: EmbeddedWallet): Program<Idl> {
  const provider = createAnchorProvider(wallet);
  const runtimeIdl = {
    ...(settlementIdl as Idl & { address?: string }),
    address: env.settlementFacilitatorProgramId,
  };
  return new Program(runtimeIdl as Idl, provider);
}

export function createAccountingEngineProgram(wallet: EmbeddedWallet): Program<Idl> {
  const provider = createAnchorProvider(wallet);
  const runtimeIdl = {
    ...(accountingIdl as Idl & { address?: string }),
    address: env.accountingEngineProgramId,
  };
  return new Program(runtimeIdl as Idl, provider);
}

export { BN };
