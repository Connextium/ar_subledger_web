export function requireIdempotencyKey(request: Request): string {
  const key = request.headers.get("idempotency-key")?.trim();
  if (!key) throw new Error("Idempotency-Key is required for mutating API requests.");
  return key;
}
