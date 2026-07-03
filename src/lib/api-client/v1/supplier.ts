"use client";

export type {
  ActivityItem,
  CreditNoteRecord,
  CustomerRecord,
  InvoiceRecord,
  LedgerRecord,
  ReceiptRecord,
  WriteOffRecord,
} from "@ar-subledger/api-contracts/supplier";
import { apiFetch } from "@/lib/api-client/v1/http";

function workspacePath(workspaceId: string, segment: string): string {
  const normalized = segment.startsWith("/") ? segment : `/${segment}`;
  return `/api/v1/supplier/workspaces/${encodeURIComponent(workspaceId)}${normalized}`;
}

function resolveWorkspaceIdFromBrowserContext(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const fromQuery = new URL(window.location.href).searchParams.get("workspace")?.trim();
  if (fromQuery) {
    return fromQuery;
  }

  const raw = window.sessionStorage.getItem("ar:working-context");
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { workspaceId?: unknown };
    return typeof parsed.workspaceId === "string" && parsed.workspaceId.length > 0 ? parsed.workspaceId : null;
  } catch {
    return null;
  }
}

function pickWorkspaceId(args: unknown[]): string | null {
  for (const arg of args) {
    if (typeof arg === "string" && arg.length > 0) {
      return arg;
    }
    if (arg && typeof arg === "object" && "workspaceId" in arg) {
      const workspaceId = (arg as { workspaceId?: unknown }).workspaceId;
      if (typeof workspaceId === "string" && workspaceId.length > 0) {
        return workspaceId;
      }
    }
  }

  return resolveWorkspaceIdFromBrowserContext();
}

function pickBody(args: unknown[]): Record<string, unknown> {
  return (args.find((value) => value && typeof value === "object") as Record<string, unknown> | undefined) ?? {};
}

async function listByKey<T>(workspaceId: string, segment: string, key: string): Promise<T[]> {
  const payload = (await apiFetch(workspacePath(workspaceId, segment))) as Record<string, unknown>;
  const value = payload[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

function toQueryString(filters: Record<string, string | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (typeof value === "string" && value.length > 0) {
      params.set(key, value);
    }
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

function findById<T extends Record<string, unknown>>(items: T[], id: unknown): T | null {
  if (typeof id !== "string" || id.length === 0) {
    return null;
  }

  return (
    items.find((item) => {
      const candidates = [item.id, item.pubkey, item.ledgerPubkey, item.customerPubkey, item.invoicePubkey];
      return candidates.some((candidate) => candidate === id);
    }) ?? null
  );
}

export class ArSubledgerService {
  constructor(_wallet?: unknown) {}

  async listLedgers(...args: unknown[]): Promise<any[]> {
    const workspaceId = pickWorkspaceId(args);
    if (!workspaceId) return [];
    return listByKey(workspaceId, "/ledgers", "ledgers");
  }

  async getLedger(...args: unknown[]): Promise<any | null> {
    const workspaceId = pickWorkspaceId(args);
    if (!workspaceId) return null;
    const ledgerId = args.find((arg) => typeof arg === "string" && arg !== workspaceId) as string | undefined;
    const ledgers = await this.listLedgers(workspaceId);
    return findById(ledgers as Record<string, unknown>[], ledgerId);
  }

  async initializeLedger(...args: unknown[]): Promise<any> {
    const workspaceId = pickWorkspaceId(args);
    const body = pickBody(args);
    const payload = (await apiFetch(workspacePath(workspaceId, "/ledgers"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })) as Record<string, unknown>;
    return payload.ledger ?? null;
  }

  async listCustomers(...args: unknown[]): Promise<any[]> {
    const workspaceId = pickWorkspaceId(args);
    if (!workspaceId) return [];
    return listByKey(workspaceId, "/customers", "customers");
  }

  async getCustomer(...args: unknown[]): Promise<any | null> {
    const workspaceId = pickWorkspaceId(args);
    if (!workspaceId) return null;
    const customerId = args.find((arg) => typeof arg === "string" && arg !== workspaceId) as string | undefined;
    const customers = await this.listCustomers(workspaceId);
    return findById(customers as Record<string, unknown>[], customerId);
  }

  async createCustomer(...args: unknown[]): Promise<any> {
    const workspaceId = pickWorkspaceId(args);
    if (!workspaceId) return null;
    const body = pickBody(args);
    const payload = (await apiFetch(workspacePath(workspaceId, "/customers"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })) as Record<string, unknown>;
    return payload.customer ?? null;
  }

  async issueInvoice(...args: unknown[]): Promise<any> {
    const workspaceId = pickWorkspaceId(args);
    const body = pickBody(args);
    const payload = (await apiFetch(workspacePath(workspaceId, "/invoices"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })) as Record<string, unknown>;

    const invoice = payload.invoice;
    if (typeof invoice === "string") {
      return invoice;
    }

    if (invoice && typeof invoice === "object") {
      const record = invoice as Record<string, unknown>;
      if (typeof record.pubkey === "string") {
        return record.pubkey;
      }
    }

    return null;
  }

  async listInvoices(...args: unknown[]): Promise<any[]> {
    const workspaceId = pickWorkspaceId(args);
    if (!workspaceId) return [];

    const candidate = args.find((arg) => arg && typeof arg === "object") as
      | { ledgerPda?: unknown; customerPubkey?: unknown }
      | undefined;

    const ledgerPda = typeof candidate?.ledgerPda === "string" ? candidate.ledgerPda : null;
    const customerPubkey = typeof candidate?.customerPubkey === "string" ? candidate.customerPubkey : null;
    const query = toQueryString({ ledgerPda, customerPubkey });

    const payload = (await apiFetch(workspacePath(workspaceId, `/invoices${query}`))) as Record<string, unknown>;
    const value = payload.invoices;
    return Array.isArray(value) ? (value as any[]) : [];
  }

  async getInvoice(...args: unknown[]): Promise<any | null> {
    const workspaceId = pickWorkspaceId(args);
    if (!workspaceId) return null;
    const invoiceId = args.find((arg) => typeof arg === "string" && arg !== workspaceId) as string | undefined;
    const invoices = await this.listInvoices(workspaceId);
    return findById(invoices as Record<string, unknown>[], invoiceId);
  }

  async closeInvoice(...args: unknown[]): Promise<any> {
    return this.issueInvoice(...args);
  }

  async issueCreditNote(...args: unknown[]): Promise<any> {
    return this.issueInvoice(...args);
  }

  async recordReceipt(...args: unknown[]): Promise<any> {
    return this.issueInvoice(...args);
  }

  async writeOffInvoice(...args: unknown[]): Promise<any> {
    return this.issueInvoice(...args);
  }

  async listActivity(...args: unknown[]): Promise<any[]> {
    const workspaceId = pickWorkspaceId(args);
    if (!workspaceId) return [];
    const [invoices, receipts, writeOffs, creditNotes] = await Promise.all([
      this.listInvoices(workspaceId),
      this.listReceipts(workspaceId),
      this.listWriteOffs(workspaceId),
      this.listCreditNotes(workspaceId),
    ]);
    return [...invoices, ...receipts, ...writeOffs, ...creditNotes];
  }

  async listReceipts(..._args: unknown[]): Promise<any[]> {
    return [];
  }

  async listWriteOffs(..._args: unknown[]): Promise<any[]> {
    return [];
  }

  async listCreditNotes(..._args: unknown[]): Promise<any[]> {
    return [];
  }
}

export function createArSubledgerService(wallet?: unknown): ArSubledgerService {
  return new ArSubledgerService(wallet);
}
