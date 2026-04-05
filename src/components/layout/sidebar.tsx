"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/workflow", label: "Workflow" },
  { href: "/app/ledgers", label: "Ledgers" },
  { href: "/app/customers", label: "Customers" },
  { href: "/app/invoices", label: "Invoices" },
  { href: "/app/settlements", label: "Settlements" },
  { href: "/app/timeline", label: "Activity" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-52 border-r border-slate-200 bg-white/90 p-4">
      <div className="mb-5 border-b border-slate-200 pb-3">
        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">AR Suite</p>
        <p className="text-xs font-semibold text-slate-900">Subledger Localnet</p>
      </div>
      <nav className="flex flex-col gap-1.5">
        {links.map((item) => {
          const active =
            item.href === "/app"
              ? pathname === "/app"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-2 py-1.5 text-xs font-medium transition ${
                active
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
