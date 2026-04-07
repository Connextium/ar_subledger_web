"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type SVGProps } from "react";
import { useTheme } from "@/context/theme-context";

const links = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/workflow", label: "Workflow" },
  { href: "/app/ledgers", label: "Ledgers" },
  { href: "/app/customers", label: "Customers" },
  { href: "/app/invoices", label: "Invoices" },
  { href: "/app/settlements", label: "Settlements" },
  { href: "/app/timeline", label: "Activity" },
  { href: "/app/configuration", label: "Configuration" },
];

function SunIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.2M12 19.8V22M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M2 12h2.2M19.8 12H22M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5" />
    </svg>
  );
}

function MoonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true" {...props}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const isLightTheme = theme === "light";

  return (
    <aside className="flex h-full w-full min-w-0 flex-col bg-slate-100 p-4">
      <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">AR Suite</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">Subledger Protocol</p>
        <p className="mt-1 text-[10px] text-slate-600">Localnet workspace console</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
        {links.map((item) => {
          const active =
            item.href === "/app"
              ? pathname === "/app"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-medium transition ${
                active
                  ? "border-[var(--badge-border)] bg-[var(--badge-bg)] text-[var(--badge-fg)]"
                  : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full transition ${
                  active ? "bg-[var(--badge-border)]" : "bg-slate-500 group-hover:bg-slate-300"
                }`}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-3 bg-slate-100 px-0 py-3">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setTheme(isLightTheme ? "dark-titanium" : "light")}
            aria-label={isLightTheme ? "Switch to dark titanium theme" : "Switch to light theme"}
            title={isLightTheme ? "Switch to dark titanium theme" : "Switch to light theme"}
            className="inline-flex items-center justify-center rounded-md border border-[var(--badge-border)] bg-[var(--badge-bg)] p-1.5 text-[var(--badge-fg)] transition hover:opacity-90"
          >
            {isLightTheme ? <MoonIcon className="h-4 w-4" /> : <SunIcon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
}
