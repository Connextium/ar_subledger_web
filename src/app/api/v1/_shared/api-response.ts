import { NextResponse } from "next/server";

export type ApiMeta = {
  requestId: string;
  workspaceId?: string;
};

export function apiSuccess<T>(data: T, meta: ApiMeta, status = 200) {
  return NextResponse.json(
    {
      data,
      meta: {
        apiVersion: "v1",
        requestId: meta.requestId,
        ...(meta.workspaceId ? { workspaceId: meta.workspaceId } : {}),
      },
    },
    { status },
  );
}

export function apiError(
  code: string,
  message: string,
  status: number,
  details: unknown,
  requestId: string,
) {
  return NextResponse.json(
    {
      error: { code, message, details },
      meta: { apiVersion: "v1", requestId },
    },
    { status },
  );
}

export function getRequestId(request: Request): string {
  return request.headers.get("x-request-id") ?? `req_${crypto.randomUUID()}`;
}
