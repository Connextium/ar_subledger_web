import { acceptedMutation, ok, workspaceIdFrom, type WorkspaceParams } from "@/app/api/v1/_shared/route-utils";

export async function GET(request: Request, context: WorkspaceParams) {
  const workspaceId = await workspaceIdFrom(context);
  return ok(request, { workspace: null }, workspaceId);
}

export async function PATCH(request: Request, context: WorkspaceParams) {
  const workspaceId = await workspaceIdFrom(context);
  return acceptedMutation(request, { workspace: null }, workspaceId);
}
