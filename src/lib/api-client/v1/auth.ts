import type { AuthSession, AuthUser } from "@/lib/auth/session-types";
import { apiFetch } from "@/lib/api-client/v1/http";
import {
  readStoredSession as readAuthStoredSession,
  writeStoredSession as writeAuthStoredSession,
} from "@/lib/auth/session-storage";

type AuthSessionPayload = {
  user: AuthUser | null;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
};

function toSession(payload: AuthSessionPayload | null | undefined): AuthSession | null {
  if (!payload?.user) {
    return null;
  }

  return {
    access_token: payload.accessToken ?? "",
    refresh_token: payload.refreshToken ?? "",
    expires_at: payload.expiresAt,
    user: {
      id: payload.user.id,
      email: payload.user.email ?? undefined,
    },
  };
}

function readStoredSession(): AuthSession | null {
  return readAuthStoredSession<AuthSession>();
}

function writeStoredSession(session: AuthSession | null): void {
  writeAuthStoredSession<AuthSession>(session);
}

export const authApi = {
  async register(email: string, password: string) {
    const payload = await apiFetch<{ user: AuthUser | null; session: AuthSessionPayload | null }>("/api/v1/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const session = toSession(payload.session);
    writeStoredSession(session);
    return { user: session?.user ?? null, session };
  },
  async login(email: string, password: string) {
    const payload = await apiFetch<{ session: AuthSessionPayload | null }>("/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const session = toSession(payload.session);
    writeStoredSession(session);
    return { session };
  },
  async logout() {
    const session = readStoredSession();

    if (!session?.access_token) {
      writeStoredSession(null);
      return { revoked: true };
    }

    await apiFetch<{ revoked: boolean }>("/api/v1/auth/logout", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    writeStoredSession(null);
    return { revoked: true };
  },
  async refresh(refreshToken: string) {
    const payload = await apiFetch<{ session: AuthSessionPayload | null }>("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    const session = toSession(payload.session);
    writeStoredSession(session);
    return { session };
  },
  async getSession() {
    const stored = readStoredSession();
    if (!stored?.access_token) {
      return { session: null as AuthSession | null, user: null as AuthUser | null };
    }

    try {
      const payload = await apiFetch<{ session: AuthSessionPayload | null; user: AuthUser | null }>("/api/v1/auth/session", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${stored.access_token}`,
        },
      });

      const session = toSession(payload.session) ?? stored;
      writeStoredSession(session);
      return { session, user: session?.user ?? null };
    } catch {
      writeStoredSession(null);
      return { session: null as AuthSession | null, user: null as AuthUser | null };
    }
  },
  async listApiKeys(workspaceId: string, accessToken?: string) {
    const session = readStoredSession();
    const bearer = accessToken ?? session?.access_token;

    return apiFetch<{ apiKeys: unknown[] }>(
      `/api/v1/auth/api-keys?workspaceId=${encodeURIComponent(workspaceId)}`,
      {
        method: "GET",
        headers: bearer
          ? {
              Authorization: `Bearer ${bearer}`,
            }
          : undefined,
      },
    );
  },
  async createApiKey(input: { workspaceId: string; name?: string; scopes?: string[] }, accessToken?: string) {
    const session = readStoredSession();
    const bearer = accessToken ?? session?.access_token;

    return apiFetch<{ apiKey: string; record: unknown }>("/api/v1/auth/api-keys", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      body: JSON.stringify(input),
    });
  },
  async revokeApiKey(keyId: string, accessToken?: string) {
    const session = readStoredSession();
    const bearer = accessToken ?? session?.access_token;

    return apiFetch<{ revoked: boolean }>(`/api/v1/auth/api-keys/${encodeURIComponent(keyId)}`, {
      method: "DELETE",
      headers: bearer
        ? {
            Authorization: `Bearer ${bearer}`,
          }
        : undefined,
    });
  },
};
