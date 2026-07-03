export const RELOGIN_WARNING_MESSAGE = "Session or API key expired. Please re-login.";

export const RELOGIN_REQUIRED_EVENT = "ar:auth:relogin-required";

const AUTH_REQUIRED_PATTERNS: RegExp[] = [
  /authentication token is missing/i,
  /protected workspace route requires authorization:\s*bearer or x-api-key/i,
  /x-api-key.*expir/i,
  /authorization:\s*bearer/i,
  /invalid token/i,
  /token expired/i,
];

export function isReloginRequiredError(message: string | null | undefined, status?: number): boolean {
  if (status === 401 || status === 403) {
    return true;
  }

  if (!message) {
    return false;
  }

  return AUTH_REQUIRED_PATTERNS.some((pattern) => pattern.test(message));
}

export function toReloginWarningMessage(message: string | null | undefined, status?: number): string {
  return isReloginRequiredError(message, status) ? RELOGIN_WARNING_MESSAGE : message ?? "Authentication failed.";
}

export function dispatchReloginRequired(reason?: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(RELOGIN_REQUIRED_EVENT, {
      detail: {
        reason: toReloginWarningMessage(reason),
      },
    }),
  );
}