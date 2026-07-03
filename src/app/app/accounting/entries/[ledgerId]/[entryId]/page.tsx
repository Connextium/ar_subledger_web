"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useWorkspace } from "@/context/workspace-context";
import JournalEntryDetailComponent from "@/components/accounting/journal-entry-detail";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { supabase } from "@/lib/api-client/v1/session-client";

type LedgerRow = {
  onchain_ledger_key?: string | null;
  code?: string | null;
  name?: string | null;
};

function extractBaseGlPubkey(ledgerId: string): string | null {
  const normalized = (() => {
    try {
      return decodeURIComponent(ledgerId);
    } catch {
      return ledgerId;
    }
  })();

  if (!normalized.startsWith("base-gl:")) {
    return null;
  }

  const pubkey = normalized.slice("base-gl:".length).trim();
  return pubkey.length > 0 ? pubkey : null;
}

export default function EntryDetailPage() {
  const params = useParams();
  const ledgerId = params?.ledgerId as string;
  const { selectedWorkspaceId } = useWorkspace();

  const [ledger, setLedger] = useState<LedgerRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLedger = useCallback(async () => {
    if (!ledgerId) {
      setError("Workspace or ledger not found");
      return;
    }

    const baseGlPubkey = extractBaseGlPubkey(ledgerId);
    if (baseGlPubkey) {
      setLedger({
        onchain_ledger_key: baseGlPubkey,
        code: "BASE-GL",
        name: "Base GL",
      });
      setError(null);
      setLoading(false);
      return;
    }

    if (!selectedWorkspaceId) {
      setError("Workspace or ledger not found");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("ledgers")
        .select("*")
        .eq("id", ledgerId)
        .eq("workspace_id", selectedWorkspaceId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      setLedger(data as LedgerRow | null);
    } catch (err) {
      console.error("Error loading ledger:", err);
      setError(err instanceof Error ? err.message : "Failed to load ledger");
    } finally {
      setLoading(false);
    }
  }, [ledgerId, selectedWorkspaceId]);

  useEffect(() => {
    void loadLedger();
  }, [loadLedger]);

  if (loading) {
    return <div className="flex items-center justify-center py-12">Loading...</div>;
  }

  if (error || !ledger) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error || "Ledger not found"}</AlertDescription>
      </Alert>
    );
  }

  const ledgerKey = ledger.onchain_ledger_key;

  if (!ledgerKey) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Ledger does not have an on-chain key</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <JournalEntryDetailComponent ledgerKey={ledgerKey} />
    </div>
  );
}
