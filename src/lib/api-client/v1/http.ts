import type { ApiEnvelope, ApiErrorBody } from "@ar-subledger/api-contracts/envelope";
import { resolveApiBasePath } from "@/lib/api-client/v1/config";
import {
  readStoredSession as readAuthStoredSession,
  writeStoredSession as writeAuthStoredSession,
} from "@/lib/auth/session-storage";
import {
  dispatchReloginRequired,
  isReloginRequiredError,
  toReloginWarningMessage,
} from "@/lib/auth/relogin-warning";

type StoredAuthSession = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  user?: unknown;
};

type AuthSessionPayload = {
  user?: unknown;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
};

let refreshInFlight: Promise<string | null> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

async function parseJsonResponse(response: Response): Promise<unknown | null> {
  const raw = await response.text();
  if (raw.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`API response is not valid JSON: ${response.status}`);
  }
}

function readStoredAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const session = readStoredSession();
  return typeof session?.access_token === "string" && session.access_token.length > 0
    ? session.access_token
    : null;
}

function readStoredSession(): StoredAuthSession | null {
  return readAuthStoredSession<StoredAuthSession>();
}

function writeStoredSession(session: StoredAuthSession | null): void {
  writeAuthStoredSession<StoredAuthSession>(session);
}

function toStoredSession(payload: AuthSessionPayload | null | undefined): StoredAuthSession | null {
  if (!payload) {
    return null;
  }

  return {
    access_token: payload.accessToken ?? "",
    refresh_token: payload.refreshToken ?? "",
    expires_at: payload.expiresAt,
    user: payload.user,
  };
}

async function tryRefreshAccessToken(): Promise<string | null> {
  const stored = readStoredSession();
  const refreshToken = stored?.refresh_token;
  if (!refreshToken) {
    return null;
  }

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch(resolveApiBasePath("/api/v1/auth/refresh"), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-request-id": `req_${crypto.randomUUID()}`,
            "idempotency-key": `idem_${crypto.randomUUID()}`,
          },
          body: JSON.stringify({ refreshToken }),
        });

        const parsed = await parseJsonResponse(response);
        const payload = isRecord(parsed)
          ? (parsed as ApiEnvelope<{ session: AuthSessionPayload | null }> | ApiErrorBody)
          : null;

        if (!payload || !response.ok || "error" in payload) {
          writeStoredSession(null);
          return null;
        }

        const nextSession = toStoredSession(payload.data.session);
        writeStoredSession(nextSession);
        return typeof nextSession?.access_token === "string" && nextSession.access_token.length > 0
          ? nextSession.access_token
          : null;
      } catch {
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }

  return refreshInFlight;
}

function canRetryWithSameBody(init: RequestInit): boolean {
  if (typeof ReadableStream === "undefined") {
    return true;
  }

  return !(init.body instanceof ReadableStream);
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("x-request-id", headers.get("x-request-id") ?? `req_${crypto.randomUUID()}`);
  const initialAccessToken = readStoredAccessToken();
  if (!headers.has("Authorization") && initialAccessToken) {
    headers.set("Authorization", `Bearer ${initialAccessToken}`);
  }
  if (init.method && init.method !== "GET" && init.method !== "HEAD") {
    headers.set("idempotency-key", headers.get("idempotency-key") ?? `idem_${crypto.randomUUID()}`);
  }

  const response = await fetch(resolveApiBasePath(path), { ...init, headers });
  const parsed = await parseJsonResponse(response);
  const payload = isRecord(parsed) ? (parsed as ApiEnvelope<T> | ApiErrorBody) : null;

  if (
    response.status === 401 &&
    path !== "/api/v1/auth/refresh" &&
    canRetryWithSameBody(init)
  ) {
    const refreshedAccessToken = await tryRefreshAccessToken();
    if (refreshedAccessToken && refreshedAccessToken !== initialAccessToken) {
      const retryHeaders = new Headers(init.headers);
      retryHeaders.set("x-request-id", retryHeaders.get("x-request-id") ?? `req_${crypto.randomUUID()}`);
      if (init.method && init.method !== "GET" && init.method !== "HEAD") {
        retryHeaders.set("idempotency-key", retryHeaders.get("idempotency-key") ?? `idem_${crypto.randomUUID()}`);
      }
      retryHeaders.set("Authorization", `Bearer ${refreshedAccessToken}`);

      const retryResponse = await fetch(resolveApiBasePath(path), { ...init, headers: retryHeaders });
      const retryParsed = await parseJsonResponse(retryResponse);
      const retryPayload = isRecord(retryParsed) ? (retryParsed as ApiEnvelope<T> | ApiErrorBody) : null;

      if (!retryPayload) {
        throw new Error(`API response body is empty: ${retryResponse.status}`);
      }

      if (!retryResponse.ok || "error" in retryPayload) {
        const retryErrorMessage = "error" in retryPayload
          ? retryPayload.error.message
          : `API request failed: ${retryResponse.status}`;
        if (isReloginRequiredError(retryErrorMessage, retryResponse.status)) {
          writeStoredSession(null);
          dispatchReloginRequired(retryErrorMessage);
        }
        throw new Error(
          toReloginWarningMessage(retryErrorMessage, retryResponse.status),
        );
      }

      return retryPayload.data;
    }
  }

  if (!payload) {
    if (isReloginRequiredError(null, response.status)) {
      writeStoredSession(null);
      dispatchReloginRequired();
    }
    throw new Error(`API response body is empty: ${response.status}`);
  }

  if (!response.ok || "error" in payload) {
    const errorMessage = "error" in payload ? payload.error.message : `API request failed: ${response.status}`;
    if (isReloginRequiredError(errorMessage, response.status)) {
      writeStoredSession(null);
      dispatchReloginRequired(errorMessage);
    }
    throw new Error(toReloginWarningMessage(errorMessage, response.status));
  }
  return payload.data;
}
