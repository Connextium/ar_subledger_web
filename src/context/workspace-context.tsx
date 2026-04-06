"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AppRole, Workspace, WorkspaceLedgerLink } from "@/lib/types/domain";
import { useAuth } from "@/context/auth-context";
import { env } from "@/lib/config/env";
import { supabase } from "@/lib/supabase/client";
import { controlPlaneService } from "@/services/control-plane-service";

type WorkspaceContextValue = {
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  role: AppRole;
  ledgerLinks: WorkspaceLedgerLink[];
  loading: boolean;
  selectWorkspace: (workspaceId: string | null) => void;
  refresh: () => Promise<void>;
  createWorkspace: (name: string) => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [role, setRole] = useState<AppRole>("admin");
  const [ledgerLinks, setLedgerLinks] = useState<WorkspaceLedgerLink[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setWorkspaces([]);
      setSelectedWorkspaceId(null);
      setLedgerLinks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const workspaceRows = await controlPlaneService.listWorkspaces(user.id);
    setWorkspaces(workspaceRows);

    const current = selectedWorkspaceId ?? workspaceRows[0]?.id ?? null;
    setSelectedWorkspaceId(current);

    if (current) {
      const [nextRole, links] = await Promise.all([
        controlPlaneService.getRole(current, user.id),
        controlPlaneService.listLedgerLinks(current),
      ]);

      setRole(nextRole);
      setLedgerLinks(links);
    } else {
      setRole("admin");
      setLedgerLinks([]);
    }

    setLoading(false);
  }, [selectedWorkspaceId, user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!env.supabaseUrl || !env.supabaseAnonKey) return;
    if (!user || !selectedWorkspaceId) return;

    let cancelled = false;
    void (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const accessToken = session?.access_token;
        if (!accessToken || cancelled) return;

        await fetch("/api/wallets/bootstrap", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ workspaceId: selectedWorkspaceId }),
        });
      } catch {
        // Phase C bootstrap failures should not block workspace load.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedWorkspaceId, user]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces,
      selectedWorkspaceId,
      role,
      ledgerLinks,
      loading,
      selectWorkspace: setSelectedWorkspaceId,
      refresh,
      async createWorkspace(name: string) {
        if (!user) return;
        const workspace = await controlPlaneService.createWorkspace(name, user.id);
        if (workspace) {
          setSelectedWorkspaceId(workspace.id);
        }
        await refresh();
      },
    }),
    [ledgerLinks, loading, refresh, role, selectedWorkspaceId, user, workspaces],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
}
