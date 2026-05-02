import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { accountingEngineService } from "@/services/accounting-engine-service";
import { PublicKey } from "@solana/web3.js";
import { walletManagementService } from "@/services/wallet-management-service";
import { EmbeddedWallet } from "@/lib/solana/embedded-wallet";

export async function POST(request: NextRequest) {
  try {
    const { generalLedgerId, workspaceId } = await request.json();

    if (!generalLedgerId || !workspaceId) {
      return NextResponse.json({ error: "Missing generalLedgerId or workspaceId" }, { status: 400 });
    }

    // Get auth token
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing authorization header" }, { status: 401 });
    }

    const token = authHeader.substring(7);

    // Create Supabase client with user token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );

    // Verify user has access to workspace
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from("workspace_members")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
    }

    // Fetch ledger with authority pubkey
    const { data: ledger, error: ledgerError } = await supabase
      .from("ledgers")
      .select("*")
      .eq("id", generalLedgerId)
      .eq("workspace_id", workspaceId)
      .single();

    if (ledgerError || !ledger) {
      return NextResponse.json({ error: "Ledger not found" }, { status: 404 });
    }

    if (!ledger.authority_pubkey) {
      return NextResponse.json(
        { error: "Ledger authority pubkey not set" },
        { status: 400 },
      );
    }

    // Use the main workspace wallet as authority for signing
    // 1. Find the main wallet for this workspace
    const wallets = await walletManagementService.listWallets(workspaceId);
    const mainWallet = wallets.find((w) => w.isMain && w.status === "active");
    if (!mainWallet) {
      return NextResponse.json({ error: "No main wallet found for workspace" }, { status: 400 });
    }

    // 2. Export the decrypted private key
    const privateKey = await walletManagementService.exportPrivateKey({
      workspaceId,
      walletId: mainWallet.id,
    });

    // 3. Create EmbeddedWallet from private key
    const authorityWallet = EmbeddedWallet.fromSecret(privateKey);

    // 4. Call accounting service to initialize GL accounts
    const result = await accountingEngineService.initializeGlAccounts(
      new PublicKey(ledger.onchain_ledger_key),
      authorityWallet,
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to initialize GL accounts" },
        { status: 500 },
      );
    }

    // Store that GL accounts have been initialized
    const { error: updateError } = await supabase
      .from("ledgers")
      .update({
        gl_accounts_initialized: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", generalLedgerId);

    if (updateError) {
      console.error("Error updating ledger:", updateError);
      // Don't fail the response, GL accounts were created on-chain
    }

    return NextResponse.json({
      success: true,
      txs: result.txs,
      message: "GL accounts initialized successfully",
    });
  } catch (err) {
    console.error("Error initializing GL accounts:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
