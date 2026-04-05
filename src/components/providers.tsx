"use client";

import { useEffect } from "react";
import { Buffer } from "buffer";
import { AuthProvider } from "@/context/auth-context";
import { EmbeddedWalletProvider } from "@/context/embedded-wallet-context";
import { WorkspaceProvider } from "@/context/workspace-context";
import { assertRequiredEnv } from "@/lib/config/env";

export function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Ensure Anchor/browser libs find Buffer in client runtime.
    if (typeof window !== "undefined") {
      const browserWindow = window as Window & { Buffer?: typeof Buffer };
      browserWindow.Buffer = browserWindow.Buffer ?? Buffer;
    }
    assertRequiredEnv();
  }, []);

  return (
    <AuthProvider>
      <EmbeddedWalletProvider>
        <WorkspaceProvider>{children}</WorkspaceProvider>
      </EmbeddedWalletProvider>
    </AuthProvider>
  );
}
