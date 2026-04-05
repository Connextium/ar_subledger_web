"use client";

import { useWorkspace } from "@/context/workspace-context";

export function useRoleGate() {
  const { role } = useWorkspace();

  return {
    role,
    canManageWorkspace: role === "admin",
    canWriteTransactions: role === "admin" || role === "accountant",
    isViewer: role === "viewer",
  };
}
