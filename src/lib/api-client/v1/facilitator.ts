"use client";

export type {
  SettlementDocumentRecord,
  SettlementExecutionRecord,
  SettlementRouteRecord,
} from "@ar-subledger/api-contracts/facilitator";
import { apiFetch } from "@/lib/api-client/v1/http";

const WORKSPACE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isWorkspaceId(value: string): boolean {
  return WORKSPACE_ID_PATTERN.test(value.trim());
}

function workspacePath(workspaceId: string, segment: string): string {
  const normalized = segment.startsWith("/") ? segment : `/${segment}`;
  return `/api/v1/facilitator/workspaces/${encodeURIComponent(workspaceId)}${normalized}`;
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
      if (typeof workspaceId === "string" && workspaceId.length > 0 && isWorkspaceId(workspaceId)) {
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

function findById<T extends Record<string, unknown>>(items: T[], id: unknown): T | null {
  if (typeof id !== "string" || id.length === 0) {
    return null;
  }

  return (
    items.find((item) => {
      const candidates = [item.id, item.pubkey, item.routePubkey, item.documentPubkey, item.executionPubkey];
      return candidates.some((candidate) => candidate === id);
    }) ?? null
  );
}

export class SettlementFacilitatorService {
  constructor(_wallet?: unknown) {}

  async listRoutes(...args: unknown[]): Promise<any[]> {
    const workspaceId = pickWorkspaceId(args);
    if (!workspaceId) return [];
    return listByKey(workspaceId, "/routes", "routes");
  }

  async getRoute(...args: unknown[]): Promise<any | null> {
    const workspaceId = pickWorkspaceId(args);
    if (!workspaceId) return null;
    const routeId = args.find((arg) => typeof arg === "string" && arg !== workspaceId) as string | undefined;
    const routes = await this.listRoutes(workspaceId);
    return findById(routes as Record<string, unknown>[], routeId);
  }

  async initializeRoute(...args: unknown[]): Promise<any> {
    const workspaceId = pickWorkspaceId(args);
    const body = pickBody(args);
    const payload = (await apiFetch(workspacePath(workspaceId, "/routes"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })) as Record<string, unknown>;
    return payload.route ?? null;
  }

  async listDocuments(...args: unknown[]): Promise<any[]> {
    const workspaceId = pickWorkspaceId(args);
    if (!workspaceId) return [];
    return listByKey(workspaceId, "/documents", "documents");
  }

  async getDocument(...args: unknown[]): Promise<any | null> {
    const workspaceId = pickWorkspaceId(args);
    if (!workspaceId) return null;
    const documentId = args.find((arg) => typeof arg === "string" && arg !== workspaceId) as string | undefined;
    const documents = await this.listDocuments(workspaceId);
    return findById(documents as Record<string, unknown>[], documentId);
  }

  async getDocumentMatch(...args: unknown[]): Promise<{
    document: any | null;
    route: any | null;
    buyerInvoice: any | null;
    supplierInvoice: any | null;
    supplierInvoices?: any[];
    debug?: any;
  }> {
    const workspaceId = pickWorkspaceId(args);
    const documentId = args.find((arg) => typeof arg === "string" && arg !== workspaceId) as string | undefined;
    if (!workspaceId || !documentId) {
      return { document: null, route: null, buyerInvoice: null, supplierInvoice: null };
    }

    const qs = new URLSearchParams({ documentPubkey: documentId, debug: "1" });
    const payload = (await apiFetch(`${workspacePath(workspaceId, "/documents")}?${qs.toString()}`)) as {
      document?: any;
      route?: any;
      buyerInvoice?: any;
      supplierInvoice?: any;
      supplierInvoices?: any[];
      debug?: any;
    };

    return {
      document: payload.document ?? null,
      route: payload.route ?? null,
      buyerInvoice: payload.buyerInvoice ?? null,
      supplierInvoice: payload.supplierInvoice ?? null,
      supplierInvoices: Array.isArray(payload.supplierInvoices) ? payload.supplierInvoices : [],
      debug: payload.debug ?? null,
    };
  }

  async registerDocument(...args: unknown[]): Promise<any> {
    const workspaceId = pickWorkspaceId(args);
    const body = pickBody(args);
    const payload = (await apiFetch(workspacePath(workspaceId, "/documents"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })) as Record<string, unknown>;
    return payload.document ?? null;
  }

  async cancelDocument(...args: unknown[]): Promise<any> {
    return this.registerDocument(...args);
  }

  async listExecutions(...args: unknown[]): Promise<any[]> {
    const workspaceId = pickWorkspaceId(args);
    if (!workspaceId) return [];
    return listByKey(workspaceId, "/executions", "executions");
  }

  async getExecution(...args: unknown[]): Promise<any | null> {
    const workspaceId = pickWorkspaceId(args);
    if (!workspaceId) return null;
    const executionId = args.find((arg) => typeof arg === "string" && arg !== workspaceId) as string | undefined;
    const executions = await this.listExecutions(workspaceId);
    return findById(executions as Record<string, unknown>[], executionId);
  }

  async executeSettlement(...args: unknown[]): Promise<{ execution: string | null; signature: string | null }> {
    const workspaceId = pickWorkspaceId(args);
    const body = pickBody(args);
    const payload = (await apiFetch(workspacePath(workspaceId, "/executions"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })) as Record<string, unknown>;
    return {
      execution: typeof payload.execution === "string" ? payload.execution : null,
      signature: typeof payload.signature === "string" ? payload.signature : null,
    };
  }
}

export function createSettlementFacilitatorService(wallet?: unknown): SettlementFacilitatorService {
  return new SettlementFacilitatorService(wallet);
}
