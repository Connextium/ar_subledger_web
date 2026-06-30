import { acceptedMutation, ok, workspaceIdFrom, type WorkspaceParams } from "@/app/api/v1/_shared/route-utils";

export async function GET(request: Request, context: WorkspaceParams) {
  const workspaceId = await workspaceIdFrom(context);
  return ok(request, { vendors: [] }, workspaceId);
}

export async function POST(request: Request, context: WorkspaceParams) {
  const workspaceId = await workspaceIdFrom(context);
  return acceptedMutation(request, { vendor: null }, workspaceId);
}
