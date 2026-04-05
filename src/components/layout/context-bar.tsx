"use client";

import { useMemo } from "react";
import { useWorkspace } from "@/context/workspace-context";
import { useWorkingContext } from "@/context/working-context";

export function ContextBar() {
  const { workspaces } = useWorkspace();
  const {
    workspaceId,
    ledgerPda,
    customerId,
    ledgerOptions,
    customerOptions,
    setLedgerPda,
    setCustomerId,
    clearContext,
  } = useWorkingContext();

  const selectedWorkspaceName = useMemo(
    () => workspaces.find((row) => row.id === workspaceId)?.name ?? "None",
    [workspaceId, workspaces],
  );

  return (
    <div className="mb-3 rounded-md border border-slate-200 bg-white px-3 py-2">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Working Context
        </div>
        <button
          type="button"
          onClick={clearContext}
          className="text-[11px] font-medium text-slate-600 hover:text-slate-900"
        >
          Clear
        </button>
      </div>

      <div className="grid gap-2 md:grid-cols-2">

        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Ledger</span>
          <select
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[12px] text-slate-800"
            value={ledgerPda ?? ""}
            onChange={(event) => setLedgerPda(event.target.value || null)}
            disabled={!workspaceId}
          >
            <option value="">Select ledger</option>
            {ledgerOptions.map((ledger) => (
              <option key={ledger.ledgerPda} value={ledger.ledgerPda}>
                {ledger.ledgerCode}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Customer</span>
          <select
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[12px] text-slate-800"
            value={customerId ?? ""}
            onChange={(event) => setCustomerId(event.target.value || null)}
            disabled={!workspaceId}
          >
            <option value="">Select customer</option>
            {customerOptions.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.customerRef} - {customer.legalName}
              </option>
            ))}
          </select>
        </label>

      </div>

      <div className="mt-2 text-[11px] text-slate-500">
        Active: workspace {selectedWorkspaceName} | ledger {ledgerPda ? `${ledgerPda.slice(0, 4)}...${ledgerPda.slice(-4)}` : "-"} | customer {customerId ?? "-"}
      </div>
    </div>
  );
}
