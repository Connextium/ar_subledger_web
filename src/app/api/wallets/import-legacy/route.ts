import { NextResponse } from "next/server";
import { authorizeWorkspaceRequest } from "@/app/api/wallets/_shared";
import { walletManagementService } from "@/services/wallet-management-service";

type ImportLegacyWalletRequest = {
  workspaceId?: string;
  privateKey?: string;
  setAsMain?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ImportLegacyWalletRequest;
    const workspaceId = body.workspaceId?.trim();
    const privateKey = body.privateKey?.trim();

    if (!workspaceId || !privateKey) {
      return NextResponse.json(
        { error: "workspaceId and privateKey are required." },
        { status: 400 },
      );
    }

    const auth = await authorizeWorkspaceRequest(request, workspaceId, ["admin", "accountant"]);

    const wallet = await walletManagementService.importLegacyWallet({
      workspaceId,
      actorUserId: auth.userId,
      privateKey,
      setAsMain: body.setAsMain ?? true,
    });

    return NextResponse.json({
      wallet: {
        id: wallet.id,
        workspaceId: wallet.workspaceId,
        publicKey: wallet.publicKey,
        isMain: wallet.isMain,
        status: wallet.status,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to import legacy wallet.";
    const status = message.includes("Forbidden") ? 403 : message.includes("token") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
