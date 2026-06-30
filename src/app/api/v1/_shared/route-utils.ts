import { apiSuccess, getRequestId } from "./api-response";
import { requireIdempotencyKey } from "./idempotency";

export type WorkspaceParams = {
  params: Promise<{ workspaceId: string; keyId?: string; userId?: string; walletId?: string; clientId?: string; subscriptionId?: string }>;
};

export async function workspaceIdFrom(context: WorkspaceParams) {
  return (await context.params).workspaceId;
}

export function ok(request: Request, data: Record<string, unknown>, workspaceId?: string) {
  return apiSuccess(data, { requestId: getRequestId(request), workspaceId });
}

export function created(request: Request, data: Record<string, unknown>, workspaceId?: string) {
  return apiSuccess(data, { requestId: getRequestId(request), workspaceId }, 201);
}

export function acceptedMutation(request: Request, data: Record<string, unknown>, workspaceId?: string) {
  const idempotencyKey = requireIdempotencyKey(request);
  return apiSuccess({ ...data, idempotencyKey }, { requestId: getRequestId(request), workspaceId });
}
