import { NextResponse } from "next/server";
import { authorizeWorkspaceRequest } from "@/app/api/wallets/_shared";
import { walletManagementService } from "@/services/wallet-management-service";

type SetMainRequest = {
  workspaceId?: string;
  walletId?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SetMainRequest;
    const workspaceId = body.workspaceId?.trim();
    const walletId = body.walletId?.trim();

    if (!workspaceId || !walletId) {
      return NextResponse.json(
        { error: "workspaceId and walletId are required." },
        { status: 400 },
      );
    }

    await authorizeWorkspaceRequest(request, workspaceId, ["admin", "accountant"]);
    const wallet = await walletManagementService.setMainWallet({ workspaceId, walletId });
    return NextResponse.json({ wallet });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to set main wallet.";
    const status = message.includes("Forbidden") ? 403 : message.includes("token") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
