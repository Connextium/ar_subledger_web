"use client";

import { useMemo } from "react";
import { createArSubledgerService } from "@/lib/api-client/v1/supplier";
import { useEmbeddedWallet } from "@/context/embedded-wallet-context";

export function useArSubledger() {
  const { wallet } = useEmbeddedWallet();

  const service = useMemo(() => {
    if (!wallet) return null;
    return createArSubledgerService(wallet);
  }, [wallet]);

  return service;
}
