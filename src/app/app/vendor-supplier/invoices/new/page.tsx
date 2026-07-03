"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageTitle } from "@/components/ui/page-title";
import { Panel } from "@/components/ui/panel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useArSubledger } from "@/hooks/use-ar-subledger";
import { useRoleGate } from "@/hooks/use-role-gate";
import { useWorkspace } from "@/context/workspace-context";
import { useWorkingContext } from "@/context/working-context";
import { controlPlaneService } from "@/lib/api-client/v1/platform";
import { issueInvoiceSchema } from "@/lib/validation/schemas";
import { parseAmountToMinor } from "@/lib/utils/format";
import { mapAnchorError } from "@/lib/errors/ar-errors";

type FormErrors = Record<string, string>;

function toUnix(date: string): number {
  return Math.floor(new Date(date).getTime() / 1000);
}

function toMessage(error: unknown): string {
  if (error instanceof Error) return mapAnchorError(error);
  return "Request failed.";
}

export default function NewInvoicePage() {
  const router = useRouter();
  const service = useArSubledger();
  const { canWriteTransactions } = useRoleGate();
  const { selectedWorkspaceId } = useWorkspace();
  const { workspaceId, ledgerPda, customerId, setInvoicePubkey } = useWorkingContext();

  const activeWorkspaceId = workspaceId ?? selectedWorkspaceId;

  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [success, setSuccess] = useState<string | null>(null);

  const [activeOnchainCustomerPubkey, setActiveOnchainCustomerPubkey] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!activeWorkspaceId || !ledgerPda || !customerId) {
        if (!cancelled) setActiveOnchainCustomerPubkey("");
        return;
      }

      try {
        const links = await controlPlaneService.listWorkspaceCustomerLedgerLinks({
          workspaceId: activeWorkspaceId,
          workspaceCustomerId: customerId,
        });

        const match =
          links.find((row) => row.status === "active" && row.ledgerPda === ledgerPda) ?? null;

        if (!cancelled) {
          setActiveOnchainCustomerPubkey(match?.onchainCustomerPubkey ?? "");
        }
      } catch {
        if (!cancelled) {
          setActiveOnchainCustomerPubkey("");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, customerId, ledgerPda]);

  const canSubmit = useMemo(() => {
    return Boolean(
      canWriteTransactions &&
        service &&
        activeWorkspaceId &&
        ledgerPda &&
        activeOnchainCustomerPubkey &&
        !submitting,
    );
  }, [activeOnchainCustomerPubkey, activeWorkspaceId, canWriteTransactions, ledgerPda, service, submitting]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});
    setSuccess(null);

    if (!canWriteTransactions) {
      setErrors({ form: "Your current role does not allow transaction writes." });
      return;
    }

    if (!service || !activeWorkspaceId || !ledgerPda) {
      setErrors({ form: "Select a Supplier ledger in Supplier AR Context first." });
      return;
    }

    if (!activeOnchainCustomerPubkey) {
      setErrors({ form: "Select a customer linked to the selected Supplier ledger first." });
      return;
    }

    const parsed = issueInvoiceSchema.safeParse({
      ledgerPubkey: ledgerPda,
      customerPubkey: activeOnchainCustomerPubkey,
      invoiceNo,
      amount: invoiceAmount,
      issueDate,
      dueDate,
      currency,
      description,
    });

    if (!parsed.success) {
      setErrors({ form: parsed.error.issues[0]?.message ?? "Please fill in required invoice fields." });
      return;
    }

    setSubmitting(true);
    try {
      const amountMinor = parseAmountToMinor(invoiceAmount);
      const nextInvoice = await service.issueInvoice({
        workspaceId: activeWorkspaceId,
        ledgerPubkey: ledgerPda,
        customerPubkey: activeOnchainCustomerPubkey,
        invoiceNo,
        amountMinor,
        issueDateUnix: toUnix(issueDate),
        dueDateUnix: toUnix(dueDate),
        currency,
        description,
      });

      if (typeof nextInvoice !== "string" || nextInvoice.length === 0) {
        throw new Error("Invoice was submitted but invoice pubkey was not returned.");
      }

      setInvoicePubkey(nextInvoice);
      setSuccess(`Invoice issued: ${nextInvoice}`);
      router.push(`/app/vendor-supplier/invoices/${nextInvoice}`);
    } catch (error) {
      setErrors({ form: toMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <PageTitle
        title="New Invoice"
        subtitle="Create a new customer invoice for the selected supplier ledger and customer context."
        actions={
          <Link href="/app/vendor-supplier/invoices" className="text-[11px] underline decoration-slate-300">
            Back to invoices
          </Link>
        }
      />

      <Panel title="Issue Invoice" subtitle="Uses AR Subledger PDA program via protected API route.">
        <form className="space-y-2" onSubmit={onSubmit}>
          <Input label="Invoice no" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
          <Input label="Amount" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} />
          <Input label="Issue date" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          <Input label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <Input label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
          <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />

          {errors.form ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">{errors.form}</p>
          ) : null}

          {success ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">{success}</p>
          ) : null}

          {!activeWorkspaceId || !ledgerPda || !customerId ? (
            <p className="text-[11px] text-slate-600">
              Choose workspace, supplier ledger, and customer from the context bar before issuing invoice.
            </p>
          ) : null}

          {activeWorkspaceId && ledgerPda && customerId && !activeOnchainCustomerPubkey ? (
            <p className="text-[11px] text-slate-600">
              Selected customer is not linked to this supplier ledger yet.
            </p>
          ) : null}

          <Button type="submit" disabled={!canSubmit}>
            {submitting ? "Issuing..." : "Issue"}
          </Button>
        </form>
      </Panel>
    </div>
  );
}
