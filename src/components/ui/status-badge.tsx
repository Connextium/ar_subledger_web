export function StatusBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-700">
      {label}
    </span>
  );
}
