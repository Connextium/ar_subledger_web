"use client";

import { useCallback, useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { PageTitle } from "@/components/ui/page-title";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { accountingEngineService, GlAccount } from "@/services/accounting-engine-service";
import { supabase } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import { useWorkspace } from "@/context/workspace-context";

interface GLAccountSpec {
  code: number;
  name: string;
  category: string;
  normalSide: string;
  description: string;
}

const AR_GL_ACCOUNTS: GLAccountSpec[] = [
  {
    code: 1000,
    name: "Cash",
    category: "Asset",
    normalSide: "Debit",
    description: "Cash and cash equivalents",
  },
  {
    code: 1100,
    name: "AR Control",
    category: "Asset",
    normalSide: "Debit",
    description: "Total AR balance across all customers",
  },
  {
    code: 4000,
    name: "Revenue",
    category: "Revenue",
    normalSide: "Credit",
    description: "Sales and service revenue",
  },
  {
    code: 6500,
    name: "Write-off Expense",
    category: "Expense",
    normalSide: "Debit",
    description: "Bad debt write-offs and adjustments",
  },
];

const AP_GL_ACCOUNTS: GLAccountSpec[] = [
  {
    code: 1000,
    name: "Cash",
    category: "Asset",
    normalSide: "Debit",
    description: "Cash and cash equivalents",
  },
  {
    code: 2100,
    name: "AP Control",
    category: "Liability",
    normalSide: "Credit",
    description: "Accounts payable liability control",
  },
  {
    code: 5000,
    name: "Purchase Expense",
    category: "Expense",
    normalSide: "Debit",
    description: "Cost of goods and services purchased",
  },
];

interface Props {
  ledgerKey: string;
  generalLedgerId: string;
  defaultInitializationType?: "ar" | "ap";
  allowedInitializationTypes?: Array<"ar" | "ap">;
}

function getCanonicalGlAccountName(code: number, currentName: string): string {
  if (code === 5000) return "Purchase Expense";
  if (code === 6500) return "Write-off Expense";
  return currentName;
}

export default function GlSetupComponent({
  ledgerKey,
  generalLedgerId,
  defaultInitializationType = "ar",
  allowedInitializationTypes = ["ar", "ap"],
}: Props) {
  const params = useParams();
  const { selectedWorkspaceId } = useWorkspace();
  // Prefer prop, fallback to route param
  const effectiveGeneralLedgerId = generalLedgerId ?? (params?.id as string);

  const [glAccounts, setGlAccounts] = useState<GlAccount[]>([]);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [initializationType, setInitializationType] = useState<"ar" | "ap">(defaultInitializationType);
  const canUseAr = allowedInitializationTypes.includes("ar");
  const canUseAp = allowedInitializationTypes.includes("ap");

  const getAccountsToInitialize = () =>
    initializationType === "ar" ? AR_GL_ACCOUNTS : AP_GL_ACCOUNTS;

  const existingCodes = new Set(glAccounts.map((a) => a.account.code));
  const missingArCodes = AR_GL_ACCOUNTS.filter((account) => !existingCodes.has(account.code));
  const missingApCodes = AP_GL_ACCOUNTS.filter((account) => !existingCodes.has(account.code));
  const hasArAccounts = missingArCodes.length === 0;
  const hasApAccounts = missingApCodes.length === 0;
  const canInitializeAr = canUseAr && missingArCodes.length > 0;
  const canInitializeAp = canUseAp && missingApCodes.length > 0;
  const isFullyInitialized =
    (!canUseAr || hasArAccounts) &&
    (!canUseAp || hasApAccounts);

  useEffect(() => {
    if (initializationType === "ar" && !canUseAr && canUseAp) {
      setInitializationType("ap");
    } else if (initializationType === "ap" && !canUseAp && canUseAr) {
      setInitializationType("ar");
    }
  }, [canUseAp, canUseAr, initializationType]);

  // Load existing GL accounts
  const loadGlAccounts = useCallback(async () => {
    if (!ledgerKey) return;
    try {
      setIsLoading(true);
      const accounts = await accountingEngineService.listGlAccounts(new PublicKey(ledgerKey));
      console.log("[GL Setup] Loaded accounts:", accounts.map((a) => ({ code: a.account.code, name: a.account.name })));
      setGlAccounts(accounts);
    } catch (err) {
      console.error("Error loading GL accounts:", err);
      // Don't show error to user, just show not initialized
    } finally {
      setIsLoading(false);
    }
  }, [ledgerKey]);

  useEffect(() => {
    void loadGlAccounts();
  }, [loadGlAccounts]);

  const handleInitializeGlAccounts = async () => {
    try {
      setIsInitializing(true);
      setError(null);
      setSuccess(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Authentication token is missing");
      }

      if (!selectedWorkspaceId) {
        throw new Error("No workspace selected");
      }

      const response = await fetch("/api/accounting/initialize-gl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          generalLedgerId: effectiveGeneralLedgerId,
          workspaceId: selectedWorkspaceId,
          ledgerKey,
          initializationType,
        }),
      });

      let data;
      let rawText;
      try {
        rawText = await response.text();
        data = JSON.parse(rawText);
      } catch (e) {
        console.error("Failed to parse JSON response from /api/accounting/initialize-gl", { rawText, error: e });
        throw new Error("Failed to parse server response. See console for details.");
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to initialize GL accounts");
      }

      setSuccess(`GL accounts initialized successfully. Transaction: ${data.txs?.[0]?.slice(0, 8)}...`);

      // Reload GL accounts after transaction confirmation
      // Wait longer to ensure on-chain state is updated
      console.log(`[GL Setup] Waiting for ${initializationType} account confirmation, then reloading...`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
      console.log("[GL Setup] Reloading GL accounts after confirmation...");
      await loadGlAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize GL accounts");
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle title="GL Account Setup" />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4 text-rose-600" />
          <AlertDescription className="text-rose-800">{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Status Card */}
      <div className="rounded-lg border p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">GL Accounts Status</h3>
            <p className="mt-1 text-sm text-gray-600">
              {isFullyInitialized ? (
                <span className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  AR & AP Initialized
                </span>
              ) : hasArAccounts && hasApAccounts ? (
                <span className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  All Accounts Initialized
                </span>
              ) : (
                <span className="text-amber-600">
                  {hasArAccounts
                    ? "AR Initialized, AP Pending"
                    : hasApAccounts
                      ? "AP Initialized, AR Pending"
                      : "Not Initialized"}
                </span>
              )}
            </p>
          </div>
          {!isFullyInitialized && (
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2 rounded-lg border border-gray-300 bg-gray-50 p-1">
                <button
                  onClick={() => setInitializationType("ar")}
                  disabled={!canUseAr || !canInitializeAr}
                  className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                    initializationType === "ar"
                      ? "bg-blue-600 text-white"
                      : "text-gray-700 hover:bg-gray-200 disabled:text-gray-400"
                  }`}
                >
                  {!canUseAr ? "AR unavailable" : canInitializeAr ? `Initialize AR (${missingArCodes.length})` : "AR ✓"}
                </button>
                <button
                  onClick={() => setInitializationType("ap")}
                  disabled={!canUseAp || !canInitializeAp}
                  className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                    initializationType === "ap"
                      ? "bg-blue-600 text-white"
                      : "text-gray-700 hover:bg-gray-200 disabled:text-gray-400"
                  }`}
                >
                  {!canUseAp ? "AP unavailable" : canInitializeAp ? `Initialize AP (${missingApCodes.length})` : "AP ✓"}
                </button>
              </div>
              <Button
                onClick={handleInitializeGlAccounts}
                disabled={isInitializing || !((initializationType === "ar" && canInitializeAr) || (initializationType === "ap" && canInitializeAp))}
                size="lg"
              >
                {isInitializing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {initializationType === "ar" ? "Initialize AR Accounts" : "Initialize AP Accounts"}
              </Button>
            </div>
          )}
        </div>

        {!isFullyInitialized && (
          <div className="mt-4 rounded bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-900">
              The following missing {initializationType === "ar" ? "AR" : "AP"} GL accounts will be created:
            </p>
            <ul className="mt-3 space-y-2">
              {getAccountsToInitialize()
                .filter((account) => !existingCodes.has(account.code))
                .map((account) => (
                <li key={account.code} className="text-sm text-blue-800">
                  <span className="font-mono font-semibold">{account.code}</span> - {account.name} (
                  {account.category}, {account.normalSide} normal)
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* GL Accounts Table */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : glAccounts.length > 0 ? (
        <div className="space-y-6">
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Code</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Category</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Normal Side</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {glAccounts.map((account) => (
                  <tr key={account.account.code} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm font-mono text-gray-900">{account.account.code}</td>
                    <td className="px-6 py-3 text-sm text-gray-900">
                      {getCanonicalGlAccountName(account.account.code, account.account.name)}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">{account.account.category}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{account.account.normalSide}</td>
                    <td className="px-6 py-3 text-right text-sm font-mono text-gray-900">
                      {(Number(account.account.balance) / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!isFullyInitialized && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">
                {canInitializeAr && canInitializeAp
                  ? "AR & AP accounts are pending initialization"
                  : canInitializeAr
                    ? "AR accounts are pending initialization"
                    : "AP accounts are pending initialization"}
              </p>
              <p className="mt-1 text-sm text-amber-800">
                Use the toggle buttons above to select which accounts to initialize next.
              </p>
            </div>
          )}
        </div>
      ) : !isFullyInitialized ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-gray-600">GL accounts have not been initialized yet.</p>
          <p className="mt-1 text-sm text-gray-500">
            Use the toggle buttons above to select AR or AP, then click initialize to create the accounts.
          </p>
        </div>
      ) : null}
    </div>
  );
}
