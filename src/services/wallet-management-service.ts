import "server-only";

import bs58 from "bs58";
import { Connection, PublicKey } from "@solana/web3.js";
import { Keypair } from "@solana/web3.js";
import { serverEnv } from "@/lib/config/server-env";
import {
  decryptWalletPrivateKey,
  encryptWalletPrivateKey,
} from "@/lib/crypto/wallet-crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  WalletBalanceSnapshotRow,
  WalletKeypairRow,
} from "@/lib/supabase/types";
import type {
  CreateWalletPayload,
  WalletBalanceSnapshot,
  WorkspaceWallet,
} from "@/lib/types/wallet";

const WALLET_BASE_SELECT =
  "id,workspace_id,chain,public_key,key_provider,encryption_key_id,key_version,encrypted_dek,crypto_alg,source,usage,reference_type,reference_id,is_main,status,created_by,created_at,updated_at";

export class WalletManagementService {
  private getSupabase() {
    return createSupabaseServerClient();
  }

  private assertReferencePair(referenceType?: string | null, referenceId?: string | null): void {
    const hasType = Boolean(referenceType && referenceType.trim().length > 0);
    const hasId = Boolean(referenceId && referenceId.trim().length > 0);
    if (hasType !== hasId) {
      throw new Error("referenceType and referenceId must be provided together.");
    }
  }

  private mapWalletRow(row: WalletKeypairRow): WorkspaceWallet {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      chain: row.chain,
      publicKey: row.public_key,
      keyProvider: row.key_provider,
      encryptionKeyId: row.encryption_key_id,
      keyVersion: row.key_version,
      cryptoAlg: row.crypto_alg,
      source: row.source,
      usage: row.usage,
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      isMain: row.is_main,
      status: row.status,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async createWallet(payload: CreateWalletPayload): Promise<WorkspaceWallet> {
    const supabase = this.getSupabase();
    this.assertReferencePair(payload.referenceType, payload.referenceId);

    const encrypted = encryptWalletPrivateKey(payload.privateKey);
    const chain = payload.chain ?? "solana";

    if (payload.setAsMain) {
      const { error: clearMainError } = await supabase
        .from("wallet_keypairs")
        .update({ is_main: false, updated_at: new Date().toISOString() })
        .eq("workspace_id", payload.workspaceId)
        .eq("chain", chain)
        .eq("is_main", true)
        .eq("status", "active");

      if (clearMainError) {
        throw new Error(`Failed to clear current main wallet: ${clearMainError.message}`);
      }
    }

    const { data, error } = await supabase
      .from("wallet_keypairs")
      .insert({
        workspace_id: payload.workspaceId,
        chain,
        public_key: payload.publicKey,
        encrypted_private_key: encrypted.encryptedPrivateKey,
        key_provider: encrypted.keyProvider,
        encryption_key_id: encrypted.encryptionKeyId,
        key_version: encrypted.keyVersion,
        encrypted_dek: encrypted.encryptedDek,
        crypto_alg: encrypted.cryptoAlg,
        nonce_or_iv: encrypted.nonceOrIv,
        auth_tag: encrypted.authTag,
        source: payload.source,
        usage: payload.usage,
        reference_type: payload.referenceType ?? null,
        reference_id: payload.referenceId ?? null,
        is_main: Boolean(payload.setAsMain),
        status: "active",
        created_by: payload.actorUserId,
      })
      .select(WALLET_BASE_SELECT)
      .single();

    if (error || !data) {
      throw new Error(`Failed to create wallet: ${error?.message ?? "unknown error"}`);
    }

    return this.mapWalletRow(data as WalletKeypairRow);
  }

  async importLegacyWallet(payload: {
    workspaceId: string;
    actorUserId: string;
    privateKey: string;
    setAsMain?: boolean;
  }): Promise<WorkspaceWallet> {
    const supabase = this.getSupabase();

    let keypair: Keypair;
    try {
      keypair = Keypair.fromSecretKey(bs58.decode(payload.privateKey));
    } catch {
      throw new Error("Invalid legacy private key format.");
    }

    const publicKey = keypair.publicKey.toBase58();

    const { data: existingData, error: existingError } = await supabase
      .from("wallet_keypairs")
      .select(WALLET_BASE_SELECT)
      .eq("workspace_id", payload.workspaceId)
      .eq("chain", "solana")
      .eq("public_key", publicKey)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Failed to check existing legacy wallet: ${existingError.message}`);
    }

    if (existingData) {
      const existing = this.mapWalletRow(existingData as WalletKeypairRow);
      if (payload.setAsMain && !existing.isMain && existing.status === "active") {
        return this.setMainWallet({ workspaceId: payload.workspaceId, walletId: existing.id });
      }
      return existing;
    }

    return this.createWallet({
      workspaceId: payload.workspaceId,
      actorUserId: payload.actorUserId,
      publicKey,
      privateKey: payload.privateKey,
      chain: "solana",
      source: "rotate",
      usage: "registration_seed",
      referenceType: "legacy_migration",
      referenceId: `local_storage:${payload.actorUserId}`,
      setAsMain: payload.setAsMain ?? true,
    });
  }

  async ensureDefaultWorkspaceWallet(payload: {
    workspaceId: string;
    actorUserId: string;
  }): Promise<WorkspaceWallet> {
    const supabase = this.getSupabase();
    const { data: existingData, error: existingError } = await supabase
      .from("wallet_keypairs")
      .select(WALLET_BASE_SELECT)
      .eq("workspace_id", payload.workspaceId)
      .eq("chain", "solana")
      .order("is_main", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Failed to check existing wallet: ${existingError.message}`);
    }

    if (existingData) {
      return this.mapWalletRow(existingData as WalletKeypairRow);
    }

    const keypair = Keypair.generate();
    return this.createWallet({
      workspaceId: payload.workspaceId,
      actorUserId: payload.actorUserId,
      publicKey: keypair.publicKey.toBase58(),
      privateKey: bs58.encode(keypair.secretKey),
      chain: "solana",
      source: "registration_init",
      usage: "main_operational",
      referenceType: "workspace",
      referenceId: payload.workspaceId,
      setAsMain: true,
    });
  }

  async listWallets(workspaceId: string): Promise<WorkspaceWallet[]> {
    const supabase = this.getSupabase();
    const { data, error } = await supabase
      .from("wallet_keypairs")
      .select(WALLET_BASE_SELECT)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error || !data) {
      throw new Error(`Failed to list wallets: ${error?.message ?? "unknown error"}`);
    }

    const wallets = data.map((row) => this.mapWalletRow(row as WalletKeypairRow));
    if (wallets.length === 0) {
      return wallets;
    }

    const walletIds = wallets.map((wallet) => wallet.id);
    const { data: snapshotData, error: snapshotError } = await supabase
      .from("wallet_balance_snapshots")
      .select("wallet_id,lamports,observed_at")
      .in("wallet_id", walletIds)
      .order("observed_at", { ascending: false });

    if (snapshotError) {
      throw new Error(`Failed to list wallet balances: ${snapshotError.message}`);
    }

    const latestByWalletId = new Map<string, { lamports: number; observedAt: string }>();
    for (const snapshot of (snapshotData ?? []) as Array<{
      wallet_id: string;
      lamports: number;
      observed_at: string;
    }>) {
      if (!latestByWalletId.has(snapshot.wallet_id)) {
        latestByWalletId.set(snapshot.wallet_id, {
          lamports: snapshot.lamports,
          observedAt: snapshot.observed_at,
        });
      }
    }

    return wallets.map((wallet) => {
      const latest = latestByWalletId.get(wallet.id);
      return {
        ...wallet,
        latestBalanceLamports: latest?.lamports ?? null,
        latestBalanceObservedAt: latest?.observedAt ?? null,
      };
    });
  }

  async setMainWallet(payload: {
    workspaceId: string;
    walletId: string;
  }): Promise<WorkspaceWallet> {
    const supabase = this.getSupabase();
    const { data: walletData, error: walletError } = await supabase
      .from("wallet_keypairs")
      .select(WALLET_BASE_SELECT)
      .eq("workspace_id", payload.workspaceId)
      .eq("id", payload.walletId)
      .single();

    if (walletError || !walletData) {
      throw new Error(`Wallet not found: ${walletError?.message ?? "unknown error"}`);
    }

    const wallet = walletData as WalletKeypairRow;
    if (wallet.status !== "active") {
      throw new Error("Only active wallets can be set as main.");
    }

    const { error: clearMainError } = await supabase
      .from("wallet_keypairs")
      .update({ is_main: false, updated_at: new Date().toISOString() })
      .eq("workspace_id", payload.workspaceId)
      .eq("chain", wallet.chain)
      .eq("is_main", true)
      .eq("status", "active");

    if (clearMainError) {
      throw new Error(`Failed to clear current main wallet: ${clearMainError.message}`);
    }

    const { data: updatedData, error: updateError } = await supabase
      .from("wallet_keypairs")
      .update({ is_main: true, updated_at: new Date().toISOString() })
      .eq("workspace_id", payload.workspaceId)
      .eq("id", payload.walletId)
      .select(WALLET_BASE_SELECT)
      .single();

    if (updateError || !updatedData) {
      throw new Error(`Failed to set main wallet: ${updateError?.message ?? "unknown error"}`);
    }

    return this.mapWalletRow(updatedData as WalletKeypairRow);
  }

  async getWalletBalance(walletId: string): Promise<WalletBalanceSnapshot | null> {
    const supabase = this.getSupabase();
    const { data, error } = await supabase
      .from("wallet_balance_snapshots")
      .select("id,wallet_id,lamports,rpc_endpoint,observed_at,created_at")
      .eq("wallet_id", walletId)
      .order("observed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch wallet balance: ${error.message}`);
    }
    if (!data) return null;

    const row = data as WalletBalanceSnapshotRow;
    return {
      walletId: row.wallet_id,
      lamports: row.lamports,
      rpcEndpoint: row.rpc_endpoint,
      observedAt: row.observed_at,
    };
  }

  async refreshWalletBalances(workspaceId: string): Promise<WalletBalanceSnapshot[]> {
    const supabase = this.getSupabase();
    const { data, error } = await supabase
      .from("wallet_keypairs")
      .select("id,public_key")
      .eq("workspace_id", workspaceId)
      .eq("status", "active");

    if (error || !data) {
      throw new Error(`Failed to list active wallets: ${error?.message ?? "unknown error"}`);
    }

    const connection = new Connection(serverEnv.solanaRpcUrl, "confirmed");
    const observedAt = new Date().toISOString();
    const snapshots: WalletBalanceSnapshot[] = [];

    for (const wallet of data as Array<{ id: string; public_key: string }>) {
      const lamports = await connection.getBalance(new PublicKey(wallet.public_key));
      snapshots.push({
        walletId: wallet.id,
        lamports,
        rpcEndpoint: serverEnv.solanaRpcUrl,
        observedAt,
      });
    }

    if (snapshots.length > 0) {
      const { error: insertError } = await supabase.from("wallet_balance_snapshots").insert(
        snapshots.map((snapshot) => ({
          wallet_id: snapshot.walletId,
          lamports: snapshot.lamports,
          rpc_endpoint: snapshot.rpcEndpoint,
          observed_at: snapshot.observedAt,
        })),
      );

      if (insertError) {
        throw new Error(`Failed to persist wallet balances: ${insertError.message}`);
      }
    }

    return snapshots;
  }

  async exportPrivateKey(payload: {
    workspaceId: string;
    walletId: string;
  }): Promise<string> {
    const supabase = this.getSupabase();
    const { data, error } = await supabase
      .from("wallet_keypairs")
      .select("workspace_id,id,status,encrypted_private_key,nonce_or_iv,auth_tag")
      .eq("workspace_id", payload.workspaceId)
      .eq("id", payload.walletId)
      .single();

    if (error || !data) {
      throw new Error(`Wallet not found for export: ${error?.message ?? "unknown error"}`);
    }

    if (data.status !== "active") {
      throw new Error("Only active wallets can be exported.");
    }

    return decryptWalletPrivateKey({
      encryptedPrivateKey: data.encrypted_private_key,
      nonceOrIv: data.nonce_or_iv,
      authTag: data.auth_tag,
    });
  }
}

export const walletManagementService = new WalletManagementService();
