"use client";

export type {
  AppRole,
  Workspace,
  WorkspaceBuyerLedgerLink,
  WorkspaceCustomer,
  WorkspaceCustomerCodeRegistryEntry,
  WorkspaceCustomerLedgerLink,
  WorkspaceLedgerLink,
  WorkspaceMember,
  WorkspaceSettlementDocument,
  WorkspaceSettlementExecution,
  WorkspaceSettlementRoute,
  WorkspaceVendor,
  WorkspaceVendorLedgerLink,
} from "@ar-subledger/api-contracts/platform";
import { apiFetch } from "@/lib/api-client/v1/http";

function platformPath(workspaceId: string, segment: string): string {
  const normalized = segment.startsWith("/") ? segment : `/${segment}`;
  return `/api/v1/platform/workspaces/${encodeURIComponent(workspaceId)}${normalized}`;
}

function buyerPath(workspaceId: string, segment: string): string {
  const normalized = segment.startsWith("/") ? segment : `/${segment}`;
  return `/api/v1/buyer/workspaces/${encodeURIComponent(workspaceId)}${normalized}`;
}

function supplierPath(workspaceId: string, segment: string): string {
  const normalized = segment.startsWith("/") ? segment : `/${segment}`;
  return `/api/v1/supplier/workspaces/${encodeURIComponent(workspaceId)}${normalized}`;
}

function facilitatorPath(workspaceId: string, segment: string): string {
  const normalized = segment.startsWith("/") ? segment : `/${segment}`;
  return `/api/v1/facilitator/workspaces/${encodeURIComponent(workspaceId)}${normalized}`;
}

function pickWorkspaceId(args: unknown[]): string {
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

  throw new Error("workspaceId is required");
}

function pickBody(args: unknown[]): Record<string, unknown> {
  return (args.find((value) => value && typeof value === "object") as Record<string, unknown> | undefined) ?? {};
}

async function listByKey(path: string, key: string): Promise<unknown[]> {
  const payload = (await apiFetch(path)) as Record<string, unknown>;
  const value = payload[key];
  return Array.isArray(value) ? value : [];
}

async function postJson(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  return (await apiFetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })) as Record<string, unknown>;
}

function extractId(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const candidate = record.id ?? record.pubkey ?? record.ledgerPubkey ?? record.vendorPubkey ?? record.customerPubkey;
  return typeof candidate === "string" ? candidate : null;
}

function findById(items: unknown[], id: unknown): unknown | null {
  if (typeof id !== "string" || id.length === 0) {
    return null;
  }

  return items.find((item) => extractId(item) === id) ?? null;
}

function toWorkspaceLedgerLink(workspaceId: string, ledger: unknown, status: "active" | "inactive" = "active") {
  const record = (ledger ?? {}) as Record<string, unknown>;
  const ledgerPda = extractId(ledger) ?? "";
  const createdAtValue = record.createdAt ?? record.created_at;
  const createdAt =
    typeof createdAtValue === "string" && createdAtValue.length > 0
      ? createdAtValue
      : new Date(0).toISOString();

  return {
    id: ledgerPda || crypto.randomUUID(),
    workspaceId,
    ledgerPda,
    ledgerCode: typeof record.ledgerCode === "string" ? record.ledgerCode : "",
    authorityPubkey: typeof record.authority === "string" ? record.authority : "",
    onchainLedgerKey:
      typeof record.accountingLedger === "string" && record.accountingLedger.length > 0
        ? record.accountingLedger
        : null,
    status,
    createdAt,
  };
}

export const controlPlaneService: any = {
  async listWorkspaces() {
    return listByKey("/api/v1/platform/workspaces", "workspaces");
  },

  async createWorkspace(name: unknown) {
    return postJson("/api/v1/platform/workspaces", { name });
  },

  async getRole(workspaceId: string, userId?: string) {
    if (!workspaceId || !userId) {
      return "viewer";
    }

    const payload = (await apiFetch(platformPath(workspaceId, "/members"))) as { members?: Array<{ userId?: string; role?: string }> };
    const members = Array.isArray(payload.members) ? payload.members : [];
    const member = members.find((row) => row?.userId === userId);
    const role = member?.role;
    return role === "admin" || role === "accountant" || role === "viewer" ? role : "viewer";
  },

  async listWorkspaceVendors(...args: unknown[]) {
    const workspaceId = pickWorkspaceId(args);
    if (!workspaceId) return [];
    return listByKey(buyerPath(workspaceId, "/vendors"), "vendors");
  },

  async createWorkspaceVendor(...args: unknown[]) {
    const workspaceId = pickWorkspaceId(args);
    const body = pickBody(args);
    const payload = await postJson(buyerPath(workspaceId, "/vendors"), body);
    return payload.vendor ?? null;
  },

  async updateWorkspaceVendor(...args: unknown[]) {
    return this.createWorkspaceVendor(...args);
  },

  async listWorkspaceVendorLedgerLinks(...args: unknown[]) {
    const workspaceId = pickWorkspaceId(args);
    if (!workspaceId) return [];
    const ledgers = await listByKey(buyerPath(workspaceId, "/ledgers"), "ledgers");
    return ledgers.map((ledger) => ({
      id: extractId(ledger),
      ledgerPubkey: extractId(ledger),
      status: "active",
    })) as any[];
  },

  async upsertWorkspaceVendorLedgerLink(...args: unknown[]) {
    const workspaceId = pickWorkspaceId(args);
    const body = pickBody(args);
    return postJson(buyerPath(workspaceId, "/ledgers"), body);
  },

  async listWorkspaceCustomers(...args: unknown[]) {
    const workspaceId = pickWorkspaceId(args);
    if (!workspaceId) return [];
    return listByKey(supplierPath(workspaceId, "/customers"), "customers");
  },

  async createWorkspaceCustomer(...args: unknown[]) {
    const workspaceId = pickWorkspaceId(args);
    const body = pickBody(args);
    const payload = await postJson(supplierPath(workspaceId, "/customers"), body);
    return payload.customer ?? null;
  },

  async updateWorkspaceCustomer(...args: unknown[]) {
    return this.createWorkspaceCustomer(...args);
  },

  async listWorkspaceCustomerLedgerLinks(...args: unknown[]) {
    const workspaceId = pickWorkspaceId(args);
    if (!workspaceId) return [];
    return listByKey(supplierPath(workspaceId, "/customer-ledger-links"), "links");
  },

  async linkWorkspaceCustomerToLedger(...args: unknown[]) {
    const workspaceId = pickWorkspaceId(args);
    const body = pickBody(args);
    const payload = await postJson(supplierPath(workspaceId, "/customer-ledger-links"), body);
    return payload.link ?? null;
  },

  async listWorkspaceCustomerCodeRegistry(_workspaceId: string) {
    return [];
  },

  async reserveWorkspaceCustomerCode(..._args: unknown[]) {
    return { reserved: false };
  },

  async listWorkspaceSettlementRoutes(...args: unknown[]) {
    const workspaceId = pickWorkspaceId(args);
    if (!workspaceId) return [];
    const routes = await listByKey(facilitatorPath(workspaceId, "/routes"), "routes");
    return routes.map((route) => {
      const record = (route ?? {}) as Record<string, unknown>;

      if (typeof record.routePda === "string") {
        return {
          id:
            typeof record.id === "string" && record.id.length > 0
              ? record.id
              : record.routePda,
          workspaceId,
          routePda: record.routePda,
          routeCode: typeof record.routeCode === "string" ? record.routeCode : "",
          facilitatorPubkey:
            typeof record.facilitatorPubkey === "string"
              ? record.facilitatorPubkey
              : typeof record.facilitator === "string"
                ? record.facilitator
                : "",
          buyerAccountingLedger:
            typeof record.buyerAccountingLedger === "string" ? record.buyerAccountingLedger : "",
          supplierAccountingLedger:
            typeof record.supplierAccountingLedger === "string" ? record.supplierAccountingLedger : "",
          status: record.status === "inactive" ? "inactive" : "active",
          createdAt:
            typeof record.createdAt === "string" && record.createdAt.length > 0
              ? record.createdAt
              : new Date(0).toISOString(),
          updatedAt:
            typeof record.updatedAt === "string" && record.updatedAt.length > 0
              ? record.updatedAt
              : new Date(0).toISOString(),
        };
      }

      const routePda = typeof record.pubkey === "string" ? record.pubkey : "";
      return {
        id: routePda || crypto.randomUUID(),
        workspaceId,
        routePda,
        routeCode: typeof record.routeCode === "string" ? record.routeCode : "",
        facilitatorPubkey: typeof record.facilitator === "string" ? record.facilitator : "",
        buyerAccountingLedger:
          typeof record.buyerAccountingLedger === "string" ? record.buyerAccountingLedger : "",
        supplierAccountingLedger:
          typeof record.supplierAccountingLedger === "string" ? record.supplierAccountingLedger : "",
        status: record.active === false ? "inactive" : "active",
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      };
    });
  },

  async upsertWorkspaceSettlementRoute(...args: unknown[]) {
    const workspaceId = pickWorkspaceId(args);
    const body = pickBody(args);
    const payload = await postJson(facilitatorPath(workspaceId, "/routes"), body);
    return payload.route ?? null;
  },

  async listBuyerLedgerLinks(...args: unknown[]) {
    const workspaceId = pickWorkspaceId(args);
    if (!workspaceId) return [];
    const ledgers = await listByKey(buyerPath(workspaceId, "/ledgers"), "ledgers");
    return ledgers.map((ledger) => toWorkspaceLedgerLink(workspaceId, ledger));
  },

  async upsertBuyerLedgerLink(...args: unknown[]) {
    const workspaceId = pickWorkspaceId(args);
    const body = pickBody(args);
    return postJson(buyerPath(workspaceId, "/ledgers"), body);
  },

  async setLedgerLinkStatus(...args: unknown[]) {
    const workspaceId = pickWorkspaceId(args);
    const body = pickBody(args);
    return postJson(buyerPath(workspaceId, "/ledgers"), body);
  },

  async listLedgerLinks(...args: unknown[]) {
    const workspaceId = pickWorkspaceId(args);
    if (!workspaceId) return [];
    const [buyerLinks, supplierLinks] = await Promise.all([
      this.listBuyerLedgerLinks(workspaceId),
      this.listWorkspaceCustomerLedgerLinks(workspaceId),
    ]);
    return [...buyerLinks, ...supplierLinks];
  },

  async listAccessibleLedgerLinks() {
    const workspaces = await this.listWorkspaces();
    const workspace = workspaces[0];
    const workspaceId = extractId(workspace);
    if (!workspaceId) {
      return [];
    }

    return this.listLedgerLinks(workspaceId);
  },

  async linkLedgerToWorkspace(...args: unknown[]) {
    const workspaceId = pickWorkspaceId(args);
    const body = pickBody(args);
    return postJson(platformPath(workspaceId, "/wallets"), body);
  },

  async getWorkspaceVendor(workspaceId: string, vendorId: string) {
    const vendors = await this.listWorkspaceVendors(workspaceId);
    return findById(vendors, vendorId);
  },

  async getWorkspaceCustomer(workspaceId: string, customerId: string) {
    const customers = await this.listWorkspaceCustomers(workspaceId);
    return findById(customers, customerId);
  },
};
