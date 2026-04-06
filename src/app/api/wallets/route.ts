import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { NextResponse } from "next/server";
import { authorizeWorkspaceRequest } from "@/app/api/wallets/_shared";
import { walletManagementService } from "@/services/wallet-management-service";
import type { WalletSource, WalletUsage } from "@/lib/types/wallet";

type CreateWalletRequest = {
  workspaceId?: string;
  usage?: WalletUsage;
  source?: WalletSource;
  referenceType?: string | null;
  referenceId?: string | null;
  setAsMain?: boolean;
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId")?.trim();
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
    }

    await authorizeWorkspaceRequest(request, workspaceId, ["admin", "accountant", "viewer"]);
    const wallets = await walletManagementService.listWallets(workspaceId);
    return NextResponse.json({ wallets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list wallets.";
    const status = message.includes("Forbidden") ? 403 : message.includes("token") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateWalletRequest;
    const workspaceId = body.workspaceId?.trim();
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
    }

    const auth = await authorizeWorkspaceRequest(request, workspaceId, ["admin", "accountant"]);

    const generated = Keypair.generate();
    const wallet = await walletManagementService.createWallet({
      workspaceId,
      actorUserId: auth.userId,
      publicKey: generated.publicKey.toBase58(),
      privateKey: bs58.encode(generated.secretKey),
      source: body.source ?? "rotate",
      usage: body.usage ?? "transaction_signer",
      referenceType: body.referenceType ?? null,
      referenceId: body.referenceId ?? null,
      setAsMain: Boolean(body.setAsMain),
    });

    return NextResponse.json({ wallet });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create wallet.";
    const status = message.includes("Forbidden") ? 403 : message.includes("token") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
