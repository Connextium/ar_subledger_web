"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { PageTitle } from "@/components/ui/page-title";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, ChevronRight } from "lucide-react";
import { accountingEngineService, JournalEntry } from "@/services/accounting-engine-service";
import Link from "next/link";

interface Props {
  ledgerKey: string;
  generalLedgerId: string;
}

export default function JournalEntriesComponent({ ledgerKey, generalLedgerId }: Props) {

type SortField = "entryId" | "postedAt" | "totalDebit";
type SortOrder = "asc" | "desc";

  // ledgerId is now generalLedgerId for GL context
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterRef, setFilterRef] = useState("");
  const [filterMemo, setFilterMemo] = useState("");
  const [sortField, setSortField] = useState<SortField>("postedAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 10;

  // Load journal entries
  const loadEntries = useCallback(async () => {
    if (!ledgerKey) return;
    try {
      setIsLoading(true);
      setError(null);
      const journalEntries = await accountingEngineService.listJournalEntries(new PublicKey(ledgerKey));
      setEntries(journalEntries);
    } catch (err) {
      console.error("Error loading journal entries:", err);
      setError("Failed to load journal entries");
    } finally {
      setIsLoading(false);
    }
  }, [ledgerKey]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  // Filter and sort entries
  const filteredEntries = useMemo(() => {
    let filtered = entries;

    if (filterRef) {
      filtered = filtered.filter((e) => e.account.externalRef.toLowerCase().includes(filterRef.toLowerCase()));
    }

    if (filterMemo) {
      filtered = filtered.filter((e) => e.account.memo.toLowerCase().includes(filterMemo.toLowerCase()));
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      if (sortField === "entryId") {
        aVal = a.account.entryId;
        bVal = b.account.entryId;
      } else if (sortField === "postedAt") {
        aVal = a.account.postedAt;
        bVal = b.account.postedAt;
      } else {
        aVal = a.account.totalDebit;
        bVal = b.account.totalDebit;
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [entries, filterRef, filterMemo, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage);
  const paginatedEntries = useMemo(
    () =>
      filteredEntries.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [filteredEntries, currentPage],
  );

  const formatDate = (timestamp: bigint) => {
    return new Date(Number(timestamp) * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatAmount = (amount: bigint) => {
    return (Number(amount) / 100).toFixed(2);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageTitle title="Journal Entries" />
        <Button onClick={loadEntries} variant="secondary" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">External Reference</label>
            <input
              type="text"
              placeholder="e.g., INV-001, REC-001"
              value={filterRef}
              onChange={(e) => {
                setFilterRef(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Memo</label>
            <input
              type="text"
              placeholder="Search memo text..."
              value={filterMemo}
              onChange={(e) => {
                setFilterMemo(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Entries Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : paginatedEntries.length > 0 ? (
        <>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th
                    className="px-6 py-3 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("entryId")}
                  >
                    ID {sortField === "entryId" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("postedAt")}
                  >
                    Date {sortField === "postedAt" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Ref</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Memo</th>
                  <th
                    className="px-6 py-3 text-right text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("totalDebit")}
                  >
                    Debit {sortField === "totalDebit" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Credit</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginatedEntries.map((entry) => (
                  <tr key={Number(entry.account.entryId)} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm font-mono text-gray-900">
                      {Number(entry.account.entryId)}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {formatDate(entry.account.postedAt)}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-900 font-medium">
                      {entry.account.externalRef}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600 max-w-xs truncate">
                      {entry.account.memo}
                    </td>
                    <td className="px-6 py-3 text-right text-sm font-mono text-gray-900">
                      {formatAmount(entry.account.totalDebit)}
                    </td>
                    <td className="px-6 py-3 text-right text-sm font-mono text-gray-900">
                      {formatAmount(entry.account.totalCredit)}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <Link
                        href={`/app/accounting/entries/${generalLedgerId}/${Number(entry.account.entryId)}`}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="text-sm text-gray-600">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                {Math.min(currentPage * itemsPerPage, filteredEntries.length)} of {filteredEntries.length} entries
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-2 px-2">
                  <span className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-gray-600">No journal entries found.</p>
          {(filterRef || filterMemo) && (
            <p className="mt-1 text-sm text-gray-500">Try adjusting your filters.</p>
          )}
        </div>
      )}
    </div>
  );
}
