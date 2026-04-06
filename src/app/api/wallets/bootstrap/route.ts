import { NextResponse } from "next/server";
import { authorizeWorkspaceRequest } from "@/app/api/wallets/_shared";
import { walletManagementService } from "@/services/wallet-management-service";

type BootstrapRequest = {
  workspaceId?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BootstrapRequest;
    const workspaceId = body.workspaceId?.trim();
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
    }
    const auth = await authorizeWorkspaceRequest(request, workspaceId, ["admin", "accountant"]);

    const wallet = await walletManagementService.ensureDefaultWorkspaceWallet({
      workspaceId,
      actorUserId: auth.userId,
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
    const message = error instanceof Error ? error.message : "Failed to bootstrap workspace wallet.";
    const status = message.includes("Forbidden") ? 403 : message.includes("token") ? 401 : 500;
    return NextResponse.json(
      { error: message },
      { status },
    );
  }
}
