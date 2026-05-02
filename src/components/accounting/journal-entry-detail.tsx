"use client";

import { useCallback, useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { PageTitle } from "@/components/ui/page-title";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, CheckCircle, ArrowLeft } from "lucide-react";
import { accountingEngineService, JournalEntry, PostingLine } from "@/services/accounting-engine-service";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

interface EnrichedPostingLine extends PostingLine {
  accountName?: string;
  accountCategory?: string;
}

interface Props {
  ledgerKey: string;
}

export default function JournalEntryDetail({ ledgerKey: generalLedgerKey }: Props) {
  const params = useParams();
  const entryId = params?.entryId ? BigInt(params.entryId as string) : null;
  const generalLedgerId = params?.ledgerId as string;

  // All hooks must be called unconditionally at the top
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [postingLines, setPostingLines] = useState<EnrichedPostingLine[]>([]);
  // const [glAccounts, setGlAccounts] = useState<Map<number, GlAccount>>(new Map()); // Unused, remove to fix warning
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!generalLedgerKey || !entryId) return;

    try {
      setIsLoading(true);
      setError(null);

      const ledgerPubkey = new PublicKey(generalLedgerKey);

      // Load all GL accounts
      // const accounts = await accountingEngineService.listGlAccounts(ledgerPubkey);
      // const accountMap = new Map(accounts.map((a) => [a.account.code, a]));
      // setGlAccounts(accountMap);

      // Load journal entry
      const journalEntry = await accountingEngineService.getJournalEntry(ledgerPubkey, entryId);
      if (!journalEntry) {
        setError("Journal entry not found");
        return;
      }

      setEntry(journalEntry);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Authentication token is missing");
      }

      const [postingLinesRaw, glAccounts] = await Promise.all([
        accountingEngineService.getJournalEntryPostingLines(
          generalLedgerId,
          entryId,
          session.access_token,
        ),
        accountingEngineService.listGlAccounts(ledgerPubkey),
      ]);

      const glAccountMap = new Map(glAccounts.map((a) => [a.account.code, a]));
      const enrichedLines: EnrichedPostingLine[] = postingLinesRaw.map((line) => ({
        ...line,
        accountName: glAccountMap.get(line.accountCode)?.account.name,
        accountCategory: glAccountMap.get(line.accountCode)?.account.category,
      }));
      setPostingLines(enrichedLines);
    } catch (err) {
      console.error("Error loading journal entry:", err);
      setError(err instanceof Error ? err.message : "Failed to load journal entry");
    } finally {
      setIsLoading(false);
    }
  }, [generalLedgerId, generalLedgerKey, entryId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (!entryId) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Invalid entry ID</AlertDescription>
      </Alert>
    );
  }

  const formatDate = (timestamp: bigint) => {
    return new Date(Number(timestamp) * 1000).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatAmount = (amount: bigint) => {
    return (Number(amount) / 100).toFixed(2);
  };

  const isBalanced =
    !!entry && entry.account.totalDebit.toString() === entry.account.totalCredit.toString();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/app/accounting/entries/${generalLedgerId}`} className="text-blue-600 hover:text-blue-700">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <PageTitle title={`Journal Entry #${entryId?.toString()}`} />
          {entry && (
            <p className="mt-1 text-sm text-gray-600">
              {entry.account.externalRef} · {formatDate(entry.account.postedAt)}
            </p>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : entry ? (
        <>
          {/* Entry Metadata */}
          <div className="rounded-lg border p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">External Reference</label>
                <p className="mt-1 text-lg font-semibold text-gray-900">{entry.account.externalRef}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Posted At</label>
                <p className="mt-1 text-lg font-semibold text-gray-900">{formatDate(entry.account.postedAt)}</p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Memo</label>
                <p className="mt-1 text-base text-gray-900">{entry.account.memo}</p>
              </div>
            </div>

            {/* Balance Indicator */}
            <div className="flex items-center gap-2 rounded bg-gray-50 p-3">
              {isBalanced ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-600">Entry is balanced</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <span className="font-medium text-red-600">Entry is not balanced</span>
                </>
              )}
            </div>
          </div>

          {/* Posting Lines */}
          {postingLines.length > 0 ? (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Account Code</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Account Name</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Category</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Debit</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {postingLines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm font-mono text-gray-900">{line.accountCode}</td>
                      <td className="px-6 py-3 text-sm text-gray-900">{line.accountName || "Unknown"}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{line.accountCategory || "—"}</td>
                      <td className="px-6 py-3 text-right text-sm font-mono text-gray-900">
                        {line.isDebit ? formatAmount(line.amount) : "—"}
                      </td>
                      <td className="px-6 py-3 text-right text-sm font-mono text-gray-900">
                        {!line.isDebit ? formatAmount(line.amount) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded bg-blue-50 p-4 mt-4 text-blue-900 text-sm">
              No posting lines available for this entry.
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
