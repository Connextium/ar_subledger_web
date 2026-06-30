import { acceptedMutation, workspaceIdFrom, type WorkspaceParams } from "@/app/api/v1/_shared/route-utils";

export async function POST(request: Request, context: WorkspaceParams) {
  const workspaceId = await workspaceIdFrom(context);
  return acceptedMutation(request, { balances: [] }, workspaceId);
}
