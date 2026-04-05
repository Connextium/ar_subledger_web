export function formatLamportsAmount(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export function formatUnixDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function clampText(value: string, limit = 32): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}...`;
}

export function parseAmountToMinor(value: string): number {
  const normalized = Number(value);
  if (Number.isNaN(normalized)) return 0;
  return Math.round(normalized * 100);
}
