const AUTH_SESSION_STORAGE_KEY = "ar:api-auth:session:v2";
const LEGACY_AUTH_SESSION_STORAGE_KEY = "ar:api-auth:session";

function parseStoredSession<T>(raw: string | null): T | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function clearLegacyStorage(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(LEGACY_AUTH_SESSION_STORAGE_KEY);
}

export function readStoredSession<T>(): T | null {
  if (typeof window === "undefined") {
    return null;
  }

  const currentRaw = window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  const current = parseStoredSession<T>(currentRaw);
  if (current) {
    return current;
  }

  if (currentRaw) {
    window.sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  }

  const legacyRaw = window.localStorage.getItem(LEGACY_AUTH_SESSION_STORAGE_KEY);
  const legacy = parseStoredSession<T>(legacyRaw);
  if (!legacy) {
    if (legacyRaw) {
      clearLegacyStorage();
    }
    return null;
  }

  // One-time migration from legacy localStorage into tab-scoped session storage.
  window.sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(legacy));
  clearLegacyStorage();
  return legacy;
}

export function writeStoredSession<T>(session: T | null): void {
  if (typeof window === "undefined") {
    return;
  }

  if (!session) {
    window.sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    clearLegacyStorage();
    return;
  }

  window.sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  clearLegacyStorage();
}
