"use client";

import { supabase } from "@/lib/supabase/client";
import type {
  AppRole,
  Workspace,
  WorkspaceCustomer,
  WorkspaceCustomerCodeRegistryEntry,
  WorkspaceCustomerLedgerLink,
  WorkspaceLedgerLink,
  WorkspaceMember,
} from "@/lib/types/domain";
import { env } from "@/lib/config/env";

const LOCAL_CONTROL_PLANE_KEY = "ar:control-plane";

type LocalControlPlane = {
  workspaces: Workspace[];
  members: WorkspaceMember[];
  ledgers: WorkspaceLedgerLink[];
  customers: WorkspaceCustomer[];
  customerCodeRegistry: WorkspaceCustomerCodeRegistryEntry[];
  customerLedgerLinks: WorkspaceCustomerLedgerLink[];
};

function isSupabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

function readLocalState(): LocalControlPlane {
  if (typeof window === "undefined") {
    return {
      workspaces: [],
      members: [],
      ledgers: [],
      customers: [],
      customerCodeRegistry: [],
      customerLedgerLinks: [],
    };
  }
  const raw = window.localStorage.getItem(LOCAL_CONTROL_PLANE_KEY);
  if (!raw)
    return {
      workspaces: [],
      members: [],
      ledgers: [],
      customers: [],
      customerCodeRegistry: [],
      customerLedgerLinks: [],
    };
  try {
    const parsed = JSON.parse(raw) as Partial<LocalControlPlane>;
    return {
      workspaces: parsed.workspaces ?? [],
      members: parsed.members ?? [],
      ledgers: parsed.ledgers ?? [],
      customers: parsed.customers ?? [],
      customerCodeRegistry: parsed.customerCodeRegistry ?? [],
      customerLedgerLinks: parsed.customerLedgerLinks ?? [],
    };
  } catch (e) {
    // Debug log for persistent corruption
    console.error("Failed to parse ar:control-plane from localStorage", {
      raw,
      error: e,
    });
    return {
      workspaces: [],
      members: [],
      ledgers: [],
      customers: [],
      customerCodeRegistry: [],
      customerLedgerLinks: [],
    };
  }
}

function writeLocalState(state: LocalControlPlane): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_CONTROL_PLANE_KEY, JSON.stringify(state));
}

export class ControlPlaneService {
  async listWorkspaces(userId: string): Promise<Workspace[]> {
    if (!isSupabaseConfigured()) {
      const state = readLocalState();
      const workspaceIds = state.members
        .filter((member) => member.userId === userId)
        .map((member) => member.workspaceId);
      return state.workspaces.filter((workspace) => workspaceIds.includes(workspace.id));
    }

    const { data, error } = await supabase
      .from("workspace_members")
      .select("workspace_id, workspaces(id,name,created_by,created_at)")
      .eq("user_id", userId);

    const { data: ownerRows } = await supabase
      .from("workspaces")
      .select("id,name,created_by,created_at")
      .eq("created_by", userId);

    const memberWorkspaceRows = (error || !data
      ? []
      : (data as Array<{ workspaces: unknown }>).flatMap((item) => {
          if (Array.isArray(item.workspaces)) return item.workspaces;
          return item.workspaces ? [item.workspaces] : [];
        })) as Array<{ id: unknown; name: unknown; created_by: unknown; created_at: unknown }>;

    const merged = [...memberWorkspaceRows, ...((ownerRows ?? []) as typeof memberWorkspaceRows)];
    const deduped = new Map<string, Workspace>();
    for (const ws of merged) {
      const id = String(ws.id);
      deduped.set(id, {
        id: String(ws.id),
        name: String(ws.name),
        createdBy: String(ws.created_by),
        createdAt: String(ws.created_at),
      });
    }
    return Array.from(deduped.values());
  }

  async getRole(workspaceId: string, userId: string): Promise<AppRole> {
    if (!isSupabaseConfigured()) {
      const state = readLocalState();
      return (
        state.members.find(
          (candidate) => candidate.workspaceId === workspaceId && candidate.userId === userId,
        )?.role ?? "admin"
      );
    }

    const { data, error } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .single();

    if (error || !data) return "admin";
    return data.role as AppRole;
  }

  async listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    if (!isSupabaseConfigured()) {
      const state = readLocalState();
      return state.members.filter((row) => row.workspaceId === workspaceId);
    }

    const { data, error } = await supabase
      .from("workspace_members")
      .select("workspace_id,user_id,role")
      .eq("workspace_id", workspaceId);

    if (error || !data) return [];

    return data.map((row) => ({
      workspaceId: row.workspace_id,
      userId: row.user_id,
      role: row.role as AppRole,
    }));
  }

  async listLedgerLinks(workspaceId: string): Promise<WorkspaceLedgerLink[]> {
    if (!isSupabaseConfigured()) {
      const state = readLocalState();
      return state.ledgers
        .filter((ledger) => ledger.workspaceId === workspaceId)
        .map((ledger) => ({
          ...ledger,
          status: ledger.status ?? "active",
        }));
    }

    const { data, error } = await supabase
      .from("ledgers")
      .select("id,workspace_id,ledger_pda,ledger_code,authority_pubkey,onchain_ledger_key,status,created_at")
      .eq("workspace_id", workspaceId);

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      ledgerPda: row.ledger_pda,
      ledgerCode: row.ledger_code,
      authorityPubkey: row.authority_pubkey,
      onchainLedgerKey: row.onchain_ledger_key,
      status: row.status ?? "active",
      createdAt: row.created_at,
    }));
  }

  async listAccessibleLedgerLinks(): Promise<WorkspaceLedgerLink[]> {
    if (!isSupabaseConfigured()) {
      const state = readLocalState();
      return state.ledgers.map((ledger) => ({
        ...ledger,
        status: ledger.status ?? "active",
      }));
    }

    const { data, error } = await supabase
      .from("ledgers")
      .select("id,workspace_id,ledger_pda,ledger_code,authority_pubkey,onchain_ledger_key,status,created_at")
      .order("created_at", { ascending: true });

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      ledgerPda: row.ledger_pda,
      ledgerCode: row.ledger_code,
      authorityPubkey: row.authority_pubkey,
      onchainLedgerKey: row.onchain_ledger_key,
      status: row.status ?? "active",
      createdAt: row.created_at,
    }));
  }

  async createWorkspace(name: string, userId: string): Promise<Workspace | null> {
    if (!isSupabaseConfigured()) {
      const state = readLocalState();
      const workspace: Workspace = {
        id: crypto.randomUUID(),
        name,
        createdBy: userId,
        createdAt: new Date().toISOString(),
      };
      state.workspaces.push(workspace);
      state.members.push({ workspaceId: workspace.id, userId, role: "admin" });
      writeLocalState(state);
      return workspace;
    }

    const { data, error } = await supabase
      .from("workspaces")
      .insert({ name, created_by: userId })
      .select("id,name,created_by,created_at")
      .single();

    if (error) {
      throw new Error(`Failed to create workspace: ${error.message}`);
    }
    if (!data) {
      throw new Error("Failed to create workspace: insert returned no row.");
    }

    const { error: memberInsertError } = await supabase
      .from("workspace_members")
      .insert({ workspace_id: data.id, user_id: userId, role: "admin" });
    if (memberInsertError) {
      throw new Error(
        `Workspace created but member bootstrap failed: ${memberInsertError.message}. Re-run migration/policies.`,
      );
    }

    return {
      id: data.id,
      name: data.name,
      createdBy: data.created_by,
      createdAt: data.created_at,
    };
  }

  async linkLedgerToWorkspace(payload: {
    workspaceId: string;
    ledgerPda: string;
    ledgerCode: string;
    authorityPubkey: string;
    onchainLedgerKey?: string;
    status?: "active" | "inactive";
  }): Promise<void> {
    const normalizedLedgerCode = payload.ledgerCode.trim().toUpperCase();

    if (!isSupabaseConfigured()) {
      const state = readLocalState();
      const conflict = state.ledgers.find(
        (ledger) =>
          ledger.workspaceId === payload.workspaceId &&
          ledger.ledgerPda !== payload.ledgerPda &&
          ledger.ledgerCode.trim().toUpperCase() === normalizedLedgerCode,
      );
      if (conflict) {
        throw new Error(`Ledger code '${normalizedLedgerCode}' already exists in this workspace.`);
      }

      const existingIndex = state.ledgers.findIndex(
        (ledger) =>
          ledger.workspaceId === payload.workspaceId && ledger.ledgerPda === payload.ledgerPda,
      );
      const row: WorkspaceLedgerLink = {
        id: existingIndex >= 0 ? state.ledgers[existingIndex].id : crypto.randomUUID(),
        workspaceId: payload.workspaceId,
        ledgerPda: payload.ledgerPda,
        ledgerCode: normalizedLedgerCode,
        authorityPubkey: payload.authorityPubkey,
        onchainLedgerKey: payload.onchainLedgerKey ?? null,
        status: payload.status ?? "active",
        createdAt:
          existingIndex >= 0
            ? state.ledgers[existingIndex].createdAt
            : new Date().toISOString(),
      };
      if (existingIndex >= 0) {
        state.ledgers[existingIndex] = row;
      } else {
        state.ledgers.push(row);
      }
      writeLocalState(state);
      return;
    }

    const { data: codeRows, error: codeError } = await supabase
      .from("ledgers")
      .select("ledger_pda,ledger_code")
      .eq("workspace_id", payload.workspaceId);

    if (codeError) {
      throw new Error(`Failed to validate ledger code uniqueness: ${codeError.message}`);
    }

    const conflict = (codeRows ?? []).find(
      (row) =>
        row.ledger_pda !== payload.ledgerPda &&
        String(row.ledger_code).trim().toUpperCase() === normalizedLedgerCode,
    );

    if (conflict) {
      throw new Error(`Ledger code '${normalizedLedgerCode}' already exists in this workspace.`);
    }

    const { error } = await supabase.from("ledgers").upsert(
      {
        workspace_id: payload.workspaceId,
        ledger_pda: payload.ledgerPda,
        ledger_code: normalizedLedgerCode,
        authority_pubkey: payload.authorityPubkey,
        onchain_ledger_key: payload.onchainLedgerKey ?? null,
        status: payload.status ?? "active",
      },
      { onConflict: "workspace_id,ledger_pda" },
    );

    if (error) {
      throw new Error(`Failed to link ledger to workspace: ${error.message}`);
    }
  }

  async setLedgerLinkStatus(payload: {
    workspaceId: string;
    ledgerPda: string;
    status: "active" | "inactive";
  }): Promise<void> {
    if (!isSupabaseConfigured()) {
      const state = readLocalState();
      const index = state.ledgers.findIndex(
        (ledger) =>
          ledger.workspaceId === payload.workspaceId && ledger.ledgerPda === payload.ledgerPda,
      );
      if (index < 0) return;
      state.ledgers[index] = {
        ...state.ledgers[index],
        status: payload.status,
      };
      writeLocalState(state);
      return;
    }

    const { error } = await supabase
      .from("ledgers")
      .update({ status: payload.status })
      .eq("workspace_id", payload.workspaceId)
      .eq("ledger_pda", payload.ledgerPda);

    if (error) {
      throw new Error(`Failed to update ledger link status: ${error.message}`);
    }
  }

  async unlinkLedgerFromWorkspace(workspaceId: string, ledgerPda: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      const state = readLocalState();
      state.ledgers = state.ledgers.filter(
        (ledger) => !(ledger.workspaceId === workspaceId && ledger.ledgerPda === ledgerPda),
      );
      writeLocalState(state);
      return;
    }

    await supabase
      .from("ledgers")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("ledger_pda", ledgerPda);
  }

  async listWorkspaceCustomers(workspaceId: string): Promise<WorkspaceCustomer[]> {
    if (!isSupabaseConfigured()) {
      const state = readLocalState();
      return state.customers.filter((customer) => customer.workspaceId === workspaceId);
    }

    const { data, error } = await supabase
      .from("workspace_customers")
      .select("id,workspace_id,customer_ref,legal_name,tax_id,status,created_at,updated_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      customerRef: row.customer_ref,
      legalName: row.legal_name,
      taxId: row.tax_id,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async createWorkspaceCustomer(payload: {
    workspaceId: string;
    customerRef: string;
    legalName: string;
    taxId?: string | null;
    status?: "active" | "inactive" | "archived";
  }): Promise<WorkspaceCustomer | null> {
    if (!isSupabaseConfigured()) {
      const state = readLocalState();
      const row: WorkspaceCustomer = {
        id: crypto.randomUUID(),
        workspaceId: payload.workspaceId,
        customerRef: payload.customerRef,
        legalName: payload.legalName,
        taxId: payload.taxId ?? null,
        status: payload.status ?? "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      state.customers.push(row);
      writeLocalState(state);
      return row;
    }

    const { data, error } = await supabase
      .from("workspace_customers")
      .insert({
        workspace_id: payload.workspaceId,
        customer_ref: payload.customerRef,
        legal_name: payload.legalName,
        tax_id: payload.taxId ?? null,
        status: payload.status ?? "active",
      })
      .select("id,workspace_id,customer_ref,legal_name,tax_id,status,created_at,updated_at")
      .single();

    if (error || !data) {
      throw new Error(`Failed to create workspace customer: ${error?.message ?? "unknown error"}`);
    }

    return {
      id: data.id,
      workspaceId: data.workspace_id,
      customerRef: data.customer_ref,
      legalName: data.legal_name,
      taxId: data.tax_id,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async updateWorkspaceCustomer(payload: {
    id: string;
    workspaceId: string;
    customerRef?: string;
    legalName?: string;
    taxId?: string | null;
    status?: "active" | "inactive" | "archived";
  }): Promise<WorkspaceCustomer | null> {
    if (!isSupabaseConfigured()) {
      const state = readLocalState();
      const index = state.customers.findIndex(
        (row) => row.id === payload.id && row.workspaceId === payload.workspaceId,
      );
      if (index < 0) return null;
      const current = state.customers[index];
      const next: WorkspaceCustomer = {
        ...current,
        customerRef: payload.customerRef ?? current.customerRef,
        legalName: payload.legalName ?? current.legalName,
        taxId: payload.taxId === undefined ? current.taxId : payload.taxId,
        status: payload.status ?? current.status,
        updatedAt: new Date().toISOString(),
      };
      state.customers[index] = next;
      writeLocalState(state);
      return next;
    }

    const updateData: Record<string, string | null> = { updated_at: new Date().toISOString() };
    if (payload.customerRef !== undefined) updateData.customer_ref = payload.customerRef;
    if (payload.legalName !== undefined) updateData.legal_name = payload.legalName;
    if (payload.taxId !== undefined) updateData.tax_id = payload.taxId;
    if (payload.status !== undefined) updateData.status = payload.status;

    const { data, error } = await supabase
      .from("workspace_customers")
      .update(updateData)
      .eq("workspace_id", payload.workspaceId)
      .eq("id", payload.id)
      .select("id,workspace_id,customer_ref,legal_name,tax_id,status,created_at,updated_at")
      .single();

    if (error || !data) {
      throw new Error(`Failed to update workspace customer: ${error?.message ?? "unknown error"}`);
    }

    return {
      id: data.id,
      workspaceId: data.workspace_id,
      customerRef: data.customer_ref,
      legalName: data.legal_name,
      taxId: data.tax_id,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async listWorkspaceCustomerCodeRegistry(workspaceId: string): Promise<WorkspaceCustomerCodeRegistryEntry[]> {
    if (!isSupabaseConfigured()) {
      const state = readLocalState();
      return state.customerCodeRegistry.filter((row) => row.workspaceId === workspaceId);
    }

    const { data, error } = await supabase
      .from("workspace_customer_code_registry")
      .select("id,workspace_id,customer_code,workspace_customer_id,status,created_at,updated_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      customerCode: row.customer_code,
      workspaceCustomerId: row.workspace_customer_id,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async reserveWorkspaceCustomerCode(payload: {
    workspaceId: string;
    customerCode: string;
    workspaceCustomerId: string;
    status?: "reserved" | "released";
  }): Promise<WorkspaceCustomerCodeRegistryEntry | null> {
    if (!isSupabaseConfigured()) {
      const state = readLocalState();
      const existingIndex = state.customerCodeRegistry.findIndex(
        (row) => row.workspaceId === payload.workspaceId && row.customerCode === payload.customerCode,
      );
      const next: WorkspaceCustomerCodeRegistryEntry = {
        id: existingIndex >= 0 ? state.customerCodeRegistry[existingIndex].id : crypto.randomUUID(),
        workspaceId: payload.workspaceId,
        customerCode: payload.customerCode,
        workspaceCustomerId: payload.workspaceCustomerId,
        status: payload.status ?? "reserved",
        createdAt:
          existingIndex >= 0
            ? state.customerCodeRegistry[existingIndex].createdAt
            : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (existingIndex >= 0) {
        state.customerCodeRegistry[existingIndex] = next;
      } else {
        state.customerCodeRegistry.push(next);
      }
      writeLocalState(state);
      return next;
    }

    const { data, error } = await supabase
      .from("workspace_customer_code_registry")
      .upsert(
        {
          workspace_id: payload.workspaceId,
          customer_code: payload.customerCode,
          workspace_customer_id: payload.workspaceCustomerId,
          status: payload.status ?? "reserved",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,customer_code" },
      )
      .select("id,workspace_id,customer_code,workspace_customer_id,status,created_at,updated_at")
      .single();

    if (error || !data) {
      throw new Error(`Failed to reserve customer code: ${error?.message ?? "unknown error"}`);
    }

    return {
      id: data.id,
      workspaceId: data.workspace_id,
      customerCode: data.customer_code,
      workspaceCustomerId: data.workspace_customer_id,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async listWorkspaceCustomerLedgerLinks(payload: {
    workspaceId: string;
    workspaceCustomerId?: string;
  }): Promise<WorkspaceCustomerLedgerLink[]> {
    if (!isSupabaseConfigured()) {
      const state = readLocalState();
      return state.customerLedgerLinks.filter(
        (row) =>
          row.workspaceId === payload.workspaceId &&
          (!payload.workspaceCustomerId || row.workspaceCustomerId === payload.workspaceCustomerId),
      );
    }

    let query = supabase
      .from("workspace_customer_ledger_links")
      .select(
        "id,workspace_id,workspace_customer_id,ledger_pda,onchain_customer_pubkey,customer_code,status,created_at,updated_at",
      )
      .eq("workspace_id", payload.workspaceId)
      .order("created_at", { ascending: true });

    if (payload.workspaceCustomerId) {
      query = query.eq("workspace_customer_id", payload.workspaceCustomerId);
    }

    const { data, error } = await query;

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      workspaceCustomerId: row.workspace_customer_id,
      ledgerPda: row.ledger_pda,
      onchainCustomerPubkey: row.onchain_customer_pubkey,
      customerCode: row.customer_code,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async linkWorkspaceCustomerToLedger(payload: {
    workspaceId: string;
    workspaceCustomerId: string;
    ledgerPda: string;
    onchainCustomerPubkey: string;
    customerCode: string;
    status?: "active" | "inactive";
  }): Promise<WorkspaceCustomerLedgerLink | null> {
    if (!isSupabaseConfigured()) {
      const state = readLocalState();
      const existingIndex = state.customerLedgerLinks.findIndex(
        (row) =>
          row.workspaceId === payload.workspaceId &&
          row.workspaceCustomerId === payload.workspaceCustomerId &&
          row.ledgerPda === payload.ledgerPda,
      );

      const next: WorkspaceCustomerLedgerLink = {
        id: existingIndex >= 0 ? state.customerLedgerLinks[existingIndex].id : crypto.randomUUID(),
        workspaceId: payload.workspaceId,
        workspaceCustomerId: payload.workspaceCustomerId,
        ledgerPda: payload.ledgerPda,
        onchainCustomerPubkey: payload.onchainCustomerPubkey,
        customerCode: payload.customerCode,
        status: payload.status ?? "active",
        createdAt:
          existingIndex >= 0
            ? state.customerLedgerLinks[existingIndex].createdAt
            : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        state.customerLedgerLinks[existingIndex] = next;
      } else {
        state.customerLedgerLinks.push(next);
      }
      writeLocalState(state);
      return next;
    }

    const { data, error } = await supabase
      .from("workspace_customer_ledger_links")
      .upsert(
        {
          workspace_id: payload.workspaceId,
          workspace_customer_id: payload.workspaceCustomerId,
          ledger_pda: payload.ledgerPda,
          onchain_customer_pubkey: payload.onchainCustomerPubkey,
          customer_code: payload.customerCode,
          status: payload.status ?? "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,onchain_customer_pubkey" },
      )
      .select(
        "id,workspace_id,workspace_customer_id,ledger_pda,onchain_customer_pubkey,customer_code,status,created_at,updated_at",
      )
      .single();

    if (error || !data) {
      throw new Error(
        `Failed to link customer to ledger: ${error?.message ?? "unknown error"}`,
      );
    }

    return {
      id: data.id,
      workspaceId: data.workspace_id,
      workspaceCustomerId: data.workspace_customer_id,
      ledgerPda: data.ledger_pda,
      onchainCustomerPubkey: data.onchain_customer_pubkey,
      customerCode: data.customer_code,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}

export const controlPlaneService = new ControlPlaneService();
