import type { ReactNode } from "react";

export function Panel({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div>
          <h2 className="text-xs font-semibold text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-[11px] text-slate-600">{subtitle}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}
