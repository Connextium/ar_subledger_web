import { NextResponse } from "next/server";
import { authorizeWorkspaceRequest } from "@/app/api/wallets/_shared";
import { walletManagementService } from "@/services/wallet-management-service";

type RefreshBalancesRequest = {
  workspaceId?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RefreshBalancesRequest;
    const workspaceId = body.workspaceId?.trim();

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
    }

    await authorizeWorkspaceRequest(request, workspaceId, ["admin", "accountant"]);
    const snapshots = await walletManagementService.refreshWalletBalances(workspaceId);
    return NextResponse.json({ snapshots });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to refresh balances.";
    const status = message.includes("Forbidden") ? 403 : message.includes("token") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
