export function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim();
}

export function resolveApiBasePath(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalized = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    return normalized;
  }

  return `${baseUrl.replace(/\/$/, "")}${normalized}`;
}