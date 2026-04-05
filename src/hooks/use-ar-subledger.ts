"use client";

import { useMemo } from "react";
import { createArSubledgerService } from "@/services/ar-subledger-service";
import { useEmbeddedWallet } from "@/context/embedded-wallet-context";

export function useArSubledger() {
  const { wallet } = useEmbeddedWallet();

  const service = useMemo(() => {
    if (!wallet) return null;
    return createArSubledgerService(wallet);
  }, [wallet]);

  return service;
}
