export const RELOGIN_WARNING_MESSAGE = "Session or API key expired. Please re-login.";

export const RELOGIN_REQUIRED_EVENT = "ar:auth:relogin-required";

const AUTH_EXPIRED_PATTERNS: RegExp[] = [
  /x-api-key.*expir/i,
  /token expired/i,
  /jwt expired/i,
  /expired token/i,
  /refresh token.*expir/i,
];

function isExpiredAuthMessage(message: string | null | undefined): boolean {
  if (!message) {
    return false;
  }

  return AUTH_EXPIRED_PATTERNS.some((pattern) => pattern.test(message));
}

export function isReloginRequiredError(message: string | null | undefined, status?: number): boolean {
  if (isExpiredAuthMessage(message)) {
    return true;
  }

  if (status !== 401) {
    return false;
  }

  // 401 with no explicit message is commonly returned on expired access tokens.
  return !message;
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