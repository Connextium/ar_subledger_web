"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/ui/page-title";
import { Panel } from "@/components/ui/panel";
import { useArSubledger } from "@/hooks/use-ar-subledger";
import { useRoleGate } from "@/hooks/use-role-gate";
import { useEmbeddedWallet } from "@/context/embedded-wallet-context";
import { useWorkspace } from "@/context/workspace-context";
import { useWorkingContext } from "@/context/working-context";
import { controlPlaneService } from "@/services/control-plane-service";
import { accountingEngineService } from "@/services/accounting-engine-service";
import {
  closeInvoiceSchema,
  issueCreditNoteSchema,
  issueInvoiceSchema,
  recordReceiptSchema,
  writeOffSchema,
} from "@/lib/validation/schemas";
import { mapAnchorError } from "@/lib/errors/ar-errors";
import type {
  CreditNoteRecord,
  InvoiceRecord,
  LedgerRecord,
  ReceiptRecord,
  WorkspaceCustomer,
  WorkspaceCustomerLedgerLink,
  WorkspaceLedgerLink,
} from "@/lib/types/domain";
import { formatLamportsAmount, parseAmountToMinor } from "@/lib/utils/format";
import { supabase } from "@/lib/supabase/client";

function toUnix(date: string): number {
  return Math.floor(new Date(date).getTime() / 1000);
}

function toMessage(error: unknown): string {
  if (error instanceof Error) return mapAnchorError(error);
  return "Request failed.";
}

type FormErrors = Record<string, string>;

const BYPASS_POSTING_LINE_PERSISTENCE = true;

export default function WorkflowPage() {
  const service = useArSubledger();
  const { wallet } = useEmbeddedWallet();
  const { canWriteTransactions } = useRoleGate();
  const { selectedWorkspaceId } = useWorkspace();
  const { workspaceId, ledgerPda, customerId, invoicePubkey, setCustomerId, setInvoicePubkey } =
    useWorkingContext();

  const activeWorkspaceId = workspaceId ?? selectedWorkspaceId;

  const [ledgers, setLedgers] = useState<LedgerRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [workspaceCustomers, setWorkspaceCustomers] = useState<WorkspaceCustomer[]>([]);
  const [workspaceLedgerLinks, setWorkspaceLedgerLinks] = useState<WorkspaceLedgerLink[]>([]);
  const [customerLinks, setCustomerLinks] = useState<WorkspaceCustomerLedgerLink[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [credits, setCredits] = useState<CreditNoteRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<FormErrors>({});
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [inFlightTransactions, setInFlightTransactions] = useState<Set<string>>(new Set());

  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");

  const [receiptSeq, setReceiptSeq] = useState("1");
  const [receiptNo, setReceiptNo] = useState("");
  const [receiptAmount, setReceiptAmount] = useState("");
  const [receiptDate, setReceiptDate] = useState("");
  const [paymentReference, setPaymentReference] = useState("");

  const [creditSeq, setCreditSeq] = useState("1");
  const [creditNo, setCreditNo] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditDate, setCreditDate] = useState("");
  const [creditReason, setCreditReason] = useState("");

  const [writeoffAmount, setWriteoffAmount] = useState("");
  const [writeoffDate, setWriteoffDate] = useState("");
  const [writeoffReason, setWriteoffReason] = useState("");
  const [hashAction, setHashAction] = useState("");

  const activeLinksForLedger = useMemo(() => {
    if (!activeWorkspaceId || !ledgerPda) return [];
    return customerLinks.filter(
      (row) =>
        row.workspaceId === activeWorkspaceId &&
        row.ledgerPda === ledgerPda &&
        row.status === "active",
    );
  }, [activeWorkspaceId, customerLinks, ledgerPda]);

  const activeLink = useMemo(() => {
    if (!customerId) {
      return activeLinksForLedger.length === 1 ? activeLinksForLedger[0] : null;
    }

    return (
      activeLinksForLedger.find((row) => row.workspaceCustomerId === customerId) ??
      (activeLinksForLedger.length === 1 ? activeLinksForLedger[0] : null)
    );
  }, [activeLinksForLedger, customerId]);

  const activeOnchainCustomerPubkey = activeLink?.onchainCustomerPubkey ?? "";


  const filteredInvoices = useMemo(() => {
    if (!ledgerPda || !activeOnchainCustomerPubkey) return [];
    return invoices.filter((row) => row.ledger === ledgerPda && row.customer === activeOnchainCustomerPubkey);
  }, [activeOnchainCustomerPubkey, invoices, ledgerPda]);

  const selectedInvoice = useMemo(
    () => filteredInvoices.find((row) => row.pubkey === invoicePubkey) ?? null,
    [filteredInvoices, invoicePubkey],
  );

  const selectedLedger = useMemo(
    () => (ledgerPda ? ledgers.find((row) => row.pubkey === ledgerPda) ?? null : null),
    [ledgerPda, ledgers],
  );

  const selectedWorkspaceLedgerLink = useMemo(() => {
    if (!activeWorkspaceId || !ledgerPda) return null;
    return (
      workspaceLedgerLinks.find(
        (row) => row.workspaceId === activeWorkspaceId && row.ledgerPda === ledgerPda,
      ) ?? null
    );
  }, [activeWorkspaceId, ledgerPda, workspaceLedgerLinks]);

  const currentSignerPubkey = wallet?.publicKey.toBase58() ?? null;
  const hasLedgerAuthorityMismatch = Boolean(
    selectedLedger && currentSignerPubkey && selectedLedger.authority !== currentSignerPubkey,
  );

  const loadRecords = async () => {
    if (!service) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [nextLedgers, nextInvoices] = await Promise.all([service.listLedgers(), service.listInvoices()]);
      setLedgers(nextLedgers);
      setInvoices(nextInvoices);
    } finally {
      setLoading(false);
    }
  };

  const loadContextModel = async () => {
    if (!activeWorkspaceId) {
      setWorkspaceLedgerLinks([]);
      setCustomerLinks([]);
      return;
    }

    const [nextLedgerLinks, nextCustomerLinks] = await Promise.all([
      controlPlaneService.listLedgerLinks(activeWorkspaceId),
      controlPlaneService.listWorkspaceCustomerLedgerLinks({ workspaceId: activeWorkspaceId }),
    ]);

    setWorkspaceLedgerLinks(nextLedgerLinks);
    setCustomerLinks(nextCustomerLinks);
  };

  const persistPostingLines = async (
    journalEntryId: number,
    postingLines: Array<{ accountCode: number; amount: number; isDebit: boolean }>,
  ) => {
    if (BYPASS_POSTING_LINE_PERSISTENCE) {
      return;
    }

    if (!selectedWorkspaceLedgerLink?.id) {
      throw new Error("Selected ledger link not found in workspace");
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Authentication token is missing");
    }

    await accountingEngineService.saveJournalEntryPostingLines(
      selectedWorkspaceLedgerLink.id,
      BigInt(journalEntryId),
      postingLines.map((line) => ({
        accountCode: line.accountCode,
        amount: BigInt(line.amount),
        isDebit: line.isDebit,
      })),
      session.access_token,
    );
  };

  useEffect(() => {
    void loadRecords();
  }, [service]);

  useEffect(() => {
    void loadContextModel();
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (!selectedInvoice || !service) {
      setReceipts([]);
      setCredits([]);
      return;
    }
    void (async () => {
      const [nextReceipts, nextCredits] = await Promise.all([
        service.listReceipts(selectedInvoice.pubkey),
        service.listCreditNotes(selectedInvoice.pubkey),
      ]);
      setReceipts(nextReceipts);
      setCredits(nextCredits);
    })();
  }, [selectedInvoice, service]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateHashAction = () => {
      setHashAction(window.location.hash.replace(/^#/, ""));
    };

    updateHashAction();
    window.addEventListener("hashchange", updateHashAction);
    return () => {
      window.removeEventListener("hashchange", updateHashAction);
    };
  }, []);

  useEffect(() => {
    if (!ledgerPda) return;

    const linkedCustomerIds = Array.from(new Set(activeLinksForLedger.map((row) => row.workspaceCustomerId)));
    if (linkedCustomerIds.length !== 1) return;

    const onlyLinkedCustomerId = linkedCustomerIds[0];
    if (customerId !== onlyLinkedCustomerId) {
      setCustomerId(onlyLinkedCustomerId);
    }
  }, [ledgerPda, customerId, activeLinksForLedger, setCustomerId]);

  useEffect(() => {
    if (!selectedInvoice) return;
    const nextReceiptSeq = Math.max(1, selectedInvoice.receiptSeq + 1);
    setReceiptSeq(String(nextReceiptSeq));
  }, [selectedInvoice]);

  const showIssueInvoice = hashAction === "issue-invoice";
  const showSettlementCards = Boolean(selectedInvoice && activeOnchainCustomerPubkey);

  const showSubmittedSignature = (label: string, signature: string) => {
    setSuccess(`${label} submitted. Signature: ${signature}. Waiting for confirmation...`);
  };

  const handleRecordReceipt = async () => {
    setErrors({});
    setSuccess(null);
    if (!canWriteTransactions) { setErrors({ form: "Your current role does not allow transaction writes." }); return; }
    if (!service || !ledgerPda) { setErrors({ form: "Select a ledger in Working Context first." }); return; }
    if (!activeOnchainCustomerPubkey) { setErrors({ form: "Select a customer linked to the ledger first." }); return; }
    if (!selectedInvoice) { setErrors({ form: "Select an invoice first." }); return; }
    const txKey = `receipt:${selectedInvoice.pubkey}:${receiptSeq}`;
    if (inFlightTransactions.has(txKey)) { setErrors({ form: "Receipt already submitted. Wait for confirmation or use a different Seq." }); return; }
    const expectedNextReceiptSeq = selectedInvoice.receiptSeq + 1;
    if (Number(receiptSeq) <= selectedInvoice.receiptSeq) {
      setErrors({ form: `Receipt sequence already used. Use ${expectedNextReceiptSeq} or higher.` });
      return;
    }
    const parsed = recordReceiptSchema.safeParse({ ledgerPubkey: ledgerPda, customerPubkey: activeOnchainCustomerPubkey, invoicePubkey: selectedInvoice.pubkey, receiptSeq, receiptNo, amount: receiptAmount, receiptDate, paymentReference });
    if (!parsed.success) { setErrors({ form: parsed.error.issues[0]?.message ?? "Please fill in all required receipt fields." }); return; }
    setSubmitting("receipt");
    setInFlightTransactions(prev => new Set([...prev, txKey]));
    try {
      const latestLedger = await service.getLedger(ledgerPda);
      if (!latestLedger) throw new Error("Ledger account not found");
      const journalEntryId = latestLedger.nextJournalEntryId;
      const amountMinor = parseAmountToMinor(receiptAmount);
      await service.recordReceipt({ ledgerPubkey: ledgerPda, customerPubkey: activeOnchainCustomerPubkey, invoicePubkey: selectedInvoice.pubkey, receiptSeq: Number(receiptSeq), receiptNo, amountMinor, receiptDateUnix: toUnix(receiptDate), paymentReference, onSubmitted: (signature) => showSubmittedSignature("Receipt", signature) });
      await persistPostingLines(journalEntryId, [{ accountCode: latestLedger.cashAccountCode, amount: amountMinor, isDebit: true }, { accountCode: latestLedger.arControlAccountCode, amount: amountMinor, isDebit: false }]);
      await loadRecords();
      setSuccess("Receipt recorded");
    } catch (error) {
      setErrors({ form: toMessage(error) });
    } finally {
      setSubmitting(null);
      setInFlightTransactions(prev => { const next = new Set(prev); next.delete(txKey); return next; });
    }
  };

  const handleIssueCreditNote = async () => {
    setErrors({});
    setSuccess(null);
    if (!canWriteTransactions) { setErrors({ form: "Your current role does not allow transaction writes." }); return; }
    if (!service || !ledgerPda) { setErrors({ form: "Select a ledger in Working Context first." }); return; }
    if (!activeOnchainCustomerPubkey) { setErrors({ form: "Select a customer linked to the ledger first." }); return; }
    if (!selectedInvoice) { setErrors({ form: "Select an invoice first." }); return; }
    const txKey = `credit:${selectedInvoice.pubkey}:${creditSeq}`;
    if (inFlightTransactions.has(txKey)) { setErrors({ form: "Credit note already submitted. Wait for confirmation or use a different Seq." }); return; }
    const parsed = issueCreditNoteSchema.safeParse({ ledgerPubkey: ledgerPda, customerPubkey: activeOnchainCustomerPubkey, invoicePubkey: selectedInvoice.pubkey, creditSeq, creditNo, amount: creditAmount, creditDate, reason: creditReason });
    if (!parsed.success) { setErrors({ form: parsed.error.issues[0]?.message ?? "Please fill in all required credit note fields." }); return; }
    setSubmitting("credit");
    setInFlightTransactions(prev => new Set([...prev, txKey]));
    try {
      const latestLedger = await service.getLedger(ledgerPda);
      if (!latestLedger) throw new Error("Ledger account not found");
      const journalEntryId = latestLedger.nextJournalEntryId;
      const amountMinor = parseAmountToMinor(creditAmount);
      await service.issueCreditNote({ ledgerPubkey: ledgerPda, customerPubkey: activeOnchainCustomerPubkey, invoicePubkey: selectedInvoice.pubkey, creditSeq: Number(creditSeq), creditNo, amountMinor, creditDateUnix: toUnix(creditDate), reason: creditReason, onSubmitted: (signature) => showSubmittedSignature("Credit note", signature) });
      await persistPostingLines(journalEntryId, [{ accountCode: latestLedger.revenueAccountCode, amount: amountMinor, isDebit: true }, { accountCode: latestLedger.arControlAccountCode, amount: amountMinor, isDebit: false }]);
      await loadRecords();
      setSuccess("Credit note issued");
    } catch (error) {
      setErrors({ form: toMessage(error) });
    } finally {
      setSubmitting(null);
      setInFlightTransactions(prev => { const next = new Set(prev); next.delete(txKey); return next; });
    }
  };

  const handleWriteOffInvoice = async () => {
    setErrors({});
    setSuccess(null);
    if (!canWriteTransactions) { setErrors({ form: "Your current role does not allow transaction writes." }); return; }
    if (!service || !ledgerPda) { setErrors({ form: "Select a ledger in Working Context first." }); return; }
    if (!activeOnchainCustomerPubkey) { setErrors({ form: "Select a customer linked to the ledger first." }); return; }
    if (!selectedInvoice) { setErrors({ form: "Select an invoice first." }); return; }
    const txKey = `writeoff:${selectedInvoice.pubkey}`;
    if (inFlightTransactions.has(txKey)) { setErrors({ form: "Write-off already submitted. Wait for confirmation." }); return; }
    const parsed = writeOffSchema.safeParse({ ledgerPubkey: ledgerPda, customerPubkey: activeOnchainCustomerPubkey, invoicePubkey: selectedInvoice.pubkey, amount: writeoffAmount, writeoffDate, reason: writeoffReason });
    if (!parsed.success) { setErrors({ form: parsed.error.issues[0]?.message ?? "Please fill in all required write-off fields." }); return; }
    setSubmitting("writeoff");
    setInFlightTransactions(prev => new Set([...prev, txKey]));
    try {
      const latestLedger = await service.getLedger(ledgerPda);
      if (!latestLedger) throw new Error("Ledger account not found");
      const journalEntryId = latestLedger.nextJournalEntryId;
      const amountMinor = parseAmountToMinor(writeoffAmount);
      await service.writeOffInvoice({ ledgerPubkey: ledgerPda, customerPubkey: activeOnchainCustomerPubkey, invoicePubkey: selectedInvoice.pubkey, amountMinor, writeoffDateUnix: toUnix(writeoffDate), reason: writeoffReason, onSubmitted: (signature) => showSubmittedSignature("Write-off", signature) });
      await persistPostingLines(journalEntryId, [{ accountCode: latestLedger.writeoffExpenseAccountCode, amount: amountMinor, isDebit: true }, { accountCode: latestLedger.arControlAccountCode, amount: amountMinor, isDebit: false }]);
      await loadRecords();
      setSuccess("Invoice written off");
    } catch (error) {
      setErrors({ form: toMessage(error) });
    } finally {
      setSubmitting(null);
      setInFlightTransactions(prev => { const next = new Set(prev); next.delete(txKey); return next; });
    }
  };

  return (
    <div className="space-y-3">
      <PageTitle title="Workflow" subtitle="Context-aware cards and invoice-first settlement workflow." />

      {loading ? <p className="text-[11px] text-slate-500">Loading workflow data...</p> : null}
      {success ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">{success}</p> : null}
      {errors.form ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">{errors.form}</p> : null}

      {showIssueInvoice ? (
        <Panel title="Issue Invoice" subtitle="Ledger + customer + link resolved.">
          <form id="issue-invoice" className="space-y-2" onSubmit={async (event) => {
            event.preventDefault();
            setErrors({});
            setSuccess(null);

            if (!canWriteTransactions) {
              setErrors({ form: "Your current role does not allow transaction writes." });
              return;
            }

            if (!service || !ledgerPda) {
              setErrors({ form: "Select a ledger in Working Context first." });
              return;
            }

            if (!activeOnchainCustomerPubkey) {
              setErrors({ form: "Select a customer that is linked to the selected ledger first." });
              return;
            }

            if (hasLedgerAuthorityMismatch) {
              setErrors({
                form:
                  "Selected ledger authority does not match current signer wallet. Set the matching wallet as Main in Configuration, then retry.",
              });
              return;
            }

            const parsed = issueInvoiceSchema.safeParse({ ledgerPubkey: ledgerPda, customerPubkey: activeOnchainCustomerPubkey, invoiceNo, amount: invoiceAmount, issueDate, dueDate, currency, description });
            if (!parsed.success) {
              const message = parsed.error.issues[0]?.message ?? "Please fill in required invoice fields.";
              setErrors({ form: message });
              return;
            }
            setSubmitting("invoice");
            try {
              const latestLedger = await service.getLedger(ledgerPda);
              if (!latestLedger) {
                throw new Error("Ledger account not found");
              }

              const journalEntryId = latestLedger.nextJournalEntryId;
              const amountMinor = parseAmountToMinor(invoiceAmount);
              const nextInvoice = await service.issueInvoice({ ledgerPubkey: ledgerPda, customerPubkey: activeOnchainCustomerPubkey, invoiceNo, amountMinor, issueDateUnix: toUnix(issueDate), dueDateUnix: toUnix(dueDate), currency, description, onSubmitted: (signature) => showSubmittedSignature("Invoice", signature) });

              await persistPostingLines(journalEntryId, [
                { accountCode: latestLedger.arControlAccountCode, amount: amountMinor, isDebit: true },
                { accountCode: latestLedger.revenueAccountCode, amount: amountMinor, isDebit: false },
              ]);

              setInvoicePubkey(nextInvoice);
              await loadRecords();
              setSuccess(`Invoice issued: ${nextInvoice}`);
            } catch (error) {
              setErrors({ form: toMessage(error) });
            } finally {
              setSubmitting(null);
            }
          }}>
            <Input label="Invoice no" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
            <Input label="Amount" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} />
            <Input label="Issue date" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            <Input label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <Input label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
            <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
            {!activeOnchainCustomerPubkey ? (
              <p className="text-[11px] text-slate-600">
                Select a ledger and a linked customer in context bar to enable submission.
              </p>
            ) : null}
            {hasLedgerAuthorityMismatch ? (
              <p className="text-[11px] text-amber-700">
                Signer mismatch: ledger authority is {selectedLedger?.authority}, current signer is {currentSignerPubkey}. Update main wallet in Configuration.
              </p>
            ) : null}
            {!canWriteTransactions ? (
              <p className="text-[11px] text-slate-600">
                Current role is read-only for transaction writes.
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={submitting === "invoice"}
            >
              Issue
            </Button>
          </form>
        </Panel>
      ) : null}

      <div className={selectedInvoice ? "grid gap-3 lg:grid-cols-12" : "flex justify-center"}>
        <section
          className={[
            "overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm",
            selectedInvoice ? "lg:col-span-7" : "w-full max-w-4xl",
          ].join(" ")}
        >
          <header className="border-b border-slate-200 bg-slate-50 px-3 py-2">
            <h2 className="text-xs font-semibold text-slate-800">Invoice List (selected ledger + customer)</h2>
          </header>
          <div className="max-h-[560px] overflow-auto p-2">
            {filteredInvoices.length === 0 ? <p className="px-2 py-3 text-xs text-slate-500">No invoices for this context.</p> : (
              <div className="space-y-2">
                {filteredInvoices.map((row) => (
                  <button key={row.pubkey} type="button" onClick={() => setInvoicePubkey(row.pubkey)} className={["w-full rounded-md border px-3 py-2 text-left transition", row.pubkey === selectedInvoice?.pubkey ? "border-[var(--badge-border)] bg-[var(--badge-bg)] text-[var(--badge-fg)]" : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"].join(" ")}>
                    <p className="text-xs font-semibold">{row.invoiceNo}</p>
                    <p className="mt-1 text-[11px] opacity-85">Open: {formatLamportsAmount(row.openAmount, row.currency || "USD")}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {selectedInvoice ? (
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:col-span-5">
            <header className="border-b border-slate-200 bg-slate-50 px-3 py-2">
              <h2 className="text-xs font-semibold text-slate-800">Settlement Panel</h2>
            </header>
            <div className="space-y-3 p-3">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px]">
                  <p className="font-semibold">{selectedInvoice.invoiceNo}</p>
                  <p>Original: {formatLamportsAmount(selectedInvoice.originalAmount, selectedInvoice.currency || "USD")}</p>
                  <p>Paid: {formatLamportsAmount(selectedInvoice.paidAmount, selectedInvoice.currency || "USD")}</p>
                  <p>Credited: {formatLamportsAmount(selectedInvoice.creditedAmount, selectedInvoice.currency || "USD")}</p>
                  <p>Written-off: {formatLamportsAmount(selectedInvoice.writtenOffAmount, selectedInvoice.currency || "USD")}</p>
                  <p className="font-semibold">Open: {formatLamportsAmount(selectedInvoice.openAmount, selectedInvoice.currency || "USD")}</p>
                </div>

                <div className="rounded-md border border-slate-200 p-2 text-[11px]">
                  <p className="mb-1 font-semibold">Receipts</p>
                  {receipts.length === 0 ? <p className="text-slate-500">No receipts.</p> : receipts.map((row) => <p key={row.pubkey}>{row.receiptNo} / {formatLamportsAmount(row.amount)}</p>)}
                </div>

                <div className="rounded-md border border-slate-200 p-2 text-[11px]">
                  <p className="mb-1 font-semibold">Credit Notes</p>
                  {credits.length === 0 ? <p className="text-slate-500">No credit notes.</p> : credits.map((row) => <p key={row.pubkey}>{row.creditNo} / {formatLamportsAmount(row.amount)}</p>)}
                </div>

                {showSettlementCards ? (
                  <div className="space-y-2">
                    <details id="record-receipt" className="rounded-md border border-slate-200 bg-slate-50 p-2"><summary className="cursor-pointer text-[11px] font-semibold">Record Receipt</summary><div className="mt-2 grid gap-2"><Input label="Seq" value={receiptSeq} onChange={(e) => setReceiptSeq(e.target.value)} /><Input label="No" value={receiptNo} onChange={(e) => setReceiptNo(e.target.value)} /><Input label="Amount" value={receiptAmount} onChange={(e) => setReceiptAmount(e.target.value)} /><Input label="Date" type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} /><Input label="Reference" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} /><Button type="button" disabled={submitting === "receipt"} onClick={handleRecordReceipt}>{submitting === "receipt" ? "Recording…" : "Record"}</Button></div></details>
                    <details id="issue-credit-note" className="rounded-md border border-slate-200 bg-slate-50 p-2"><summary className="cursor-pointer text-[11px] font-semibold">Issue Credit Note</summary><div className="mt-2 grid gap-2"><Input label="Seq" value={creditSeq} onChange={(e) => setCreditSeq(e.target.value)} /><Input label="No" value={creditNo} onChange={(e) => setCreditNo(e.target.value)} /><Input label="Amount" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} /><Input label="Date" type="date" value={creditDate} onChange={(e) => setCreditDate(e.target.value)} /><Input label="Reason" value={creditReason} onChange={(e) => setCreditReason(e.target.value)} /><Button type="button" disabled={submitting === "credit"} onClick={handleIssueCreditNote}>{submitting === "credit" ? "Issuing…" : "Issue"}</Button></div></details>
                    <details id="write-off-invoice" className="rounded-md border border-slate-200 bg-slate-50 p-2"><summary className="cursor-pointer text-[11px] font-semibold">Write Off</summary><div className="mt-2 grid gap-2"><Input label="Amount" value={writeoffAmount} onChange={(e) => setWriteoffAmount(e.target.value)} /><Input label="Date" type="date" value={writeoffDate} onChange={(e) => setWriteoffDate(e.target.value)} /><Input label="Reason" value={writeoffReason} onChange={(e) => setWriteoffReason(e.target.value)} /><Button type="button" disabled={submitting === "writeoff"} onClick={handleWriteOffInvoice}>{submitting === "writeoff" ? "Writing off…" : "Write off"}</Button></div></details>
                    <div id="close-invoice" className="rounded-md border border-slate-200 bg-slate-50 p-2"><p className="text-[11px] font-semibold">Close Invoice</p><Button type="button" className="mt-2" disabled={selectedInvoice.openAmount !== 0 || !canWriteTransactions} onClick={async () => { if (!service || !ledgerPda || !selectedInvoice || !activeOnchainCustomerPubkey) return; const parsed = closeInvoiceSchema.safeParse({ ledgerPubkey: ledgerPda, customerPubkey: activeOnchainCustomerPubkey, invoicePubkey: selectedInvoice.pubkey }); if (!parsed.success) return; await service.closeInvoice({ ledgerPubkey: ledgerPda, customerPubkey: activeOnchainCustomerPubkey, invoicePubkey: selectedInvoice.pubkey }); await loadRecords(); setSuccess("Invoice closed"); }}>Close invoice</Button></div>
                  </div>
                ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
