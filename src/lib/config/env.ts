export const env = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
};

export function assertRequiredEnv(): void {
  if (!env.apiBaseUrl) {
    console.warn(
      "NEXT_PUBLIC_API_BASE_URL is not set. Web API calls will use relative paths and require a same-origin API deployment.",
    );
  }
}
