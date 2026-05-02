"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useWorkspace } from "@/context/workspace-context";
import { controlPlaneService } from "@/services/control-plane-service";
import type { WorkspaceCustomer, WorkspaceLedgerLink } from "@/lib/types/domain";

const WORKING_CONTEXT_STORAGE_KEY = "ar:working-context";

type WorkingContextValue = {
  workspaceId: string | null;
  ledgerPda: string | null;
  customerId: string | null;
  invoicePubkey: string | null;
  ledgerOptions: WorkspaceLedgerLink[];
  customerOptions: WorkspaceCustomer[];
  refreshCustomerOptions: () => Promise<void>;
  setLedgerPda: (ledgerPda: string | null) => void;
  setCustomerId: (customerId: string | null) => void;
  setInvoicePubkey: (invoicePubkey: string | null) => void;
  clearContext: () => void;
};

const WorkingContext = createContext<WorkingContextValue | null>(null);

type WorkingContextState = {
  workspaceId: string | null;
  ledgerPda: string | null;
  customerId: string | null;
  invoicePubkey: string | null;
  customerOptions: WorkspaceCustomer[];
};

type WorkingContextAction =
  | {
      type: "sync_from_query";
      payload: {
        workspaceId?: string | null;
        ledgerPda?: string | null;
        customerId?: string | null;
        invoicePubkey?: string | null;
      };
    }
  | {
      type: "hydrate_from_storage";
      payload: {
        workspaceId?: string | null;
        ledgerPda?: string | null;
        customerId?: string | null;
        invoicePubkey?: string | null;
      };
    }
  | { type: "sync_workspace_from_top"; payload: { workspaceId: string | null } }
  | { type: "set_customer_options"; payload: { customerOptions: WorkspaceCustomer[] } }
  | { type: "set_ledger"; payload: { ledgerPda: string | null } }
  | { type: "set_customer"; payload: { customerId: string | null } }
  | { type: "set_invoice"; payload: { invoicePubkey: string | null } }
  | { type: "clear_context" }
  | { type: "clear_invalid_ledger" }
  | { type: "clear_invalid_customer" };

const initialState: WorkingContextState = {
  workspaceId: null,
  ledgerPda: null,
  customerId: null,
  invoicePubkey: null,
  customerOptions: [],
};

function reducer(state: WorkingContextState, action: WorkingContextAction): WorkingContextState {
  switch (action.type) {
    case "sync_from_query": {
      const { workspaceId, ledgerPda, customerId, invoicePubkey } = action.payload;
      return {
        ...state,
        workspaceId: workspaceId !== undefined ? workspaceId : state.workspaceId,
        ledgerPda: ledgerPda !== undefined ? ledgerPda : state.ledgerPda,
        customerId: customerId !== undefined ? customerId : state.customerId,
        invoicePubkey: invoicePubkey !== undefined ? invoicePubkey : state.invoicePubkey,
      };
    }
    case "hydrate_from_storage": {
      const { workspaceId, ledgerPda, customerId, invoicePubkey } = action.payload;
      return {
        ...state,
        workspaceId: workspaceId !== undefined ? workspaceId : state.workspaceId,
        ledgerPda: ledgerPda !== undefined ? ledgerPda : state.ledgerPda,
        customerId: customerId !== undefined ? customerId : state.customerId,
        invoicePubkey: invoicePubkey !== undefined ? invoicePubkey : state.invoicePubkey,
      };
    }
    case "sync_workspace_from_top":
      if (state.workspaceId === action.payload.workspaceId) return state;
      return {
        ...state,
        workspaceId: action.payload.workspaceId,
        ledgerPda: null,
        customerId: null,
        invoicePubkey: null,
      };
    case "set_customer_options":
      return { ...state, customerOptions: action.payload.customerOptions };
    case "set_ledger":
      return {
        ...state,
        ledgerPda: action.payload.ledgerPda,
        customerId: null,
        invoicePubkey: null,
      };
    case "set_customer":
      return { ...state, customerId: action.payload.customerId, invoicePubkey: null };
    case "set_invoice":
      return { ...state, invoicePubkey: action.payload.invoicePubkey };
    case "clear_context":
      return { ...state, ledgerPda: null, customerId: null, invoicePubkey: null };
    case "clear_invalid_ledger":
      return { ...state, ledgerPda: null, customerId: null, invoicePubkey: null };
    case "clear_invalid_customer":
      return { ...state, customerId: null, invoicePubkey: null };
    default:
      return state;
  }
}

function normalize(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function WorkingContextProvider({ children }: { children: React.ReactNode }) {
  const { selectedWorkspaceId, ledgerLinks } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [state, dispatch] = useReducer(reducer, initialState);
  const { workspaceId, ledgerPda, customerId, invoicePubkey, customerOptions } = state;

  const refreshCustomerOptions = useCallback(async () => {
    if (!workspaceId) {
      dispatch({ type: "set_customer_options", payload: { customerOptions: [] } });
      return;
    }

    const [rows, links] = await Promise.all([
      controlPlaneService.listWorkspaceCustomers(workspaceId),
      controlPlaneService.listWorkspaceCustomerLedgerLinks({ workspaceId }),
    ]);

    const scopedRows = ledgerPda
      ? rows.filter((customer) =>
          links.some(
            (link) =>
              link.workspaceCustomerId === customer.id &&
              link.ledgerPda === ledgerPda &&
              link.status === "active",
          ),
        )
      : rows;

    dispatch({ type: "set_customer_options", payload: { customerOptions: scopedRows } });
  }, [ledgerPda, workspaceId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem(WORKING_CONTEXT_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<{
        workspaceId: string | null;
        ledgerPda: string | null;
        customerId: string | null;
        invoicePubkey: string | null;
      }>;
      dispatch({
        type: "hydrate_from_storage",
        payload: {
          workspaceId: parsed.workspaceId,
          ledgerPda: parsed.ledgerPda,
          customerId: parsed.customerId,
          invoicePubkey: parsed.invoicePubkey,
        },
      });
    } catch {
      // Ignore malformed stored context and continue with defaults.
    }
  }, []);

  useEffect(() => {
    const hasLedger = searchParams.has("ledger");
    const hasCustomer = searchParams.has("customer");
    const hasInvoice = searchParams.has("invoice");

    // Workspace context is controlled by top workspace selector.
    // Ignore `workspace` query param for in-memory context to avoid duplicate selectors drifting.
    const qpLedger = hasLedger ? normalize(searchParams.get("ledger")) : undefined;
    const qpCustomer = hasCustomer ? normalize(searchParams.get("customer")) : undefined;
    const qpInvoice = hasInvoice ? normalize(searchParams.get("invoice")) : undefined;

    dispatch({
      type: "sync_from_query",
      payload: {
        ledgerPda: qpLedger,
        customerId: qpCustomer,
        invoicePubkey: qpInvoice,
      },
    });
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      WORKING_CONTEXT_STORAGE_KEY,
      JSON.stringify({ workspaceId, ledgerPda, customerId, invoicePubkey }),
    );
  }, [workspaceId, ledgerPda, customerId, invoicePubkey]);

  useEffect(() => {
    dispatch({ type: "sync_workspace_from_top", payload: { workspaceId: selectedWorkspaceId } });
  }, [selectedWorkspaceId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!workspaceId) {
        if (!cancelled) {
          dispatch({ type: "set_customer_options", payload: { customerOptions: [] } });
        }
        return;
      }

      const [rows, links] = await Promise.all([
        controlPlaneService.listWorkspaceCustomers(workspaceId),
        controlPlaneService.listWorkspaceCustomerLedgerLinks({ workspaceId }),
      ]);

      const scopedRows = ledgerPda
        ? rows.filter((customer) =>
            links.some(
              (link) =>
                link.workspaceCustomerId === customer.id &&
                link.ledgerPda === ledgerPda &&
                link.status === "active",
            ),
          )
        : rows;

      if (!cancelled) {
        dispatch({ type: "set_customer_options", payload: { customerOptions: scopedRows } });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspaceId, ledgerPda, ledgerLinks]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    // Keep workspace source-of-truth in topbar workspace selector only.
    params.delete("workspace");

    if (ledgerPda) params.set("ledger", ledgerPda);
    else params.delete("ledger");

    if (customerId) params.set("customer", customerId);
    else params.delete("customer");

    if (invoicePubkey) params.set("invoice", invoicePubkey);
    else params.delete("invoice");

    const next = params.toString();
    const current = searchParams.toString();
    if (next !== current) {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  }, [workspaceId, ledgerPda, customerId, invoicePubkey, pathname, router, searchParams]);

  useEffect(() => {
    if (
      workspaceId &&
      ledgerPda &&
      !ledgerLinks.some(
        (row) => row.workspaceId === workspaceId && row.ledgerPda === ledgerPda,
      )
    ) {
      dispatch({ type: "clear_invalid_ledger" });
    }
  }, [workspaceId, ledgerPda, ledgerLinks]);

  useEffect(() => {
    if (customerId && !customerOptions.some((row) => row.id === customerId)) {
      dispatch({ type: "clear_invalid_customer" });
    }
  }, [customerId, customerOptions]);

  const ledgerOptions = useMemo(
    () =>
      ledgerLinks.filter(
        (row) => (workspaceId ? row.workspaceId === workspaceId : false) && row.status === "active",
      ),
    [ledgerLinks, workspaceId],
  );

  const value = useMemo<WorkingContextValue>(
    () => ({
      workspaceId,
      ledgerPda,
      customerId,
      invoicePubkey,
      ledgerOptions,
      customerOptions,
      refreshCustomerOptions,
      setLedgerPda(nextLedgerPda) {
        dispatch({ type: "set_ledger", payload: { ledgerPda: normalize(nextLedgerPda) } });
      },
      setCustomerId(nextCustomerId) {
        dispatch({ type: "set_customer", payload: { customerId: normalize(nextCustomerId) } });
      },
      setInvoicePubkey(nextInvoicePubkey) {
        dispatch({ type: "set_invoice", payload: { invoicePubkey: normalize(nextInvoicePubkey) } });
      },
      clearContext() {
        dispatch({ type: "clear_context" });
      },
    }),
    [workspaceId, ledgerPda, customerId, invoicePubkey, ledgerOptions, customerOptions, refreshCustomerOptions],
  );

  return <WorkingContext.Provider value={value}>{children}</WorkingContext.Provider>;
}

export function useWorkingContext() {
  const context = useContext(WorkingContext);
  if (!context) {
    throw new Error("useWorkingContext must be used within WorkingContextProvider");
  }
  return context;
}
