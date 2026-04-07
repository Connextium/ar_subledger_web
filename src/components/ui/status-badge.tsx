export function StatusBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-md border border-[var(--badge-border)] bg-[var(--badge-bg)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--badge-fg)]">
      {label}
    </span>
  );
}
