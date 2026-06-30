export type ApiEnvelope<T> = {
  data: T;
  meta: { apiVersion: "v1"; requestId: string; workspaceId?: string };
};

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("x-request-id", headers.get("x-request-id") ?? `req_${crypto.randomUUID()}`);
  if (init.method && init.method !== "GET" && init.method !== "HEAD") {
    headers.set("idempotency-key", headers.get("idempotency-key") ?? `idem_${crypto.randomUUID()}`);
  }

  const response = await fetch(path, { ...init, headers });
  const payload = (await response.json()) as ApiEnvelope<T> | { error: { message: string } };
  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload ? payload.error.message : `API request failed: ${response.status}`);
  }
  return payload.data;
}
