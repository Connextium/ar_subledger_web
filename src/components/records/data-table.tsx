import type { ReactNode } from "react";

type Column<T> = {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
};

export function DataTable<T extends { pubkey: string }>({
  title,
  rows,
  columns,
  emptyLabel,
}: {
  title: string;
  rows: T[];
  columns: Column<T>[];
  emptyLabel: string;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 bg-slate-50 px-3 py-2">
        <h2 className="text-xs font-semibold text-slate-800">{title}</h2>
      </header>
      <div className="overflow-auto">
        <table className="min-w-full border-collapse text-[11px]">
          <thead className="bg-slate-100 text-left text-[10px] uppercase tracking-[0.08em] text-slate-500">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-3 py-2 font-semibold">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-4 text-xs text-slate-500">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.pubkey} className="border-t border-slate-100 text-slate-700">
                  {columns.map((column) => (
                    <td key={column.key} className="px-3 py-2 align-top">
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
