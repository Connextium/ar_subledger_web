"use client";

import { AnchorProvider, BN, Program, type Idl } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { env } from "@/lib/config/env";
import type { EmbeddedWallet } from "@/lib/solana/embedded-wallet";
import idl from "@/lib/solana/ar_subledger.idl.json";

export const connection = new Connection(env.solanaRpcUrl, "confirmed");

export function getProgramId(): PublicKey {
  return new PublicKey(env.programId);
}

export function createAnchorProvider(wallet: EmbeddedWallet): AnchorProvider {
  return new AnchorProvider(connection, wallet as AnchorProvider["wallet"], {
    commitment: "confirmed",
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

export { BN };
