"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { resolveApiBasePath } from "@/lib/api-client/v1/config";

const API_UNAVAILABLE_MESSAGE =
  "API is unavailable or blocked. The login page is loaded, but sign-in may fail until the API is reachable.";

function isCrossOriginBlockedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("failed to fetch") || message.includes("cors") || message.includes("cross-origin");
}

export function LoginAvailabilityWarning() {
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 2500);

    fetch(resolveApiBasePath("/api/v1/platform/health"), {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          setWarning(`${API_UNAVAILABLE_MESSAGE} Health check returned ${response.status}.`);
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          setWarning(`${API_UNAVAILABLE_MESSAGE} Health check timed out.`);
          return;
        }

        setWarning(
          isCrossOriginBlockedError(error)
            ? "API or Next.js dev resources may be blocked by cross-origin safety policy. The login page is loaded, but sign-in may fail until the origin is allowed and the API is reachable."
            : API_UNAVAILABLE_MESSAGE,
        );
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  if (!warning) {
    return null;
  }

  return (
    <Alert variant="destructive">
      <AlertDescription>{warning}</AlertDescription>
    </Alert>
  );
}
