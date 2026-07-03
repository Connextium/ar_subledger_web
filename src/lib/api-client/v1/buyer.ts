"use client";

export type {
  BuyerLedgerRecord,
  VendorInvoiceRecord,
  VendorPaymentRecord,
  VendorRecord,
} from "@ar-subledger/api-contracts/buyer";
import { apiFetch } from "@/lib/api-client/v1/http";

function workspacePath(workspaceId: string, segment: string): string {
  const normalized = segment.startsWith("/") ? segment : `/${segment}`;
  return `/api/v1/buyer/workspaces/${encodeURIComponent(workspaceId)}${normalized}`;
}

const WORKSPACE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isWorkspaceId(value: string): boolean {
  return WORKSPACE_ID_PATTERN.test(value.trim());
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
    if (typeof arg === "string" && arg.length > 0 && isWorkspaceId(arg)) {
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

function pickLedgerPubkey(args: unknown[], workspaceId: string | null): string | null {
  for (const arg of args) {
    if (typeof arg === "string" && arg.length > 0 && arg !== workspaceId && !isWorkspaceId(arg)) {
      return arg;
    }

    if (arg && typeof arg === "object") {
      const candidate = (arg as { ledgerPubkey?: unknown }).ledgerPubkey;
      if (typeof candidate === "string" && candidate.length > 0) {
        return candidate;
      }
    }
  }

  return null;
}

function pickBody(args: unknown[]): Record<string, unknown> {
  return (args.find((value) => value && typeof value === "object") as Record<string, unknown> | undefined) ?? {};
}

async function listByKey<T>(workspaceId: string, segment: string, key: string): Promise<T[]> {
  const payload = (await apiFetch(workspacePath(workspaceId, segment))) as Record<string, unknown>;
  const value = payload[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

function findById<T extends Record<string, unknown>>(items: T[], id: unknown): T | null {
  if (typeof id !== "string" || id.length === 0) {
    return null;
  }

  return (
    items.find((item) => {
      const candidates = [item.id, item.pubkey, item.ledgerPubkey, item.vendorPubkey, item.invoicePubkey];
      return candidates.some((candidate) => candidate === id);
    }) ?? null
  );
}

export class ApSubledgerService {
  constructor(_wallet?: unknown) {}

  async listBuyerLedgers(...args: unknown[]): Promise<any[]> {
    const workspaceId = pickWorkspaceId(args);
    if (!workspaceId) return [];
    return listByKey(workspaceId, "/ledgers", "ledgers");
  }

  async getBuyerLedger(...args: unknown[]): Promise<any | null> {
    const workspaceId = pickWorkspaceId(args);
    if (!workspaceId) return null;
    const ledgerId = args.find((arg) => typeof arg === "string" && arg !== workspaceId) as string | undefined;
    const ledgers = await this.listBuyerLedgers(workspaceId);
    return findById(ledgers as Record<string, unknown>[], ledgerId);
  }

  async initializeBuyerLedger(...args: unknown[]): Promise<any> {
    const workspaceId = pickWorkspaceId(args);
    if (!workspaceId) return null;
    const input = pickBody(args);
    const payload = (await apiFetch(workspacePath(workspaceId, "/ledgers"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    })) as Record<string, unknown>;
    return payload.ledger ?? null;
  }

  async listVendors(...args: unknown[]): Promise<any[]> {
    const workspaceId = pickWorkspaceId(args);
    if (!workspaceId) return [];

    const ledgerPubkey = pickLedgerPubkey(args, workspaceId);
    const query = ledgerPubkey ? `?ledgerPubkey=${encodeURIComponent(ledgerPubkey)}` : "";
    const payload = (await apiFetch(workspacePath(workspaceId, `/vendors${query}`))) as Record<string, unknown>;
    const value = payload.vendors;
    return Array.isArray(value) ? (value as any[]) : [];
  }

  async getVendor(...args: unknown[]): Promise<any | null> {
    const workspaceId = pickWorkspaceId(args);
    if (!workspaceId) return null;
    const vendorId = args.find((arg) => typeof arg === "string" && arg !== workspaceId) as string | undefined;
    const vendors = await this.listVendors(workspaceId);
    return findById(vendors as Record<string, unknown>[], vendorId);
  }

  async createVendor(...args: unknown[]): Promise<any> {
    const workspaceId = pickWorkspaceId(args);
    const body = pickBody(args);
    const payload = (await apiFetch(workspacePath(workspaceId, "/vendors"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })) as Record<string, unknown>;
    return payload.vendor ?? null;
  }

  async listVendorInvoices(...args: unknown[]): Promise<any[]> {
    const workspaceId = pickWorkspaceId(args);
    if (!workspaceId) return [];

    const ledgerPubkey = pickLedgerPubkey(args, workspaceId);
    const vendorPubkey =
      args.find((arg) => arg && typeof arg === "object" && "vendorPubkey" in arg && typeof (arg as { vendorPubkey?: unknown }).vendorPubkey === "string") as
        | { vendorPubkey?: string }
        | undefined;

    const query = new URLSearchParams();
    if (ledgerPubkey) query.set("ledgerPubkey", ledgerPubkey);
    if (vendorPubkey?.vendorPubkey) query.set("vendorPubkey", vendorPubkey.vendorPubkey);

    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    const payload = (await apiFetch(workspacePath(workspaceId, `/vendor-invoices${suffix}`))) as Record<string, unknown>;
    const value = payload.vendorInvoices;
    return Array.isArray(value) ? (value as any[]) : [];
  }

  async getVendorInvoice(...args: unknown[]): Promise<any | null> {
    const workspaceId = pickWorkspaceId(args);
    if (!workspaceId) return null;
    const invoiceId = args.find((arg) => typeof arg === "string" && arg !== workspaceId) as string | undefined;
    const invoices = await this.listVendorInvoices(workspaceId);
    return findById(invoices as Record<string, unknown>[], invoiceId);
  }

  async receiveVendorInvoice(...args: unknown[]): Promise<any> {
    const workspaceId = pickWorkspaceId(args);
    const body = pickBody(args);
    const payload = (await apiFetch(workspacePath(workspaceId, "/vendor-invoices"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })) as Record<string, unknown>;
    return payload.vendorInvoice ?? null;
  }

  async payVendorInvoice(...args: unknown[]): Promise<any> {
    return this.receiveVendorInvoice(...args);
  }

  async listVendorPayments(..._args: unknown[]): Promise<any[]> {
    return [];
  }
}

export function createApSubledgerService(wallet?: unknown): ApSubledgerService {
  return new ApSubledgerService(wallet);
}
