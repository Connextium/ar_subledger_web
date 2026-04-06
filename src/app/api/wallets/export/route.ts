import { NextResponse } from "next/server";
import { authorizeWorkspaceRequest } from "@/app/api/wallets/_shared";
import { walletManagementService } from "@/services/wallet-management-service";

type ExportWalletRequest = {
  workspaceId?: string;
  walletId?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExportWalletRequest;
    const workspaceId = body.workspaceId?.trim();
    const walletId = body.walletId?.trim();

    if (!workspaceId || !walletId) {
      return NextResponse.json(
        { error: "workspaceId and walletId are required." },
        { status: 400 },
      );
    }

    await authorizeWorkspaceRequest(request, workspaceId, ["admin", "accountant"]);
    const privateKey = await walletManagementService.exportPrivateKey({ workspaceId, walletId });
    return NextResponse.json({ privateKey });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to export private key.";
    const status = message.includes("Forbidden") ? 403 : message.includes("token") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
